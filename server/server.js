const cors = require('cors');
const helmet = require('helmet');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const gameRoutes = require('./routes/gameRoutes');
const configRoutes = require('./routes/configRoutes');
const userController = require('./controllers/userController');
const roomController = require('./controllers/roomController');
const { socketioMiddleware } = require('./middleware/socketioMiddleware');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const http = require('http');
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 8000;
app.set("trust proxy", 1);

const origins = [
    "http://localhost:5173",
    "http://localhost:8000",
];
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || origins.includes(origin)) {
                callback(null, true);
            } else {
                console.error(`เกิดข้อผิดพลาดเกี่ยวกับ CORS: ไม่อนุญาตให้เข้าถึงจากต้นทาง ${origin}`);
                callback(new Error("การตั้งค่า CORS ไม่อนุญาตให้เข้าถึง"));
            }
        },
        credentials: true
    })
);

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
socketioMiddleware(io);

app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', roomRoutes);
app.use('/api', gameRoutes);
app.use('/api', configRoutes);

setInterval(async () => {
    try {
        await userController.updateUnbans();
        await roomController.deleteRoomTimeOut(io);
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการปลดแบนและลบห้องที่หมดเวลาโดยอัตโนมัติ:', error.message);
    }
}, 60000); // ทำงานทุก 60 วินาที

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 นาที
    max: 100, // จำกัด 100 ครั้ง ต่อ IP
    message: "มีคำขอจาก IP นี้มากเกินไป โปรดลองใหม่ภายหลัง",
});
app.use('/api', apiLimiter);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});