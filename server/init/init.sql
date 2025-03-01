-- ตั้งค่า Character Set เป็น utf8mb4_general_ci สำหรับ Database
CREATE DATABASE IF NOT EXISTS animal_coup 
CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

CREATE USER 'useranimalcoup1234'@'%' IDENTIFIED BY 'passanimalcoup1234';
GRANT ALL PRIVILEGES ON *.* TO 'useranimalcoup1234'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;

DROP USER 'root'@'%';
DROP USER 'user'@'%';
FLUSH PRIVILEGES;

USE animal_coup;

-- ตั้งค่า Timezone เป็น Asia/Bangkok
SET time_zone = '+07:00';

-- ตาราง users
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    player_name VARCHAR(10) NULL,
    username VARCHAR(20) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(30) NOT NULL UNIQUE,
    permission VARCHAR(6) NOT NULL,
    usage_status BOOLEAN NOT NULL DEFAULT 0,
    last_login TIMESTAMP NULL DEFAULT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

INSERT INTO users (player_name, username, password, email, permission) VALUES ('admin', 'admin', '$argon2id$v=19$m=65536,t=3,p=1$yCMjF/VcQBDd0aDBcYQ8Eg$x0vjZdQcSCLij8WHtgPJZhkAbZQd7nOvCU7qDYHZKls', 'admin@admin.com', 'admin');
INSERT INTO users (player_name, username, password, email, permission) VALUES ('admin2', 'admin2', '$argon2id$v=19$m=65536,t=3,p=1$yCMjF/VcQBDd0aDBcYQ8Eg$x0vjZdQcSCLij8WHtgPJZhkAbZQd7nOvCU7qDYHZKls', 'admin2@admin2.com', 'admin');
INSERT INTO users (player_name, username, password, email, permission) VALUES ('admin3', 'admin3', '$argon2id$v=19$m=65536,t=3,p=1$yCMjF/VcQBDd0aDBcYQ8Eg$x0vjZdQcSCLij8WHtgPJZhkAbZQd7nOvCU7qDYHZKls', 'admin3@admin3.com', 'admin');
INSERT INTO users (player_name, username, password, email, permission) VALUES ('test', 'test', '$argon2id$v=19$m=65536,t=3,p=1$ZLzLRa17Zhe4AjF8LMVPJg$mPfvsqYINEKb7wIICShELJmN/0iZBtfoWTXZz4jt8Ws', 'test@test.com', 'member');
INSERT INTO users (player_name, username, password, email, permission) VALUES ('member', 'member', '$argon2id$v=19$m=65536,t=3,p=1$NzEYf/+2qSIBL6Ru7kcdIQ$0PAw8qr96amAkNGyZnGcDSnsSYhY28b2ELh2/9/8IP0', 'member@member.com', 'member');
INSERT INTO users (player_name, username, password, email, permission) VALUES ('member2', 'member2', '$argon2id$v=19$m=65536,t=3,p=1$NzEYf/+2qSIBL6Ru7kcdIQ$0PAw8qr96amAkNGyZnGcDSnsSYhY28b2ELh2/9/8IP0', 'member2@member2.com', 'member');
INSERT INTO users (player_name, username, password, email, permission) VALUES ('member3', 'member3', '$argon2id$v=19$m=65536,t=3,p=1$NzEYf/+2qSIBL6Ru7kcdIQ$0PAw8qr96amAkNGyZnGcDSnsSYhY28b2ELh2/9/8IP0', 'member3@member3.com', 'member');
INSERT INTO users (player_name, username, password, email, permission) VALUES ('member4', 'member4', '$argon2id$v=19$m=65536,t=3,p=1$NzEYf/+2qSIBL6Ru7kcdIQ$0PAw8qr96amAkNGyZnGcDSnsSYhY28b2ELh2/9/8IP0', 'member4@member4.com', 'member');
INSERT INTO users (player_name, username, password, email, permission) VALUES ('member5', 'member5', '$argon2id$v=19$m=65536,t=3,p=1$NzEYf/+2qSIBL6Ru7kcdIQ$0PAw8qr96amAkNGyZnGcDSnsSYhY28b2ELh2/9/8IP0', 'member5@member5.com', 'member');

-- ตาราง user_stats
CREATE TABLE user_stats (
    user_id INT PRIMARY KEY,
    game_count INT DEFAULT 0,
    game_win INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

INSERT INTO user_stats (user_id, game_count, game_win) VALUES ('3','5','4');
INSERT INTO user_stats (user_id, game_count, game_win) VALUES ('4','4','2');
INSERT INTO user_stats (user_id, game_count, game_win) VALUES ('5','5','3');
INSERT INTO user_stats (user_id, game_count, game_win) VALUES ('6','6','1');
INSERT INTO user_stats (user_id, game_count, game_win) VALUES ('7','3','1');

-- ตาราง user_bans
CREATE TABLE user_bans (
    user_id INT PRIMARY KEY,
    ban_status BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

INSERT INTO user_bans (user_id) VALUES ('3');
INSERT INTO user_bans (user_id) VALUES ('4');
INSERT INTO user_bans (user_id) VALUES ('5');
INSERT INTO user_bans (user_id) VALUES ('6');
INSERT INTO user_bans (user_id) VALUES ('7');

-- ตาราง banned_lists
CREATE TABLE banned_lists (
    user_id INT PRIMARY KEY,
    unban_date TIMESTAMP NULL DEFAULT NULL,
    banned_reason VARCHAR(24) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ตาราง rooms
CREATE TABLE rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    player_count INT NOT NULL DEFAULT 1,
    play_status VARCHAR(14) NOT NULL,
    room_status BOOLEAN NOT NULL DEFAULT 0,
    pwd_room VARCHAR(6) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ตาราง room_players
CREATE TABLE room_players (
    roomp_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT,
    user_id INT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ตาราง games
CREATE TABLE games (
    game_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ตาราง configs
CREATE TABLE configs (
    config_id INT AUTO_INCREMENT PRIMARY KEY,
    config_name VARCHAR(20) NOT NULL,
    config_value VARCHAR(20) DEFAULT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

INSERT INTO configs (config_name, config_value) VALUES ('close_time', '30');
INSERT INTO configs (config_name, config_value) VALUES ('turn_time', '60');
INSERT INTO configs (config_name, config_value) VALUES ('popup_time', '30');
INSERT INTO configs (config_name, config_value) VALUES ('ban_time', '30');