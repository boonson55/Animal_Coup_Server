const mysql = require('mysql2');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let db;

const handleDisconnect = () => {
    db = mysql.createPool(dbConfig);

    db.getConnection((err, connection) => {
        if (err) {
            console.error('ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้:', err.message);
            setTimeout(handleDisconnect, 2000);
        } else {
            console.log('เชื่อมต่อกับฐานข้อมูลเรียบร้อยแล้ว');
            connection.release();
        }
    });

    db.on('error', (err) => {
        console.error('เกิดข้อผิดพลาดเกี่ยวกับฐานข้อมูล:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect();
        } else {
            throw err;
        }
    });
};

handleDisconnect();

module.exports = db.promise();
