-- MedLicensing Database Schema

-- Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Leads (CRM)
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    nik VARCHAR(16) NOT NULL,
    str_number VARCHAR(50),
    profesi VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'new',
    eligible BOOLEAN,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Database Nakes Nasional
CREATE TABLE IF NOT EXISTS database_nakes (
    id SERIAL PRIMARY KEY,
    nik VARCHAR(16) UNIQUE NOT NULL,
    nama VARCHAR(255) NOT NULL,
    profesi VARCHAR(50) NOT NULL,
    str_number VARCHAR(50),
    str_expiry_date DATE,
    sip_number VARCHAR(50),
    sip_expiry_date DATE,
    tempat_praktik JSONB,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_profesi ON leads(profesi);
CREATE INDEX IF NOT EXISTS idx_nakes_nik ON database_nakes(nik);
CREATE INDEX IF NOT EXISTS idx_nakes_sip_expiry ON database_nakes(sip_expiry_date);

-- Insert default admin (password: admin123)
INSERT INTO admin_users (email, password, name, role) 
VALUES (
    'admin@medlicensing.id', 
    '$2a$10$rKvXeQZJxZJxZJxZJxZJxOqZJxZJxZJxZJxZJxZJxZJxZJxZJxZ.', 
    'Super Admin', 
    'superadmin'
) ON CONFLICT (email) DO NOTHING;