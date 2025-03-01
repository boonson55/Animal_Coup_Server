const { getGameCounts, insertGame } = require('../models/gameModel');
const { getCreator, getRooms } = require('../models/roomModel');

exports.getGameCounts = async (req, res) => {
    try {
        const games = await getGameCounts();
        res.status(200).json({ games });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลเกม:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลเกมได้' });
    }
};

exports.insertGame = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { room_id } = req.body;

        if (!user_id || !room_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้ และหมายเลขห้อง' });
        }

        const existing = await getCreator(room_id, user_id);
        if (!existing) {
            return res.status(400).json({ error: 'ไม่ใช่ผู้เล่นที่สร้างห้อง' });
        }

        const id = await insertGame(room_id);

        req.io.to(String(room_id)).emit('gameStarted', { game_id: String(id) });

        const rooms = await getRooms();
        req.io.emit('roomsUpdate', rooms);

        res.status(200).json({ message: 'เริ่มเกมสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเพิ่มเกม:', error.message);
        res.status(500).json({ error: 'ไม่สามารถเพิ่มเกมได้' });
    }
};