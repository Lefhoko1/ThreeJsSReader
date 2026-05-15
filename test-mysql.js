// test-mysql.js
const mysql = require('mysql2/promise');

// Your database configuration
const dbConfig = {
    host: 'sq301.infinityfree.com',
    port: 3306,
    user: 'if0_41925752',
    password: 'Lefhoko74700170',
    database: 'if0_41925752_five_permutations',
    connectTimeout: 10000,
    ssl: false // InfinityFree doesn't use SSL for MySQL
};

async function testConnection() {
    console.log('🚀 Testing MySQL connection...\n');
    console.log(`📡 Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`👤 User: ${dbConfig.user}`);
    console.log(`💾 Database: ${dbConfig.database}\n`);
    
    let connection;
    
    try {
        // Step 1: Test network connectivity first
        console.log('1️⃣ Testing network connectivity...');
        const net = require('net');
        
        const networkTest = await new Promise((resolve) => {
            const socket = new net.Socket();
            const timeout = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, 5000);
            
            socket.connect(dbConfig.port, dbConfig.host, () => {
                clearTimeout(timeout);
                socket.destroy();
                resolve(true);
            });
            
            socket.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });
        
        if (networkTest) {
            console.log('   ✅ Network connection successful!\n');
        } else {
            console.log('   ❌ Network connection failed (host may be unreachable)\n');
            console.log('   💡 This might mean InfinityFree blocks external MySQL connections');
            console.log('   💡 Try using phpMyAdmin from their control panel instead\n');
            return;
        }
        
        // Step 2: Try MySQL connection
        console.log('2️⃣ Connecting to MySQL...');
        connection = await mysql.createConnection(dbConfig);
        console.log('   ✅ Connected to MySQL server!\n');
        
        // Step 3: Get server info
        console.log('3️⃣ Getting server information...');
        const [rows] = await connection.query('SELECT VERSION() as version, NOW() as current_time, DATABASE() as database_name');
        console.log(`   📊 MySQL Version: ${rows[0].version}`);
        console.log(`   🕐 Server Time: ${rows[0].current_time}`);
        console.log(`   💾 Current Database: ${rows[0].database_name}\n`);
        
        // Step 4: List all tables
        console.log('4️⃣ Listing all tables...');
        const [tables] = await connection.query('SHOW TABLES');
        
        if (tables.length > 0) {
            console.log(`   📋 Found ${tables.length} table(s):`);
            tables.forEach((table, index) => {
                const tableName = Object.values(table)[0];
                console.log(`      ${index + 1}. ${tableName}`);
            });
        } else {
            console.log('   📭 No tables found yet');
            console.log('   💡 You can create tables using phpMyAdmin or SQL commands\n');
        }
        
        // Step 5: Test create table if none exist (optional)
        if (tables.length === 0) {
            console.log('\n5️⃣ Would you like to create a test table? (y/n)');
            // This would require user input, skipping for automation
            console.log('   💡 To create tables, run the CREATE TABLE SQL in phpMyAdmin');
        }
        
        console.log('\n✅ ALL TESTS PASSED! Connection is working perfectly.\n');
        
        // Step 6: Show connection stats
        console.log('📈 Connection Statistics:');
        console.log(`   🏷️  Thread ID: ${connection.threadId}`);
        console.log(`   🌐 Connection Info: ${connection.config.host}:${connection.config.port}`);
        console.log(`   👤 Connected as: ${connection.config.user}`);
        
    } catch (error) {
        console.error('\n❌ CONNECTION FAILED:\n');
        console.error(`Error code: ${error.code}`);
        console.error(`Error message: ${error.message}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Possible causes:');
            console.error('   • MySQL host is incorrect');
            console.error('   • Port 3306 is blocked');
            console.error('   • InfinityFree blocks external MySQL connections');
            console.error('\n📌 Solution: Use phpMyAdmin from InfinityFree control panel instead');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n💡 Possible causes:');
            console.error('   • Wrong username or password');
            console.error('   • User does not have remote access permission');
            console.error('\n📌 Solution: Check credentials in InfinityFree control panel');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('\n💡 Database not found. Check database name.');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('\n💡 Connection timeout. The host may be blocking external access.');
        }
        
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n🔌 Connection closed.');
        }
    }
}

// Run the test
console.log('=' .repeat(60));
testConnection();
console.log('=' .repeat(60));