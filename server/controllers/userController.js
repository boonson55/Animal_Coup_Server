const { getAllMembers, getAllAdmins, getAdminProfile, updateUserProfile, findUserByUsernameOrEmail, findUserByPlayerName, findUserByUsername, findUserByEmail, registerAdmin, registerUser, updateResetPassword, getLeaderboards, findUserStat, findUserById, updateUsage, updateUnbans, getMemberBan, getProtectBan, updateAdminBan, deleteAdmin, deleteMember, updateUnban, newResetPassword } = require('../models/userModel');
const { sendOTP, sendPassword, verifyOTP, deleteOTP } = require('../utils/otpService');

exports.getAllMembers = async (req, res) => {
    try {
        const members = await getAllMembers();
        res.status(200).json({ members });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสมาชิกได้' });
    }
};

exports.getAllAdmins = async (req, res) => {
    try {
        const admins = await getAllAdmins();
        res.status(200).json({ admins });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลแอดมิน:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลแอดมินได้' });
    }
};

exports.getAdminProfile = async (req, res) => {
    try {
        const user_id = req.user.id;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        const admin = await getAdminProfile(user_id);
        res.status(200).json({ admin });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์แอดมิน:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลโปรไฟล์แอดมินได้' });
    }
};

exports.getLeaderboards = async (req, res) => {
    try {
        const users = await getLeaderboards();
        res.status(200).json({ users });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลกระดานผู้นำ:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลกระดานผู้นำได้' });
    }
};

exports.getProtectBan = async (req, res) => {
    try {
        const user_id = req.user.id;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        const existing = await getProtectBan(user_id);
        if (!existing) {
            return res.status(200).json({ ban_status: false });
        }
        res.status(200).json({ ban_status: true });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลสถานะแบน:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถานะแบนของผู้ใช้ได้' });
    }
};

exports.getMemberBan = async (req, res) => {
    try {
        const user_id = req.user.id;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }
        const member = await getMemberBan(user_id);
        res.status(200).json({ member });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลสถานะแบนสมาชิก:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถานะแบนของสมาชิกได้' });
    }
};

