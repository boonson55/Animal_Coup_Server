const { getConfigs, updateConfig } = require('../models/configModel');

exports.getConfigs = async (req, res) => {
    try {
        const configs = await getConfigs();
        res.status(200).json({ configs });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงค่าการตั้งค่า:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงค่าการตั้งค่าได้' });
    }
};

exports.updateConfig = async (req, res) => {
    const { close_time, turn_time, popup_time, ban_time } = req.body;

    if (!close_time || !turn_time || !popup_time || !ban_time) {
        return res.status(400).json({ error: 'กรุณาระบุระยะเวลาปิดห้อง ระยะเวลาเทิร์น ระยะเวลาป็อปอัพ และระยะเวลาแบน' });
    }

    try {
        await updateConfig(close_time, turn_time, popup_time, ban_time);
        res.status(200).json({ message: 'อัปเดตค่าการตั้งค่าเรียบร้อยแล้ว' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการอัปเดตค่าการตั้งค่า:', error.message);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตค่าการตั้งค่าได้' });
    }
};