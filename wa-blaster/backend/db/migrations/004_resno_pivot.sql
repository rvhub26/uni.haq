USE unihaq;

-- Pivot skrip closing-bot daripada Exama (anak fokus) ke Resno (sendi & tenaga dewasa)

ALTER TABLE prospects
  MODIFY COLUMN angle ENUM('kaku', 'tenaga', 'rutin') DEFAULT NULL,
  CHANGE COLUMN umur_anak tempoh_masalah VARCHAR(30),
  DROP COLUMN nama_anak,
  DROP COLUMN darjah_anak;

ALTER TABLE orders
  MODIFY COLUMN pakej ENUM('1_botol', '2_botol', '3_botol') NOT NULL;

ALTER TABLE products
  CHANGE COLUMN harga_pakej_3 harga_pakej_2 DECIMAL(10,2) NOT NULL DEFAULT 0,
  CHANGE COLUMN harga_pakej_6 harga_pakej_3 DECIMAL(10,2) NOT NULL DEFAULT 0;