exports.updateUnbans = async (req, res) => {
    try {
        await updateUnbans();
        res.status(200).json({ message: 'อัปเดตรายการปลดแบนสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการอัปเดตรายการปลดแบน:', error.message);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตรายการปลดแบนได้' });
    }
};

exports.updateUnban = async (req, res) => {
    try {
        const user_id = req.user.id;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }
        await updateUnban(user_id);
        res.status(200).json({ message: 'ปลดแบนผู้ใช้สำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการปลดแบนผู้ใช้:', error.message);
        res.status(500).json({ error: 'ไม่สามารถปลดแบนผู้ใช้ได้' });
    }
};

exports.updateUsage = async (req, res) => {
    try {
        const { user_id, usage_status } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        if (user_id === 1) {
            return res.status(400).json({ error: 'ไม่สามารถปิดการใช้งานบัญชีนี้ได้' });
        }

        const existingUser = await findUserById(user_id);
        if (!existingUser) {
            return res.status(400).json({ error: 'ไม่มีบัญชีผู้ใช้นี้' });
        }

        await updateUsage(user_id, usage_status);
        res.status(200).json({ message: 'แก้ไขสถานะการใช้งานสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการอัปเดตสถานะการใช้งาน:', error.message);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะการใช้งานได้' });
    }
};

exports.updateAdminBan = async (req, res) => {
    try {
        const { user_id, ban_status } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        const existingUser = await findUserById(user_id);
        if (!existingUser) {
            return res.status(400).json({ error: 'ไม่มีบัญชีผู้ใช้นี้' });
        }

        await updateAdminBan(user_id, ban_status);
        res.status(200).json({ message: 'แก้ไขสถานะแบนของผู้ใช้สำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการอัปเดตสถานะแบน:', error.message);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะแบนได้' });
    }
};

exports.deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        if (id === 1) {
            return res.status(400).json({ error: 'ไม่สามารถลบบัญชีนี้ได้' });
        }

        const existingUser = await findUserById(id);
        if (!existingUser) {
            return res.status(400).json({ error: 'ไม่มีบัญชีผู้ใช้นี้' });
        }

        await deleteAdmin(id);
        res.status(200).json({ message: 'ลบแอดมินสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลบแอดมิน:', error.message);
        res.status(500).json({ error: 'ไม่สามารถลบแอดมินได้' });
    }
};

exports.deleteMember = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        const existingUser = await findUserById(id);
        if (!existingUser) {
            return res.status(400).json({ error: 'ไม่มีบัญชีผู้ใช้นี้' });
        }

        await deleteMember(id);
        res.status(200).json({ message: 'ลบสมาชิกสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลบสมาชิก:', error.message);
        res.status(500).json({ error: 'ไม่สามารถลบสมาชิกได้' });
    }
};

exports.checkUserExists = async (req, res) => {
    try {
        const { username, email, player_name } = req.body;

        if (!username || !email || !player_name) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อผู้เล่น ชื่อผู้ใช้ และอีเมล' });
        }

        const existingPlayerName = await findUserByPlayerName(player_name);
        if (existingPlayerName) {
            return res.status(400).json({ error: 'ชื่อผู้เล่นนี้ถูกใช้ไปแล้ว' });
        }

        const existingUser = await findUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้ไปแล้ว' });
        }

        const existingEmail = await findUserByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ error: 'อีเมลนี้ถูกใช้ไปแล้ว' });
        }

        return res.status(200).json({ message: 'สามารถใช้ชื่อผู้เล่น ชื่อผู้ใช้ และอีเมลนี้ได้' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการตรวจสอบบัญชีผู้ใช้:', error.message);
        res.status(500).json({ error: 'ไม่สามารถตรวจสอบบัญชีผู้ใช้ได้' });
    }
};

exports.findUserStat = async (req, res) => {
    try {
        const user_id = req.user.id;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        const user = await findUserStat(user_id);
        res.status(200).json({ user });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลสถิติผู้ใช้:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถิติผู้ใช้ได้' });
    }
};

exports.findUserById = async (req, res) => {
    try {
        const user_id = req.user.id;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        const user = await findUserById(user_id);
        res.status(200).json({ user });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้:', error.message);
        res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลผู้ใช้ได้' });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { player_name, oldPlayerName, password } = req.body;

        if (!user_id) {
            return res.status(400).json({ error: 'กรุณาระบุหมายเลขผู้ใช้' });
        }

        if (!player_name || !password) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อผู้เล่นและรหัสผ่าน' });
        }

        const existingUser = await findUserById(user_id);
        if (!existingUser) {
            return res.status(400).json({ error: 'ไม่มีบัญชีผู้ใช้นี้' });
        }

        if (player_name !== oldPlayerName) {
            const existing = await findUserByPlayerName(player_name);
            if (existing) {
                return res.status(400).json({ error: 'ชื่อผู้เล่นนี้ถูกใช้ไปแล้ว' });
            }
        }

        await updateUserProfile(user_id, player_name, password);
        res.status(200).json({ message: 'อัปเดตโปรไฟล์สำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์:', error.message);
        res.status(500).json({ error: 'ไม่สามารถอัปเดตโปรไฟล์ได้' });
    }
};

exports.sendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'กรุณาระบุอีเมล' });
        }

        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'อีเมลนี้ถูกใช้ไปแล้ว' });
        }

        await sendOTP(email);
        res.status(200).json({ message: 'OTP ถูกส่งไปยังอีเมลของคุณ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการส่ง OTP:', error.message);
        res.status(500).json({ error: 'ไม่สามารถส่ง OTP ได้' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'กรุณาระบุอีเมล' });
        }

        const existingUser = await findUserByEmail(email);
        if (!existingUser) {
            return res.status(404).json({ error: 'ไม่พบอีเมลนี้ในระบบ' });
        }

        await sendOTP(email);
        res.status(200).json({ message: 'OTP ถูกส่งไปยังอีเมลของคุณ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการส่ง OTP:', error.message);
        res.status(500).json({ error: 'ไม่สามารถส่ง OTP ได้' });
    }
};

