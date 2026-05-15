const mysql = require('mysql2');

// Database configuration
const dbConfig = {
    host: 'sql5.freesqldatabase.com',
    user: 'sql5826978',
    password: 'Cd5wHyRQbs',
    database: 'sql5826978',
    port: 3306,
    connectTimeout: 30000
};

// Create connection
const connection = mysql.createConnection(dbConfig);

// Helper function to format output
function printSeparator(title) {
    console.log('\n' + '='.repeat(60));
    console.log(`📋 ${title}`);
    console.log('='.repeat(60));
}

// Helper function to display table data
function displayTable(rows, title = 'Query Results') {
    console.log(`\n📊 ${title}:`);
    if (rows.length === 0) {
        console.log('   (No records found)');
        return;
    }
    console.table(rows);
}

// Promise wrapper for queries
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => {
            if (error) {
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
}

// Connect and run all CRUD operations
connection.connect(async (err) => {
    if (err) {
        console.error('❌ Connection failed:', err.message);
        return;
    }
    
    console.log('✅ Connected to database successfully!\n');
    
    try {
        // ========== 1. CREATE TABLE (Fixed for older MySQL) ==========
        printSeparator('CREATE TABLE (if not exists)');
        
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                quantity INT DEFAULT 0,
                category VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT '0000-00-00 00:00:00'
            )
        `;
        
        await query(createTableSQL);
        console.log('✅ Table "products" created or already exists');
        
        // Add trigger to update updated_at (alternative approach)
        try {
            const dropTriggerSQL = `DROP TRIGGER IF EXISTS update_products_updated_at`;
            await query(dropTriggerSQL);
            
            const createTriggerSQL = `
                CREATE TRIGGER update_products_updated_at
                BEFORE UPDATE ON products
                FOR EACH ROW
                SET NEW.updated_at = CURRENT_TIMESTAMP
            `;
            await query(createTriggerSQL);
            console.log('✅ Trigger created for automatic updated_at');
        } catch (triggerError) {
            console.log('⚠️ Trigger creation skipped (may already exist or not supported)');
        }
        
        // Clear existing data for clean test (optional - comment out if you want to keep data)
        await query('DELETE FROM products');
        console.log('✅ Cleared existing data for clean test');
        
        // ========== 2. CREATE (INSERT) - Seed Data ==========
        printSeparator('CREATE OPERATION (Seeding Data)');
        
        // Seed multiple products
        const seedProducts = [
            ['Laptop', 999.99, 10, 'Electronics'],
            ['Mouse', 25.50, 50, 'Electronics'],
            ['Keyboard', 75.00, 30, 'Electronics'],
            ['Monitor', 299.99, 15, 'Electronics'],
            ['Desk Chair', 199.99, 8, 'Furniture'],
            ['Desk Lamp', 45.00, 25, 'Furniture'],
            ['Notebook', 5.99, 100, 'Stationery'],
            ['Pen Set', 12.50, 75, 'Stationery']
        ];
        
        let insertedCount = 0;
        for (const product of seedProducts) {
            const result = await query(
                'INSERT INTO products (name, price, quantity, category) VALUES (?, ?, ?, ?)',
                product
            );
            if (result.affectedRows > 0) {
                insertedCount++;
                console.log(`   ✅ Inserted: ${product[0]} (ID: ${result.insertId})`);
            }
        }
        console.log(`\n📝 Total seeded: ${insertedCount} products`);
        
        // ========== 3. READ (SELECT) - Fetch all records ==========
        printSeparator('READ OPERATION - Fetch All Products');
        const allProducts = await query('SELECT * FROM products ORDER BY id');
        displayTable(allProducts, 'All Products');
        
        // ========== 4. READ with conditions ==========
        printSeparator('READ OPERATION - Filtered Queries');
        
        // Get products by category
        const electronics = await query(
            'SELECT * FROM products WHERE category = ?',
            ['Electronics']
        );
        displayTable(electronics, 'Electronics Products');
        
        // Get products with low stock (quantity < 20)
        const lowStock = await query(
            'SELECT name, quantity FROM products WHERE quantity < 20 ORDER BY quantity'
        );
        displayTable(lowStock, 'Low Stock Products (< 20 units)');
        
        // Get product count by category
        const categoryCount = await query(
            'SELECT category, COUNT(*) as count, AVG(price) as avg_price FROM products GROUP BY category'
        );
        console.log('\n📊 Category Statistics:');
        categoryCount.forEach(cat => {
            console.log(`   ${cat.category}: ${cat.count} products, Avg Price: $${parseFloat(cat.avg_price).toFixed(2)}`);
        });
        
        // ========== 5. UPDATE Operation ==========
        printSeparator('UPDATE OPERATION');
        
        // Update price of Mouse
        const updateResult = await query(
            'UPDATE products SET price = ? WHERE name = ?',
            [29.99, 'Mouse']
        );
        console.log(`✅ Updated ${updateResult.affectedRows} product(s) - Mouse price changed to $29.99`);
        
        // Increase all Electronics quantity by 5
        const bulkUpdate = await query(
            'UPDATE products SET quantity = quantity + 5 WHERE category = ?',
            ['Electronics']
        );
        console.log(`✅ Bulk update: Added 5 to quantity for ${bulkUpdate.affectedRows} Electronics products`);
        
        // Verify update
        const updatedMouse = await query('SELECT * FROM products WHERE name = ?', ['Mouse']);
        displayTable(updatedMouse, 'Updated Mouse Product');
        
        // Show updated_at in action (if trigger works)
        const updateWithTime = await query(
            'UPDATE products SET price = ? WHERE name = ?',
            [79.99, 'Keyboard']
        );
        console.log(`✅ Updated Keyboard price to $79.99`);
        
        // ========== 6. DELETE Operation ==========
        printSeparator('DELETE OPERATION');
        
        // Insert a temporary product for deletion test
        const tempResult = await query(
            'INSERT INTO products (name, price, quantity, category) VALUES (?, ?, ?, ?)',
            ['Temporary Product', 9.99, 1, 'Test']
        );
        console.log(`✅ Created temporary product with ID: ${tempResult.insertId}`);
        
        // Show all products including temporary
        const beforeDelete = await query('SELECT COUNT(*) as count FROM products');
        console.log(`📊 Total products before delete: ${beforeDelete[0].count}`);
        
        // Delete the temporary product
        const deleteResult = await query(
            'DELETE FROM products WHERE name = ?',
            ['Temporary Product']
        );
        console.log(`✅ Deleted ${deleteResult.affectedRows} temporary product(s)`);
        
        // Verify deletion
        const afterDelete = await query('SELECT COUNT(*) as count FROM products');
        console.log(`📊 Total products after delete: ${afterDelete[0].count}`);
        
        // ========== 7. Advanced Queries ==========
        printSeparator('ADVANCED QUERIES');
        
        // Get total inventory value
        const inventoryValue = await query(
            'SELECT SUM(price * quantity) as total_value FROM products'
        );
        console.log(`💰 Total inventory value: $${parseFloat(inventoryValue[0].total_value).toFixed(2)}`);
        
        // Get most expensive product
        const mostExpensive = await query(
            'SELECT name, price FROM products ORDER BY price DESC LIMIT 1'
        );
        console.log(`💎 Most expensive product: ${mostExpensive[0].name} ($${mostExpensive[0].price})`);
        
        // Get cheapest product
        const cheapest = await query(
            'SELECT name, price FROM products WHERE price > 0 ORDER BY price ASC LIMIT 1'
        );
        console.log(`🎯 Cheapest product: ${cheapest[0].name} ($${cheapest[0].price})`);
        
        // Get products with price range
        const priceRange = await query(
            'SELECT name, price, category FROM products WHERE price BETWEEN ? AND ? ORDER BY price',
            [50, 300]
        );
        displayTable(priceRange, 'Products between $50 and $300');
        
        // ========== 8. Final Summary ==========
        printSeparator('FINAL DATABASE SUMMARY');
        const finalCount = await query('SELECT COUNT(*) as total FROM products');
        const categorySummary = await query(
            'SELECT category, COUNT(*) as count, SUM(quantity) as total_stock FROM products GROUP BY category'
        );
        
        console.log(`\n📈 Database Statistics:`);
        console.log(`   • Total products: ${finalCount[0].total}`);
        console.log(`   • Categories: ${categorySummary.length}`);
        console.log(`\n📦 Stock by Category:`);
        categorySummary.forEach(cat => {
            console.log(`   • ${cat.category}: ${cat.count} items, Total Stock: ${cat.total_stock} units`);
        });
        
        // Get recent products (last 5 created)
        const recentProducts = await query(
            'SELECT id, name, category, created_at FROM products ORDER BY id DESC LIMIT 5'
        );
        displayTable(recentProducts, 'Recently Added Products');
        
        // Test a JOIN query (self join example - products with similar prices)
        const similarPrices = await query(`
            SELECT a.name as product1, b.name as product2, a.price
            FROM products a, products b
            WHERE a.id < b.id AND ABS(a.price - b.price) < 10
            LIMIT 3
        `);
        if (similarPrices.length > 0) {
            console.log('\n🔗 Products with similar prices (within $10):');
            similarPrices.forEach(pair => {
                console.log(`   • ${pair.product1} & ${pair.product2}: $${pair.price}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ ALL CRUD OPERATIONS COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n❌ Error during CRUD operations:', error.message);
        if (error.sql) {
            console.error('SQL Query:', error.sql);
        }
    } finally {
        // Close connection
        connection.end((err) => {
            if (err) {
                console.error('Error closing connection:', err.message);
            } else {
                console.log('\n🔌 Database connection closed');
            }
        });
    }
});