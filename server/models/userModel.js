const db = require('../config/db');
const argon2 = require('argon2');

const hashPassword = async (password) => {
    return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,   // ปริมาณหน่วยความจำ 64 MB
        timeCost: 3,           // เวลาที่ใช้ในการคำนวณ Hash
        parallelism: 1         // จำนวน threads
    });
};

const getAllMembers = async () => {
    try {
        const query = `SELECT *, users.user_id FROM users
        LEFT JOIN user_bans ON users.user_id = user_bans.user_id
        LEFT JOIN banned_lists ON user_bans.user_id = banned_lists.user_id
        WHERE users.permission = "member"`;
        const [rows] = await db.query(query);
        return rows;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงข้อมูลสมาชิกทั้งหมด):', error.message);
        throw new Error('ไม่สามารถดึงข้อมูลสมาชิกทั้งหมดได้');
    }
};

const getAllAdmins = async () => {
    try {
        const query = 'SELECT * FROM users WHERE permission = "admin"';
        const [rows] = await db.query(query);
        return rows;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงข้อมูลแอดมินทั้งหมด):', error.message);
        throw new Error('ไม่สามารถดึงข้อมูลแอดมินทั้งหมดได้');
    }
};

const getAdminProfile = async (user_id) => {
    try {
        const query = 'SELECT * FROM users WHERE user_id = ? AND permission = "admin"';
        const [rows] = await db.query(query, [user_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ค้นหาโปรไฟล์แอดมินโดยหมายเลขผู้ใช้):', error.message);
        throw new Error('ไม่สามารถค้นหาโปรไฟล์แอดมินได้');
    }
};

const findUserByUsernameOrEmail = async (username, email) => {
    try {
        const query = 'SELECT * FROM users WHERE username = ? OR email = ?';
        const [rows] = await db.query(query, [username, email]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ค้นหาผู้ใช้โดยชื่อผู้ใช้หรืออีเมล):', error.message);
        throw new Error('ไม่สามารถค้นหาผู้ใช้ได้');
    }
};

const findUserByPlayerName = async (player_name) => {
    try {
        const query = 'SELECT * FROM users WHERE player_name = ?';
        const [rows] = await db.query(query, [player_name]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ค้นหาผู้ใช้โดยชื่อผู้เล่น):', error.message);
        throw new Error('ไม่สามารถค้นหาผู้ใช้ได้');
    }
};

const findUserByUsername = async (username) => {
    try {
        const query = 'SELECT * FROM users WHERE username = ?';
        const [rows] = await db.query(query, [username]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ค้นหาผู้ใช้โดยชื่อผู้ใช้):', error.message);
        throw new Error('ไม่สามารถค้นหาผู้ใช้ได้');
    }
};

const findUserByEmail = async (email) => {
    try {
        const query = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await db.query(query, [email]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ค้นหาผู้ใช้โดยอีเมล):', error.message);
        throw new Error('ไม่สามารถค้นหาผู้ใช้ได้');
    }
};

const registerAdmin = async (username, password, email, usage_status) => {
    try {
        const hashedPassword = await hashPassword(password);
        const query = `INSERT INTO users (player_name, username, password, email, permission, usage_status) VALUES (?, ?, ?, ?, ?, ?)`;
        await db.query(query, [null, username, hashedPassword, email, 'admin', usage_status]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ลงทะเบียนแอดมิน):', error.message);
        throw new Error('ไม่สามารถลงทะเบียนแอดมินได้');
    }
};

const updateUnbans = async () => {
    try {
        const [expiredBans] = await db.query(`SELECT user_id FROM banned_lists WHERE unban_date < NOW()`);

        if (expiredBans.length === 0) {
            return { message: "ไม่พบรายการปลดแบนที่หมดอายุ" };
        }

        const userIds = expiredBans.map((ban) => ban.user_id);

        const queryDel = 'DELETE FROM banned_lists WHERE unban_date < NOW()';
        await db.query(queryDel);
        const queryUp = 'UPDATE user_bans SET ban_status = 0 WHERE user_id IN (?)';
        await db.query(queryUp, [userIds]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตรายการปลดแบนทั้งหมด):', error.message);
        throw new Error('ไม่สามารถอัปเดตรายการปลดแบน');
    }
};

const updateUnban = async (user_id) => {
    try {
        const querySel = `SELECT * FROM banned_lists WHERE unban_date < NOW() AND user_id = ?`;
        const [result] = await db.query(querySel, [user_id]);
        if (result.length > 0) {
            const queryDel = 'DELETE FROM banned_lists WHERE user_id = ?';
            await db.query(queryDel, [user_id]);
            const queryUp = 'UPDATE user_bans SET ban_status = 0 WHERE user_id = ?';
            await db.query(queryUp, [user_id]);
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ปลดแบนผู้ใช้):', error.message);
        throw new Error('ไม่สามารถดำเนินการปลดแบนผู้ใช้');
    }
};

const registerUser = async (player_name, username, password, email) => {
    const con = await db.getConnection();

    try {
        await con.beginTransaction();

        const hashedPassword = await hashPassword(password);

        const queryUser = `
            INSERT INTO users (player_name, username, password, email, permission)
            VALUES (?, ?, ?, ?, ?)
        `;
        const [userResult] = await con.query(queryUser, [player_name, username, hashedPassword, email, 'member']);

        const userId = userResult.insertId;

        const queryStats = `INSERT INTO user_stats (user_id) VALUES (?)`;
        const queryBans = `INSERT INTO user_bans (user_id) VALUES (?)`;
        await con.query(queryStats, [userId]);
        await con.query(queryBans, [userId]);

        await con.commit();

        return { userId, message: 'ลงทะเบียนผู้ใช้สำเร็จ' };
    } catch (error) {
        await con.rollback();
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ลงทะเบียนผู้ใช้):', error.message);
        throw new Error('ไม่สามารถลงทะเบียนผู้ใช้ได้');
    } finally {
        con.release();
    }
};

