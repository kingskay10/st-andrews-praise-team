CREATE DATABASE IF NOT EXISTS praise_team CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE praise_team;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('chair','secretary','music_director','band_director','member') NOT NULL DEFAULT 'member',
    marital_status ENUM('single','married') NULL,
    phone VARCHAR(30) NULL,
    social_media VARCHAR(150) NULL,
    location VARCHAR(150) NULL,
    position VARCHAR(100) NULL,
    photo VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATETIME NOT NULL,
    location VARCHAR(200) NULL,
    poster VARCHAR(255) NULL,
    attachment VARCHAR(255) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_events_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author_id INT NOT NULL,
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_updates_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    month VARCHAR(7) NOT NULL,
    contributions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    offerings DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    recorded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_member_month (member_id, month),
    CONSTRAINT fk_finance_member FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_finance_recorder FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS department_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by INT NOT NULL,
    status ENUM('draft','pending','published') NOT NULL DEFAULT 'draft',
    published TINYINT(1) NOT NULL DEFAULT 0,
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reports_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS department_music (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    notes TEXT,
    rehearsal_date DATETIME NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_music_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS department_band (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    assignments TEXT,
    equipment TEXT,
    schedule_notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_band_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS member_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_member_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gallery_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uploader_id INT NOT NULL,
    source_type ENUM('member','event') NOT NULL DEFAULT 'member',
    source_id INT NOT NULL DEFAULT 0,
    image_path VARCHAR(255) NOT NULL,
    caption VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gallery_uploader FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gallery_photo_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    photo_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_photo_user_like (photo_id, user_id),
    CONSTRAINT fk_gallery_photo_like FOREIGN KEY (photo_id) REFERENCES gallery_photos(id) ON DELETE CASCADE,
    CONSTRAINT fk_gallery_photo_like_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gallery_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    photo_id INT NOT NULL,
    user_id INT NOT NULL,
    parent_comment_id INT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gallery_comment_photo FOREIGN KEY (photo_id) REFERENCES gallery_photos(id) ON DELETE CASCADE,
    CONSTRAINT fk_gallery_comment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_gallery_comment_parent FOREIGN KEY (parent_comment_id) REFERENCES gallery_comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gallery_comment_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    comment_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_comment_user_like (comment_id, user_id),
    CONSTRAINT fk_gallery_comment_like FOREIGN KEY (comment_id) REFERENCES gallery_comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_gallery_comment_like_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_verses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    verse_text TEXT NOT NULL,
    posted_on DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_daily_verse_member FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_finance_member_month ON finance_records(member_id, month);
CREATE INDEX idx_reports_status ON department_reports(status);
CREATE INDEX idx_reports_published ON department_reports(published);
