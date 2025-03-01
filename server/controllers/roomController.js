const { getRooms, getRoomById, getRoomPlayers, joinRoom, leaveRoom, getCreated, insertRoom, deleteRoom, updateCreator, updateRoomStatus, getCreator, getRoomTimeOut, deleteRoomTimeOut, getUserBanInRoom, getUserBanInGame } = require('../models/roomModel');
const { updateRoomPlayer, onlineUsers, statusUsers } = require('../middleware/socketioMiddleware');
const { updateMemberBan } = require('../models/userModel');
const { getGameByRoomId } = require('../models/gameModel');

exports.getRooms = async (req, res) => {
    try {
        const rooms = await getRooms();
        res.status(200).json({ rooms });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลห้องได้' });
    }
};

exports.getRoomsServer = async (req, res) => {
    try {
        const rooms = await getRooms();
        return rooms;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลห้องได้' });
    }
};

exports.getRoomById = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขห้อง' });
        }

        const room = await getRoomById(id);
        res.status(200).json({ room, user_id });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลห้องได้' });
    }
};

exports.joinRoom = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { room_id } = req.body;

        if (!user_id || !room_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้ และหมายเลขห้อง' });
        }

        await joinRoom(room_id, user_id);
        await updateRoomPlayer(req.io, String(room_id));

        const rooms = await getRooms();
        req.io.emit('roomsUpdate', rooms);

        res.status(200).json({ message: 'เข้าร่วมห้องสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเข้าร่วมห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถเข้าร่วมห้องได้' });
    }
};

exports.leaveRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        if (!user_id || !id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้ และหมายเลขห้อง' });
        }

        await leaveRoom(id, user_id);
        await updateRoomPlayer(req.io, String(id));

        const rooms = await getRooms();
        req.io.emit('roomsUpdate', rooms);

        res.status(200).json({ message: 'ออกจากห้องสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการออกจากห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถออกจากห้องได้' });
    }
};

exports.insertRoom = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { room_status, pwd_room } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        if ((room_status === undefined || room_status === null) && (pwd_room === undefined || pwd_room === null)) {
            return res.status(400).json({ error: 'กรุณาระบุสถานะห้อง และรหัสผ่านห้อง' });
        }

        const existing = await getCreated(user_id);
        if (existing) {
            return res.status(400).json({ error: 'คุณได้สร้างห้องไปแล้ว' });
        }

        const id = await insertRoom(user_id, room_status, pwd_room);

        const rooms = await getRooms();
        req.io.emit('roomsUpdate', rooms);

        res.status(200).json({ id });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการสร้างห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถสร้างห้องได้' });
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขห้อง' });
        }

        const existing = await getCreator(id, user_id);
        if (!existing) {
            return res.status(400).json({ error: 'คุณไม่มีสิทธิ์ลบห้องนี้' });
        }

        await deleteRoom(id);
        req.io.to(String(id)).emit('roomDeleted');

        for (const user_id in statusUsers) {
            if (statusUsers[user_id] && statusUsers[user_id].room_id === String(id)) {
                delete statusUsers[user_id];
            }
        }

        const rooms = await getRooms();
        req.io.emit('roomsUpdate', rooms);

        res.status(200).json({ message: 'ลบห้องสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลบห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถลบห้องได้' });
    }
};

exports.deleteRoomTimeOut = async (io, room_id) => {
    try {
        const expiredRoom = await getRoomTimeOut(room_id);
        if (!expiredRoom) {
            return;
        }

        const players = await getRoomPlayers(room_id);
        await deleteRoomTimeOut(room_id);

        players.forEach(player => {
            if (onlineUsers[player.user_id]) {
                io.to(onlineUsers[player.user_id]).emit("roomTimeout");
            }
        });

        for (const user_id in statusUsers) {
            if (statusUsers[user_id] && statusUsers[user_id].room_id === String(room_id)) {
                delete statusUsers[user_id];
            }
        }

        const updatedRooms = await getRooms();
        io.emit('roomsUpdate', updatedRooms);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลบห้องเนื่องจากหมดเวลา:', error.message);
    }
};

exports.updateRoomStatus = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { room_id, status, password } = req.body;

        if (!room_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขห้อง' });
        }

        if ((status === undefined || status === null) && (password === undefined || password === null)) {
            return res.status(400).json({ error: 'กรุณาระบุสถานะห้อง และรหัสผ่านห้อง' });
        }

        const existing = await getCreator(room_id, user_id);
        if (!existing) {
            return res.status(400).json({ error: 'คุณไม่มีสิทธิ์แก้ไขสถานะห้องนี้' });
        }

        await updateRoomStatus(status, password, room_id);

        const roomDetail = await getRoomById(room_id);
        req.io.to(String(room_id)).emit('roomsDetailUpdate', roomDetail);

        const rooms = await getRooms();
        req.io.emit('roomsUpdate', rooms);

        res.status(200).json({ message: 'อัปเดตสถานะห้องสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการอัปเดตสถานะห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะห้องได้' });
    }
};

