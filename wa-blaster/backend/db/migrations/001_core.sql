CREATE DATABASE IF NOT EXISTS unihaq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE unihaq;

CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(40) PRIMARY KEY,
  username    VARCHAR(50) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  last_login  TIMESTAMP NULL,
  last_ip     VARCHAR(45),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
  id                    VARCHAR(40) PRIMARY KEY,
  user_id               VARCHAR(40) NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  type                  ENUM('baileys', 'meta') NOT NULL DEFAULT 'baileys',
  closing_bot_enabled   TINYINT(1) NOT NULL DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS device_meta_credentials (
  device_id         VARCHAR(40) PRIMARY KEY,
  phone_number_id   VARCHAR(100),
  access_token      TEXT,
  display_phone     VARCHAR(30),
  verified_name     VARCHAR(100),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
