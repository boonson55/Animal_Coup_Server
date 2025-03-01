const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const otpStore = new Map();
const otpExpiryTime = 3 * 60 * 1000; // 3 นาที

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const generateOTP = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';

    let otpLetters = Array.from({ length: 3 }, () =>
        letters.charAt(crypto.randomInt(0, letters.length))
    ).join('');

    let otpDigits = Array.from({ length: 3 }, () =>
        digits.charAt(crypto.randomInt(0, digits.length))
    ).join('');

    let combinedOTP = otpLetters + otpDigits;

    return combinedOTP.split('').sort(() => Math.random() - 0.5).join('');
};

const sendOTP = async (email) => {
    if (!isValidEmail(email)) {
        throw new Error('กรุณากรอกอีเมลให้ถูกต้อง');
    }

    const otp = generateOTP(6);

    if (otpStore.has(email)) {
        otpStore.delete(email);
    }

    otpStore.set(email, otp);
    setTimeout(() => otpStore.delete(email), otpExpiryTime);

    const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',  // SMTP Host
        port: 587,                  // Port สำหรับ TLS
        secure: false,              // false สำหรับ TLS (STARTTLS)
        auth: {
            user: process.env.EMAIL_USER, // อีเมลผู้ส่ง (บัญชี Office 365)
            pass: process.env.EMAIL_PASS  // รหัสผ่านผู้ส่ง (บัญชี Office 365)
        },
        tls: {
            ciphers: 'SSLv3' // ระบุ cipher suite สำหรับการเข้ารหัส
        }
    });

    const mailOptions = {
        from: 'Project Coup <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'รหัส OTP ของคุณ',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
            <p style="font-size: 18px; font-weight: bold;">รหัส OTP ของคุณคือ</p>
            <p style="font-size: 24px; font-weight: bold; color: #d9534f;">${otp}</p>
            <p style="font-size: 18px; font-weight: bold;">รหัสนี้จะหมดอายุใน 3 นาที</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(`ไม่สามารถส่ง OTP ไปยัง ${email}:`, error.message);
        otpStore.delete(email);
        throw new Error('เกิดข้อผิดพลาดในการส่ง OTP กรุณาลองใหม่อีกครั้ง');
    }
};

const sendPassword = async (email, newPassword) => {
    if (!isValidEmail(email)) {
        throw new Error('กรุณากรอกอีเมลให้ถูกต้อง');
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            ciphers: 'SSLv3'
        }
    });

    const mailOptions = {
        from: 'Project Coup <' + process.env.EMAIL_USER + '>',
        to: email,
        subject: 'รหัสผ่านใหม่ของคุณ',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
            <p style="font-size: 18px; font-weight: bold;">รหัสผ่านใหม่ของคุณคือ</p>
            <p style="font-size: 24px; font-weight: bold; color: #d9534f;">${newPassword}</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(`ไม่สามารถส่งรหัสผ่านใหม่ไปยัง ${email}:`, error.message);
        otpStore.delete(email);
        throw new Error('เกิดข้อผิดพลาดในการส่งรหัสผ่านใหม่ กรุณาลองใหม่อีกครั้ง');
    }
};

const verifyOTP = (email, otp) => {
    const storedOTP = otpStore.get(email);
    return storedOTP === otp;
};

const deleteOTP = (email) => {
    otpStore.delete(email);
};

module.exports = { sendOTP, sendPassword, verifyOTP, deleteOTP };
