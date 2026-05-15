// app/api/test-database/route.ts
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function POST(request: Request) {
  try {
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
    const connection = await mysql.createConnection(dbConfig);
    
    const results: any = {};

    // 1. Test connection
    await connection.query('SELECT 1');
    results.connection = '✅ Connected successfully';

    // 2. Create table (if not exists)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS nextjs_test_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        quantity INT DEFAULT 0,
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    results.create_table = '✅ Table created';

    // 3. Clear old data
    await connection.query('DELETE FROM nextjs_test_data');
    
    // 4. Seed data
    const products = [
      ['Laptop', 999.99, 10, 'Electronics'],
      ['Mouse', 25.50, 50, 'Electronics'],
      ['Keyboard', 75.00, 30, 'Electronics'],
      ['Monitor', 299.99, 15, 'Electronics'],
      ['Desk Chair', 199.99, 8, 'Furniture']
    ];
    
    for (const product of products) {
      await connection.query(
        'INSERT INTO nextjs_test_data (name, price, quantity, category) VALUES (?, ?, ?, ?)',
        product
      );
    }
    results.seed = `✅ Inserted ${products.length} products`;

    // 5. Read all products
    const [allProducts] = await connection.query('SELECT * FROM nextjs_test_data');
    results.read_all = `✅ Found ${(allProducts as any[]).length} products`;

    // 6. Update product
    await connection.query('UPDATE nextjs_test_data SET price = 29.99 WHERE name = "Mouse"');
    const [updatedMouse] = await connection.query('SELECT * FROM nextjs_test_data WHERE name = "Mouse"');
    results.update = `✅ Mouse price updated to $${(updatedMouse as any[])[0]?.price}`;

    // 7. Delete test
    await connection.query('INSERT INTO nextjs_test_data (name, price, quantity, category) VALUES ("Temp", 9.99, 1, "Test")');
    await connection.query('DELETE FROM nextjs_test_data WHERE name = "Temp"');
    results.delete = '✅ Temp product deleted';

    // 8. Get statistics
    const [stats] = await connection.query(`
      SELECT category, COUNT(*) as count, SUM(quantity) as total_stock 
      FROM nextjs_test_data 
      GROUP BY category
    `);
    results.statistics = stats;

    // 9. Final count
    const [finalCount] = await connection.query('SELECT COUNT(*) as total FROM nextjs_test_data');
    results.final_count = `✅ ${(finalCount as any[])[0].total} products remaining`;

    // Close connection
    await connection.end();

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'All CRUD operations completed successfully',
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error: any) {
    console.error('Database test error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Database test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}