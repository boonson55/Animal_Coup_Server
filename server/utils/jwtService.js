const jwt = require('jsonwebtoken');
require('dotenv').config();

const generateToken = (user, type = 'access') => {
    try {
        if (!user || !user.user_id) {
            throw new Error('ไม่พบข้อมูลผู้ใช้หรือข้อมูลไม่ถูกต้อง');
        }

        const secretKey = type === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
        const exp = type === 'access' ? '7d' : '15d';

        return jwt.sign(
            { id: user.user_id, permission: user.permission, }, secretKey, { expiresIn: exp }
        );
    } catch (error) {
        console.error('ไม่สามารถสร้างโทเคนได้:', error.message);
        throw new Error('เกิดข้อผิดพลาดขณะสร้างโทเคน');
    }
};

module.exports = { generateToken };
