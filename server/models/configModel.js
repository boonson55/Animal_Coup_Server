const db = require('../config/db');

const getConfigs = async () => {
    try {
        const query = 'SELECT config_name, config_value FROM configs';
        const [rows] = await db.query(query);
        return rows;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (ดึงค่าการตั้งค่าทั้งหมด):', error.message);
        throw new Error('ไม่สามารถดึงค่าการตั้งค่าได้');
    }
};

const updateConfig = async (close_time, turn_time, popup_time, ban_time) => {
    const con = await db.getConnection();
    try {
        await con.beginTransaction();

        const query = `
            UPDATE configs
            SET config_value = CASE config_id
                WHEN 1 THEN ?
                WHEN 2 THEN ?
                WHEN 3 THEN ?
                WHEN 4 THEN ?
            END
            WHERE config_id IN (1, 2, 3, 4)
        `;
        await con.query(query, [close_time, turn_time, popup_time, ban_time]);

        await con.commit();
    } catch (error) {
        await con.rollback();
        console.error('เกิดข้อผิดพลาดของฐานข้อมูล (อัปเดตค่าการตั้งค่า):', error.message);
        throw new Error('ไม่สามารถอัปเดตค่าการตั้งค่าได้');
    } finally {
        con.release();
    }
};

module.exports = { getConfigs, updateConfig };