const verifyPassword = async (hashedPassword, inputPassword) => {
    try {
        return await argon2.verify(hashedPassword, inputPassword);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน:', error.message);
        return false;
    }
};

const updateLastLogin = async (userId) => {
    try {
        const query = 'UPDATE users SET last_login = NOW() WHERE user_id = ?';
        await db.query(query, [userId]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตการเข้าสู่ระบบล่าสุด):', error.message);
        throw new Error('ไม่สามารถอัปเดตการเข้าสู่ระบบล่าสุดได้');
    }
};

const updateResetPassword = async (newPassword, email) => {
    try {
        const hashedPassword = await hashPassword(newPassword);
        const query = 'UPDATE users SET password = ? WHERE email = ?';
        await db.query(query, [hashedPassword, email]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (รีเซ็ตรหัสผ่าน):', error.message);
        throw new Error('ไม่สามารถรีเซ็ตรหัสผ่านได้');
    }
};

const getLeaderboards = async () => {
    try {
        const query = `SELECT u.player_name, s.game_count, s.game_win 
        FROM user_stats s LEFT JOIN users u ON s.user_id = u.user_id
        WHERE s.game_count > 0
        ORDER BY s.game_win DESC LIMIT 10
        `;
        const [rows] = await db.query(query);
        return rows;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงข้อมูลกระดานผู้นำ):', error.message);
        throw new Error('ไม่สามารถดึงข้อมูลกระดานผู้นำได้');
    }
};

const findUserStat = async (user_id) => {
    try {
        const query = 'SELECT * FROM users u LEFT JOIN user_stats s ON u.user_id = s.user_id WHERE u.user_id = ? AND permission = "member"';
        const [rows] = await db.query(query, [user_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ค้นหาสถิติผู้ใช้):', error.message);
        throw new Error('ไม่สามารถค้นหาสถิติของผู้ใช้ได้');
    }
};

const updateUserProfile = async (user_id, player_name, password) => {
    try {
        if (password !== "oldPassword") {
            const hashedPassword = await hashPassword(password);
            const query = 'UPDATE users SET player_name = ?, password = ? WHERE user_id = ?';
            await db.query(query, [player_name, hashedPassword, user_id]);
        } else {
            const query = 'UPDATE users SET player_name = ? WHERE user_id = ?';
            await db.query(query, [player_name, user_id]);
        }
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตโปรไฟล์ผู้ใช้):', error.message);
        throw new Error('ไม่สามารถอัปเดตโปรไฟล์ผู้ใช้ได้');
    }
};

