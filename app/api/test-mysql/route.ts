// app/api/test-mysql/route.ts
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function POST(request: Request) {
  try {
    const dbConfig = {
      host: 'sql5.freesqldatabase.com',
      user: 'sql5826978',
      password: 'Cd5wHyRQbs',
      database: 'sql5826978',
      port: 3306,
      connectTimeout: 30000
    };

    const connection = await mysql.createConnection(dbConfig);
    const results: any = {};

    // Test connection
    await connection.query('SELECT 1');
    results.connection = '✅ Connected successfully';

    // Create table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mysql_test_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        quantity INT DEFAULT 0,
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    results.create_table = '✅ Table created';

    // Clear and seed
    await connection.query('DELETE FROM mysql_test_data');
    
    const products = [
      ['Laptop', 999.99, 10, 'Electronics'],
      ['Mouse', 25.50, 50, 'Electronics'],
      ['Keyboard', 75.00, 30, 'Electronics'],
      ['Monitor', 299.99, 15, 'Electronics'],
      ['Desk Chair', 199.99, 8, 'Furniture']
    ];
    
    for (const product of products) {
      await connection.query(
        'INSERT INTO mysql_test_data (name, price, quantity, category) VALUES (?, ?, ?, ?)',
        product
      );
    }
    results.seed = `✅ Inserted ${products.length} products`;

    // Read all
    const [allProducts] = await connection.query('SELECT * FROM mysql_test_data');
    results.read_all = `✅ Found ${(allProducts as any[]).length} products`;

    // Update
    await connection.query('UPDATE mysql_test_data SET price = 29.99 WHERE name = "Mouse"');
    const [updatedMouse] = await connection.query('SELECT * FROM mysql_test_data WHERE name = "Mouse"');
    results.update = `✅ Mouse price updated to $${(updatedMouse as any[])[0]?.price}`;

    // Delete test
    await connection.query('INSERT INTO mysql_test_data (name, price, quantity, category) VALUES ("Temp", 9.99, 1, "Test")');
    await connection.query('DELETE FROM mysql_test_data WHERE name = "Temp"');
    results.delete = '✅ Temp product deleted';

    // Statistics
    const [stats] = await connection.query(`
      SELECT category, COUNT(*) as count, SUM(quantity) as total_stock 
      FROM mysql_test_data 
      GROUP BY category
    `);
    results.statistics = stats;

    await connection.end();

    return NextResponse.json({
      success: true,
      message: 'All CRUD operations completed',
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Also handle GET for easy testing
export async function GET(request: Request) {
  return POST(request);
}