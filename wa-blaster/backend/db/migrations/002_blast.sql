USE unihaq;

CREATE TABLE IF NOT EXISTS contacts (
  id          VARCHAR(40) PRIMARY KEY,
  device_id   VARCHAR(40) NOT NULL,
  nama        VARCHAR(100),
  telefon     VARCHAR(20) NOT NULL,
  kumpulan    VARCHAR(50) NOT NULL DEFAULT 'Umum',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_device_phone (device_id, telefon),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blacklist (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  device_id  VARCHAR(40) NOT NULL,
  telefon    VARCHAR(20) NOT NULL,
  nama       VARCHAR(100),
  sebab      VARCHAR(255),
  added_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_device_phone (device_id, telefon),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS templates (
  id          VARCHAR(40) PRIMARY KEY,
  user_id     VARCHAR(40) NOT NULL,
  name        VARCHAR(100),
  text        TEXT,
  media_file  VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedules (
  id               VARCHAR(40) PRIMARY KEY,
  device_id        VARCHAR(40) NOT NULL,
  use_rotation     TINYINT(1) NOT NULL DEFAULT 0,
  template_ids     JSON,
  rotation_index   INT NOT NULL DEFAULT 0,
  template         TEXT,
  media_file       VARCHAR(255),
  type             ENUM('one-time', 'recurring') NOT NULL DEFAULT 'one-time',
  datetime         DATETIME NULL,
  pattern          JSON,
  contacts         JSON,
  contact_gap_ms   INT NOT NULL DEFAULT 4000,
  template_gap_ms  INT NOT NULL DEFAULT 0,
  batch_size       INT NOT NULL DEFAULT 0,
  batch_gap_ms     INT NOT NULL DEFAULT 0,
  history_only     TINYINT(1) NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS queue (
  id              VARCHAR(60) PRIMARY KEY,
  device_id       VARCHAR(40) NOT NULL,
  schedule_id     VARCHAR(40) NULL,
  nama            VARCHAR(100),
  telefon         VARCHAR(20) NOT NULL,
  template_id     VARCHAR(40) NULL,
  template_text   TEXT,
  media_file      VARCHAR(255) NULL,
  send_at         DATETIME NOT NULL,
  status          ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  sent_at         DATETIME NULL,
  delivered_at    DATETIME NULL,
  read_at         DATETIME NULL,
  error           VARCHAR(255) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_device_status_sendat (device_id, status, send_at)
);

CREATE TABLE IF NOT EXISTS logs (
  id             VARCHAR(40) PRIMARY KEY,
  device_id      VARCHAR(40) NOT NULL,
  schedule_id    VARCHAR(40) NULL,
  template_id    VARCHAR(40) NULL,
  template_text  TEXT,
  blast_at       DATETIME,
  sent           INT NOT NULL DEFAULT 0,
  failed         INT NOT NULL DEFAULT 0,
  details        JSON,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales (
  id          VARCHAR(40) PRIMARY KEY,
  device_id   VARCHAR(40) NOT NULL,
  telefon     VARCHAR(20),
  nama        VARCHAR(100),
  amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes       VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS replies (
  device_id     VARCHAR(40) NOT NULL,
  phone_number  VARCHAR(20) NOT NULL,
  nama          VARCHAR(100),
  replied_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  manual        TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, phone_number),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_threads (
  device_id      VARCHAR(40) NOT NULL,
  phone_number   VARCHAR(20) NOT NULL,
  first_seen_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (device_id, phone_number),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sent_history (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  device_id     VARCHAR(40) NOT NULL,
  phone_number  VARCHAR(20) NOT NULL,
  template_id   VARCHAR(40) NOT NULL,
  sent_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_sent (device_id, phone_number, template_id),
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