const findUserById = async (user_id) => {
    try {
        const query = 'SELECT user_id, usage_status FROM users WHERE user_id = ?';
        const [rows] = await db.query(query, [user_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ค้นหาผู้ใช้โดย ID):', error.message);
        throw new Error('ไม่สามารถค้นหาข้อมูลผู้ใช้ได้');
    }
};

const updateUsage = async (user_id, usage_status) => {
    try {
        const query = 'UPDATE users SET usage_status = ? WHERE user_id = ?';
        await db.query(query, [!usage_status, user_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตสถานะการใช้งาน):', error.message);
        throw new Error('ไม่สามารถอัปเดตสถานะการใช้งานของผู้ใช้ได้');
    }
};

const updateAdminBan = async (user_id, ban_status) => {
    try {
        if (ban_status) {
            const query = `INSERT INTO banned_lists (user_id, unban_date, banned_reason)
             VALUES (?, DATE_ADD(NOW(), INTERVAL (SELECT config_value FROM configs WHERE config_name = 'ban_time') MINUTE), ?)`;
            await db.query(query, [user_id, 'คุณถูกแบนโดยผู้ดูแลระบบ']);
        } else {
            const query = 'DELETE FROM banned_lists WHERE user_id = ?';
            await db.query(query, [user_id]);
        }
        const query = 'UPDATE user_bans SET ban_status = ? WHERE user_id = ?';
        await db.query(query, [ban_status, user_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตสถานะแบนโดยแอดมิน):', error.message);
        throw new Error('ไม่สามารถอัปเดตสถานะแบนของผู้ใช้ได้');
    }
};

const updateMemberBan = async (user_id) => {
    try {
        const queryInsert = `INSERT INTO banned_lists (user_id, unban_date, banned_reason)
             VALUES (?, DATE_ADD(NOW(), INTERVAL (SELECT config_value FROM configs WHERE config_name = 'ban_time') MINUTE), ?)`;
        await db.query(queryInsert, [user_id, 'AFK ในหน้าห้องรอเริ่มเกม']);
        const queryUpdate = 'UPDATE user_bans SET ban_status = 1 WHERE user_id = ?';
        await db.query(queryUpdate, [user_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (แบนสมาชิกในหน้าห้องรอเริ่มเกม):', error.message);
        throw new Error('ไม่สามารถแบนสมาชิกได้');
    }
};

const updateBanInGame = async (user_id) => {
    try {
        const queryInsert = `INSERT INTO banned_lists (user_id, unban_date, banned_reason)
             VALUES (?, DATE_ADD(NOW(), INTERVAL (SELECT config_value FROM configs WHERE config_name = 'ban_time') MINUTE), ?)`;
        await db.query(queryInsert, [user_id, 'AFK ในหน้าเล่นเกม']);
        const queryUpdate = 'UPDATE user_bans SET ban_status = 1 WHERE user_id = ?';
        await db.query(queryUpdate, [user_id]);

    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (แบนสมาชิกในหน้าเล่นเกม):', error.message);
        throw new Error('ไม่สามารถแบนสมาชิกได้');
    }
};

const getMemberBan = async (user_id) => {
    try {
        const query = `SELECT * 
        FROM user_bans LEFT JOIN banned_lists ON user_bans.user_id = banned_lists.user_id
        WHERE user_bans.user_id = ?`;
        const [rows] = await db.query(query, [user_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงข้อมูลแบนสมาชิก):', error.message);
        throw new Error('ไม่สามารถดึงข้อมูลสถานะแบนของสมาชิกได้');
    }
};

const getProtectBan = async (user_id) => {
    try {
        const query = `SELECT ban_status FROM user_bans WHERE user_id = ? AND ban_status = 1`;
        const [rows] = await db.query(query, [user_id]);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ตรวจสอบสถานะแบน):', error.message);
        throw new Error('ไม่สามารถตรวจสอบสถานะแบนของผู้ใช้ได้');
    }
};

const deleteAdmin = async (user_id) => {
    try {
        const query = 'DELETE FROM users WHERE user_id = ? AND permission = "admin"';
        const [result] = await db.query(query, [user_id]);
        if (result.affectedRows === 0) {
            return { message: 'ไม่พบแอดมินที่ต้องการลบ' };
        }
        return { message: 'ลบแอดมินสำเร็จ' };
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ลบแอดมิน):', error.message);
        throw new Error('ไม่สามารถลบแอดมินได้');
    }
};

const deleteMember = async (user_id) => {
    try {
        const query = 'DELETE FROM users WHERE user_id = ? AND permission = "member"';
        const [result] = await db.query(query, [user_id]);
        if (result.affectedRows === 0) {
            return { message: 'ไม่พบสมาชิกที่ต้องการลบ' };
        }
        return { message: 'ลบสมาชิกสำเร็จ' };
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ลบสมาชิก):', error.message);
        throw new Error('ไม่สามารถลบสมาชิกได้');
    }
};

const generateRandomPassword = (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const newResetPassword = async (email) => {
    try {
        const newPassword = generateRandomPassword(10);
        const hashedPassword = await hashPassword(newPassword);

        const query = 'UPDATE users SET password = ? WHERE email = ?';
        const [result] = await db.query(query, [hashedPassword, email]);

        if (result.affectedRows === 0) {
            throw new Error('ไม่พบผู้ใช้ที่มีอีเมลนี้');
        }

        return newPassword;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (รีเซ็ตรหัสผ่านแบบสุ่ม):', error.message);
        throw new Error('ไม่สามารถรีเซ็ตรหัสผ่านได้');
    }
};

const updateStatLose = async (user_id) => {
    try {
        const query = 'UPDATE user_stats SET game_count = game_count + 1 WHERE user_id = ?';
        await db.query(query, [user_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตสถิติผู้เล่นที่แพ้):', error.message);
        throw new Error('ไม่สามารถอัปเดตสถิติผู้เล่นที่แพ้ได้');
    }
};

const updateStatWin = async (user_id) => {
    try {
        const query = 'UPDATE user_stats SET game_count = game_count + 1, game_win = game_win + 1 WHERE user_id = ?';
        await db.query(query, [user_id]);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตสถิติผู้เล่นที่ชนะ):', error.message);
        throw new Error('ไม่สามารถอัปเดตสถิติผู้เล่นที่ชนะได้');
    }
};

module.exports = { getAllMembers, getAllAdmins, getAdminProfile, findUserByUsernameOrEmail, findUserByPlayerName, findUserByUsername, findUserByEmail, registerAdmin, updateUnbans, registerUser, verifyPassword, updateLastLogin, updateResetPassword, getLeaderboards, findUserStat, getMemberBan, updateUserProfile, findUserById, updateUsage, updateAdminBan, updateMemberBan, updateBanInGame, getProtectBan, deleteAdmin, deleteMember, newResetPassword, updateUnban, updateStatLose, updateStatWin };
