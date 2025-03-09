const { findUserById } = require('../models/userModel');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyGuest = (req, res, next) => {
    try {
        let token = req.cookies.token;

        if (!token) {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                req.user = null;
                return next();
            }
            throw new Error('TokenExpiredError');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการตรวจสอบโทเคน:', error.message);
        if (error.message === 'TokenExpiredError') {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                return res.status(401).json({ error: 'โทเคนหมดอายุแล้ว และไม่มีรีเฟรชโทเคน' });
            }

            try {
                const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

                const newToken = jwt.sign(
                    {
                        id: decodedRefresh.id,
                        permission: decodedRefresh.permission,
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '3d' }
                );

                res.cookie('token', newToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None',
                    maxAge: 3 * 24 * 60 * 60 * 1000
                });

                req.user = jwt.verify(newToken, process.env.JWT_SECRET);
                return next();
            } catch (refreshErr) {
                console.error('ไม่สามารถใช้รีเฟรชโทเคนได้:', refreshErr.message);
                return res.status(403).json({ error: 'รีเฟรชโทเคนไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
            }
        }
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
};

const verifyToken = (req, res, next) => {
    try {
        let token = req.cookies.token;

        if (!token) {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                return res.status(401).json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' });
            }
            throw new Error('TokenExpiredError');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการตรวจสอบโทเคน:', error.message);
        if (error.message === 'TokenExpiredError') {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                return res.status(401).json({ error: 'โทเคนหมดอายุแล้ว และไม่มีรีเฟรชโทเคน' });
            }

            try {
                const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

                const newToken = jwt.sign(
                    {
                        id: decodedRefresh.id,
                        permission: decodedRefresh.permission,
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '7d' }
                );

                res.cookie('token', newToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None',
                    maxAge: 7 * 24 * 60 * 60 * 1000
                });

                req.user = jwt.verify(newToken, process.env.JWT_SECRET);
                return next();
            } catch (refreshErr) {
                console.error('ไม่สามารถใช้รีเฟรชโทเคนได้:', refreshErr.message);
                return res.status(403).json({ error: 'รีเฟรชโทเคนไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
            }
        }
        return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (req.user && req.user.permission && roles.includes(req.user.permission)) {
            next();
        } else {
            return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' });
        }
    };
};

module.exports = { verifyGuest, verifyToken, requireRole };
