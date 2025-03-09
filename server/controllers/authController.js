const { findUserByUsername, findUserById, verifyPassword, updateLastLogin } = require('../models/userModel');
const { generateToken } = require('../utils/jwtService');

exports.loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้หรือรหัสผ่าน' });
        }

        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const isPasswordValid = await verifyPassword(user.password, password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        if (user.usage_status == 1) {
            return res.status(403).json({ error: 'บัญชีของคุณถูกระงับการใช้งาน โปรดติดต่อฝ่ายสนับสนุน' });
        }

        const token = generateToken(user);
        res.cookie('token', token, {
            httpOnly: true,
            secure: true, //false
            sameSite: 'None', //'Strict'
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 วัน
        });

        const refreshToken = generateToken(user, 'refresh');
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 15 * 24 * 60 * 60 * 1000 // 15 วัน
        });

        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ', user: { id: user.user_id, permission: user.permission } });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดขณะเข้าสู่ระบบ:', error.message);
        res.status(500).json({ error: 'ไม่สามารถเข้าสู่ระบบได้ โปรดลองอีกครั้ง' });
    }
};

exports.logoutUser = (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
        });
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
        });

        res.status(200).json({ message: 'ออกจากระบบสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดขณะออกจากระบบ:', error.message);
        res.status(500).json({ error: 'ไม่สามารถออกจากระบบได้ โปรดลองอีกครั้ง' });
    }
};

exports.checkRole = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(200).json({
                isAuthenticated: false,
                permission: null,
                token: false
            });
        }

        const user = await findUserById(req.user.id);
        if (!user || user.usage_status == 1) {
            res.clearCookie('token', {
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: true,
                sameSite: 'None',
            });
            return res.status(200).json({
                isAuthenticated: false,
                permission: null,
                token: false
            });
        }

        await updateLastLogin(req.user.id);
        res.status(200).json({
            isAuthenticated: true,
            user_id: req.user.id,
            permission: req.user.permission,
            token: true
        });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดขณะตรวจสอบสิทธิ์ของผู้ใช้:', error.message);
        res.status(500).json({
            isAuthenticated: false,
            error: 'ไม่สามารถตรวจสอบสิทธิ์ของผู้ใช้ได้ โปรดลองอีกครั้ง',
        });
    }
};
