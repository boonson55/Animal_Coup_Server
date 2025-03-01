const db = require('../config/db');

const getGameCounts = async () => {
    try {
        const query = 'SELECT count(*) as count FROM games';
        const [rows] = await db.query(query);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงจำนวนเกมทั้งหมด):', error.message);
        throw new Error('ไม่สามารถดึงจำนวนเกมทั้งหมดได้');
    }
};

const getGameById = async (game_id) => {
    try {
        const query = 'SELECT game_id FROM games WHERE game_id = ?';
        const [rows] = await db.query(query, [game_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงจำนวนเกมทั้งหมด):', error.message);
        throw new Error('ไม่สามารถดึงจำนวนเกมทั้งหมดได้');
    }
};

const getGameByRoomId = async (room_id) => {
    try {
        const query = 'SELECT game_id FROM games WHERE room_id = ?';
        const [rows] = await db.query(query, [room_id]);
        return rows.length > 0 ? rows[0].game_id : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงจำนวนเกมทั้งหมด):', error.message);
        throw new Error('ไม่สามารถดึงจำนวนเกมทั้งหมดได้');
    }
};

const insertGame = async (room_id) => {
    try {
        const queryUpdate = 'UPDATE rooms SET play_status = ? WHERE room_id = ?';
        await db.query(queryUpdate, ['เริ่มเกมแล้ว', room_id]);

        const queryInsert = `INSERT INTO games (room_id) VALUES (?)`;
        const [result] = await db.query(queryInsert, [room_id]);

        return result.insertId;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (เพิ่มเกมใหม่):', error.message);
        throw new Error('ไม่สามารถเพิ่มเกมใหม่ได้');
    }
};

const updateFinishedGame = async (game_id) => {
    try {
        const query = 'UPDATE games SET finished_at = NOW() WHERE game_id = ?';
        await db.query(query, [game_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตเวลาจบเกม):', error.message);
        throw new Error('ไม่สามารถอัปเดตเวลาจบเกมได้');
    }
};

module.exports = { getGameCounts, getGameById, getGameByRoomId, insertGame, updateFinishedGame };