exports.updateCreator = async (req, res) => {
    try {
        const { oldCreator, user_id, room_id } = req.body;

        if (!oldCreator || !user_id || !room_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้สร้างเดิม หมายเลขผู้ใช้ใหม่ และหมายเลขห้อง' });
        }

        await updateCreator(user_id, room_id);

        const roomDetail = await getRoomById(room_id);
        req.io.to(String(room_id)).emit('roomsDetailUpdate', roomDetail);

        await updateMemberBan(oldCreator);

        await leaveRoom(room_id, oldCreator);
        await updateRoomPlayer(req.io, String(room_id));

        const rooms = await getRooms();
        req.io.emit('roomsUpdate', rooms);

        res.status(200).json({ message: 'เปลี่ยนผู้สร้างห้องสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปลี่ยนผู้สร้างห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถเปลี่ยนผู้สร้างห้องได้' });
    }
};

exports.getUserBanInRoom = async (req, res) => {
    try {
        const { user_id, ban_status } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้ และสถานะการแบน' });
        }

        if (ban_status) {
            const room = await getUserBanInRoom(user_id);
            if (!room) {
                return res.status(200).json({ message: 'ผู้ใช้ยังไม่ได้เข้าร่วมห้อง' });
            }

            if (room.creator === room.player) {
                await deleteRoom(room.room_id);
                req.io.to(onlineUsers[user_id]).emit('roomDeleted', { ban: true });
                req.io.to(String(room.room_id)).emit('roomDeleted');
                for (const user_id in statusUsers) {
                    if (statusUsers[user_id] && statusUsers[user_id].room_id === String(room.room_id)) {
                        delete statusUsers[user_id];
                    }
                }
            }

            await leaveRoom(room.room_id, user_id);
            await updateRoomPlayer(req.io, String(room.room_id));
            if (statusUsers[user_id]) {
                delete statusUsers[user_id];
            }
            if (onlineUsers[user_id]) {
                req.io.to(onlineUsers[user_id]).emit("roomRedirect", { ban: true });
            }

            const rooms = await getRooms();
            req.io.emit('roomsUpdate', rooms);
        }

        res.status(200).json({ message: 'ปลดแบนสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลห้องได้' });
    }
};

exports.getUserBanInGame = async (req, res) => {
    try {
        const { user_id, ban_status } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้ และสถานะการแบน' });
        }

        if (ban_status) {
            const room = await getUserBanInGame(user_id);
            if (!room) {
                return res.status(200).json({ message: 'ผู้ใช้ยังไม่ได้เข้าร่วมเกม' });
            }

            const game_id = await getGameByRoomId(room.room_id);
            if (!game_id) {
                return res.status(400).json({ error: 'ไม่พบเกมที่เกี่ยวข้อง' });
            }

            await leaveRoom(room.room_id, user_id);
            await updateRoomPlayer(req.io, String(room.room_id));

            if (statusUsers[user_id]) {
                delete statusUsers[user_id];
            }

            if (onlineUsers[user_id]) {
                req.io.to(onlineUsers[user_id]).emit("redirectAdminBan", { ban: true });
            }

            const rooms = await getRooms();
            req.io.emit('roomsUpdate', rooms);
        }

        res.status(200).json({ message: 'ปลดแบนสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลห้องได้' });
    }
};

exports.getUserDelInRoom = async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        const room = await getUserBanInRoom(user_id);
        if (!room) {
            return res.status(200).json({ message: 'ผู้ใช้ยังไม่ได้เข้าร่วมห้อง' });
        }

        if (room.creator === room.player) {
            await deleteRoom(room.room_id);
            req.io.to(onlineUsers[user_id]).emit('roomDeleted', { del: true });
            req.io.to(String(room.room_id)).emit('roomDeleted');
            for (const user_id in statusUsers) {
                if (statusUsers[user_id] && statusUsers[user_id].room_id === String(room.room_id)) {
                    delete statusUsers[user_id];
                }
            }
        }

        await leaveRoom(room.room_id, user_id);
        await updateRoomPlayer(req.io, String(room.room_id));
        if (statusUsers[user_id]) {
            delete statusUsers[user_id];
        }
        if (onlineUsers[user_id]) {
            req.io.to(onlineUsers[user_id]).emit("roomRedirect", { del: true });
        }

        const rooms = await getRooms();
        req.io.emit('roomsUpdate', rooms);

        res.status(200).json({ message: 'ลบผู้ใช้งานสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลห้องได้' });
    }
};

exports.getUserDelInGame = async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        const room = await getUserBanInGame(user_id);
        if (!room) {
            return res.status(200).json({ message: 'ผู้ใช้ยังไม่ได้เข้าร่วมเกม' });
        }

        const game_id = await getGameByRoomId(room.room_id);
        if (!game_id) {
            return res.status(400).json({ error: 'ไม่พบเกมที่เกี่ยวข้อง' });
        }

        await leaveRoom(room.room_id, user_id);
        await updateRoomPlayer(req.io, String(room.room_id));

        if (statusUsers[user_id]) {
            delete statusUsers[user_id];
        }

        if (onlineUsers[user_id]) {
            req.io.to(onlineUsers[user_id]).emit("redirectAdminBan");
        }

        const rooms = await getRooms();
        req.io.emit('roomsUpdate', rooms);

        res.status(200).json({ message: 'ลบผู้ใช้งานสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลห้อง:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลห้องได้' });
    }
};