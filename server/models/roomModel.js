const db = require('../config/db');

const getRooms = async () => {
    try {
        const query = `SELECT rooms.*, users.player_name
        FROM rooms LEFT JOIN users ON rooms.user_id = users.user_id
        WHERE play_status != "จบเกมแล้ว"`;
        const [rows] = await db.query(query);
        return rows;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงข้อมูลห้องทั้งหมด):', error.message);
        throw new Error('ไม่สามารถดึงข้อมูลห้องทั้งหมดได้');
    }
};

const getRoomById = async (room_id) => {
    try {
        const query = `SELECT rooms.room_status, rooms.pwd_room, rooms.play_status, users.user_id, users.player_name
        FROM rooms LEFT JOIN users ON rooms.user_id = users.user_id
        WHERE room_id = ?`;
        const [rows] = await db.query(query, [room_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงข้อมูลห้องโดยหมายเลขห้อง:', error.message);
        throw new Error('ไม่สามารถดึงข้อมูลห้องได้');
    }
};

const updatePlayerCount = async (room_id, action) => {
    try {
        if (action === 'join') {
            const query = 'UPDATE rooms SET player_count = player_count + 1 WHERE room_id = ?';
            await db.query(query, [room_id]);
        } else if (action === 'leave') {
            const query = ` 
            UPDATE rooms 
            SET player_count = CASE 
                WHEN player_count > 0 THEN player_count - 1 
                ELSE 0 
            END
            WHERE room_id = ?
        `;
            await db.query(query, [room_id]);
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตจำนวนผู้เล่น):', error.message);
        throw new Error('ไม่สามารถอัปเดตจำนวนผู้เล่นได้');
    }
};

const joinRoom = async (room_id, user_id) => {
    try {
        const query = `INSERT INTO room_players (room_id, user_id) VALUES (?, ?)`;
        await db.query(query, [room_id, user_id]);
        await updatePlayerCount(room_id, 'join');
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (เข้าร่วมห้อง):', error.message);
        throw new Error('ไม่สามารถเข้าร่วมห้องได้');
    }
};

const leaveRoom = async (room_id, user_id) => {
    try {
        const query = 'DELETE FROM room_players WHERE room_id = ? AND user_id = ?';
        await db.query(query, [room_id, user_id]);
        await updatePlayerCount(room_id, 'leave');
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ออกจากห้อง):', error.message);
        throw new Error('ไม่สามารถออกจากห้องได้');
    }
};

const getCreated = async (user_id) => {
    try {
        const query = `SELECT * FROM rooms WHERE user_id = ? && play_status != "จบเกมแล้ว"`;
        const [rows] = await db.query(query, [user_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงห้องที่สร้าง):', error.message);
        throw new Error('ไม่สามารถดึงห้องที่สร้างได้');
    }
};

const insertRoom = async (user_id, room_status, pwd_room) => {
    try {
        const password = pwd_room || null;
        const query = `INSERT INTO rooms (user_id, player_count, play_status, room_status, pwd_room)
            VALUES (?, ?, ?, ?, ?)`;
        const [result] = await db.query(query, [user_id, 0, 'ยังไม่เริ่มเกม', room_status, password]);
        return result.insertId;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (เพิ่มห้อง):', error.message);
        throw new Error('ไม่สามารถเพิ่มห้องได้');
    }
};

const deleteRoom = async (room_id) => {
    try {
        const query = 'DELETE FROM rooms WHERE room_id = ? AND play_status != "จบเกมแล้ว"';
        await db.query(query, [room_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ลบห้อง):', error.message);
        throw new Error('ไม่สามารถลบห้องได้');
    }
};

const getRoomPlayers = async (room_id) => {
    try {
        const query = `SELECT users.user_id, users.player_name
        FROM room_players LEFT JOIN users ON room_players.user_id = users.user_id
        WHERE room_id = ? ORDER BY roomp_id`;
        const [rows] = await db.query(query, [room_id]);
        return rows;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงข้อมูลผู้เล่นในห้อง):', error.message);
        throw new Error('ไม่สามารถดึงข้อมูลผู้เล่นในห้องได้');
    }
};

const getCreator = async (room_id, user_id) => {
    try {
        const query = `SELECT * FROM rooms WHERE room_id = ? AND user_id = ? AND play_status != "จบเกมแล้ว"`;
        const [rows] = await db.query(query, [room_id, user_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงข้อมูลผู้สร้างห้อง):', error.message);
        throw new Error('ไม่สามารถดึงข้อมูลผู้สร้างห้องได้');
    }
};

const updateRoomStatus = async (status, password, room_id) => {
    try {
        const query = 'UPDATE rooms SET room_status = ?, pwd_room = ? WHERE room_id = ?';
        await db.query(query, [status, password, room_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตสถานะห้อง):', error.message);
        throw new Error('ไม่สามารถอัปเดตสถานะห้องได้');
    }
};

const updateCreator = async (user_id, room_id) => {
    try {
        const query = 'UPDATE rooms SET user_id = ? WHERE room_id = ?';
        await db.query(query, [user_id, room_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (เปลี่ยนเจ้าของห้อง):', error.message);
        throw new Error('ไม่สามารถเปลี่ยนเจ้าของห้องได้');
    }
};

const getRoomTimeOut = async () => {
    try {
        const querySelect = `
            SELECT room_id FROM rooms WHERE play_status = "ยังไม่เริ่มเกม"
            AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) >= 
            (SELECT config_value FROM configs WHERE config_name = 'close_time')
        `;
        const [rows] = await db.query(querySelect);
        return rows.length > 0 ? rows : [];
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ตรวจสอบห้องหมดเวลา):', error.message);
        throw new Error('ไม่สามารถตรวจสอบห้องหมดเวลาได้');
    }
};

const deleteRoomTimeOut = async (room_id) => {
    try {
        const queryDelete = `DELETE FROM rooms WHERE room_id = ?`;
        await db.query(queryDelete, [room_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ลบห้องที่หมดเวลา):', error.message);
        throw new Error('ไม่สามารถลบห้องที่หมดเวลาได้');
    }
};

const getUserBanInRoom = async (user_id) => {
    try {
        const query = `
                SELECT r.room_id, r.user_id as creator, rp.user_id as player
                FROM rooms r
                JOIN room_players rp ON r.room_id = rp.room_id
                WHERE r.play_status = 'ยังไม่เริ่มเกม' AND rp.user_id = ?
        `;
        const [row] = await db.query(query, [user_id]);
        return row.length > 0 ? row[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ตรวจสอบผู้เล่นที่อยู่ในห้อง):', error.message);
        throw new Error('ไม่สามารถตรวจสอบผู้เล่นที่อยู่ในห้อง');
    }
};

const getUserBanInGame = async (user_id) => {
    try {
        const query = `
                SELECT r.room_id, r.user_id as creator, rp.user_id as player
                FROM rooms r
                JOIN room_players rp ON r.room_id = rp.room_id
                WHERE r.play_status = 'เริ่มเกมแล้ว' AND rp.user_id = ?
        `;
        const [row] = await db.query(query, [user_id]);
        return row.length > 0 ? row[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ตรวจสอบผู้เล่นที่อยู่ในเกม):', error.message);
        throw new Error('ไม่สามารถตรวจสอบผู้เล่นที่อยู่ในเกม');
    }
};

const updateRoomEndGame = async (room_id) => {
    try {
        const query = 'UPDATE rooms SET play_status = ? WHERE room_id = ?';
        await db.query(query, ['จบเกมแล้ว', room_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตสเตตัสจบเกมแล้ว):', error.message);
        throw new Error('ไม่สามารถอัปเดตสเตตัสจบเกมแล้วได้');
    }
};

const insertNewGame = async (winner, nonLeavePlayers) => {
    try {
        const queryRoom = `INSERT INTO rooms (user_id, player_count, play_status) VALUES (?, ?, ?)`;
        const [roomResult] = await db.query(queryRoom, [winner.user_id, nonLeavePlayers.length, 'เริ่มเกมแล้ว']);
        const newRoomId = roomResult.insertId;

        const queryGame = `INSERT INTO games (room_id) VALUES (?)`;
        const [gameResult] = await db.query(queryGame, [newRoomId]);
        const newGameId = gameResult.insertId;

        for (const player of nonLeavePlayers) {
            const queryRoomPlayer = `INSERT INTO room_players (room_id, user_id) VALUES (?, ?)`;
            await db.query(queryRoomPlayer, [newRoomId, player.user_id]);
        }

        return { newRoomId, newGameId };
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (สร้างเกมใหม่และเพิ่มผู้เล่น):', error.message);
        throw new Error('ไม่สามารถสร้างเกมใหม่ได้');
    }
};

module.exports = { getRooms, getRoomById, joinRoom, leaveRoom, getCreated, getCreator, insertRoom, deleteRoom, getRoomPlayers, updateCreator, updateRoomStatus, getRoomTimeOut, deleteRoomTimeOut, getUserBanInRoom, getUserBanInGame, updateRoomEndGame, insertNewGame }