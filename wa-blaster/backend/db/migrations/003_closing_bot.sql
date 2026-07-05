USE unihaq;

CREATE TABLE IF NOT EXISTS products (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  device_id           VARCHAR(40) UNIQUE NOT NULL,
  nama_produk         VARCHAR(100) NOT NULL,
  harga_1             DECIMAL(10,2) NOT NULL DEFAULT 0,
  harga_pakej_3       DECIMAL(10,2) NOT NULL DEFAULT 0,
  harga_pakej_6       DECIMAL(10,2) NOT NULL DEFAULT 0,
  nama_akaun          VARCHAR(100),
  bank_1_nama         VARCHAR(50),
  bank_1_no           VARCHAR(30),
  bank_2_nama         VARCHAR(50),
  bank_2_no           VARCHAR(30),
  cod_enabled         TINYINT(1) NOT NULL DEFAULT 1,
  gambar_produk       VARCHAR(255),
  gambar_testimoni_1  VARCHAR(255),
  gambar_testimoni_2  VARCHAR(255),
  gambar_testimoni_3  VARCHAR(255),
  gambar_kajian       VARCHAR(255),
  gambar_ingredient   VARCHAR(255),
  gambar_kkm          VARCHAR(255),
  gambar_pakej        VARCHAR(255),
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_settings (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  device_id           VARCHAR(40) UNIQUE NOT NULL,
  ai_brain_enabled    TINYINT(1) NOT NULL DEFAULT 0,
  telegram_bot_token  VARCHAR(255),
  telegram_chat_id    VARCHAR(50),
  bot_sleep_start     TIME NOT NULL DEFAULT '00:00:00',
  bot_sleep_end       TIME NOT NULL DEFAULT '07:00:00',
  ad_spend_today      DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prospects (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  device_id         VARCHAR(40) NOT NULL,
  contact_id        VARCHAR(40) NULL,
  phone_number      VARCHAR(20) NOT NULL,
  nama              VARCHAR(100),
  entry_point       ENUM('landing_page', 'direct_ads') NOT NULL DEFAULT 'direct_ads',
  angle             ENUM('fokus', 'exam', 'pagi', 'baca', 'lupa') DEFAULT NULL,
  current_step      VARCHAR(50) NOT NULL DEFAULT 'detect_angle',
  nama_anak         VARCHAR(100),
  umur_anak         VARCHAR(20),
  darjah_anak       VARCHAR(20),
  pain_point        VARCHAR(255),
  temperature       ENUM('HOT', 'WARM', 'COLD') DEFAULT 'WARM',
  status            ENUM('active', 'warm', 'cold', 'closed') NOT NULL DEFAULT 'active',
  cold_attempts     TINYINT NOT NULL DEFAULT 0,
  follow_up_1h      TINYINT(1) NOT NULL DEFAULT 0,
  follow_up_24h     TINYINT(1) NOT NULL DEFAULT 0,
  follow_up_72h     TINYINT(1) NOT NULL DEFAULT 0,
  current_order_id  INT NULL,
  last_message_at   TIMESTAMP NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_device_phone (device_id, phone_number),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  prospect_id    INT NOT NULL,
  device_id      VARCHAR(40) NOT NULL,
  direction      ENUM('inbound', 'outbound') NOT NULL,
  message        TEXT,
  message_type   ENUM('text', 'image', 'button') NOT NULL DEFAULT 'text',
  image_key      VARCHAR(50),
  wa_message_id  VARCHAR(100),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  INDEX idx_prospect (prospect_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  prospect_id       INT NOT NULL,
  device_id         VARCHAR(40) NOT NULL,
  product_id        INT NOT NULL,
  pakej             ENUM('1_botol', '3_botol', '6_botol') NOT NULL,
  quantity          INT NOT NULL DEFAULT 1,
  total_price       DECIMAL(10,2) NOT NULL,
  delivery_name     VARCHAR(100),
  delivery_address  TEXT,
  payment_method    ENUM('transfer', 'cod') NOT NULL,
  status            ENUM('pending', 'confirmed', 'shipped', 'delivered') NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_prospects_status   ON prospects (status);
CREATE INDEX idx_prospects_step     ON prospects (current_step);
CREATE INDEX idx_prospects_last_msg ON prospects (last_message_at);