exports.verifyForgotPasswordOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!otp) {
            return res.status(400).json({ error: 'กรุณากรอก OTP' });
        }

        const existingUser = await findUserByEmail(email);
        if (!existingUser) {
            return res.status(404).json({ error: 'ไม่พบอีเมลนี้ในระบบ' });
        }

        if (!verifyOTP(email, otp)) {
            return res.status(401).json({ error: 'OTP ไม่ถูกต้อง' });
        }

        deleteOTP(email);
        res.status(200).json({ message: 'OTP ถูกต้อง โปรดดำเนินการเปลี่ยนรหัสผ่าน' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการตรวจสอบ OTP:', error.message);
        res.status(500).json({ error: 'ไม่สามารถตรวจสอบ OTP ได้' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({ error: 'กรุณาระบุอีเมลและรหัสผ่านใหม่' });
        }

        const existingUser = await findUserByEmail(email);
        if (!existingUser) {
            return res.status(404).json({ error: 'ไม่พบอีเมลนี้ในระบบ' });
        }

        await updateResetPassword(newPassword, email);
        res.status(200).json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน:', error.message);
        res.status(500).json({ error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
    }
};

exports.newResetPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'กรุณาระบุอีเมล' });
        }

        const existingUser = await findUserByEmail(email);
        if (!existingUser) {
            return res.status(404).json({ error: 'ไม่พบอีเมลนี้ในระบบ' });
        }

        const newPassword = await newResetPassword(email);

        await sendPassword(email, newPassword);
        res.status(200).json({ message: 'รหัสผ่านใหม่ถูกส่งไปยังอีเมลของคุณ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการส่งรหัสผ่านใหม่:', error.message);
        res.status(500).json({ error: 'ไม่สามารถส่งรหัสผ่านใหม่ได้' });
    }
};

exports.registerAdmin = async (req, res) => {
    try {
        const { username, password, email, usage_status } = req.body;

        if (!username || !password || !email) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ใช้ รหัสผ่าน และอีเมล' });
        }

        const existingUser = await findUserByUsernameOrEmail(username, email);
        if (existingUser) {
            return res.status(400).json({ error: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้ไปแล้ว' });
        }

        await registerAdmin(username, password, email, usage_status);
        res.status(201).json({ message: 'ลงทะเบียนแอดมินสำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลงทะเบียนผู้ใช้:', error.message);
        res.status(500).json({ error: 'ไม่สามารถลงทะเบียนผู้ใช้ได้' });
    }
};

exports.registerUser = async (req, res) => {
    try {
        const { player_name, username, password, email, otp } = req.body;

        if (!player_name || !username || !password || !email || !otp) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อผู้เล่น ชื่อผู้ใช้ รหัสผ่าน อีเมล และ OTP' });
        }

        const existing = await findUserByPlayerName(player_name);
        if (existing) {
            return res.status(400).json({ error: 'ชื่อผู้เล่นนี้ถูกใช้ไปแล้ว' });
        }

        const existingUser = await findUserByUsernameOrEmail(username, email);
        if (existingUser) {
            return res.status(400).json({ error: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้ไปแล้ว' });
        }

        if (!verifyOTP(email, otp)) {
            return res.status(401).json({ error: 'OTP ไม่ถูกต้อง' });
        }

        await registerUser(player_name, username, password, email);
        deleteOTP(email);

        res.status(201).json({ message: 'ลงทะเบียนผู้ใช้สำเร็จ' });
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการลงทะเบียนผู้ใช้:', error.message);
        res.status(500).json({ error: 'ไม่สามารถลงทะเบียนผู้ใช้ได้' });
    }
};