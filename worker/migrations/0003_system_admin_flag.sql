-- "Pentadbir Sistem" is a privilege flag, not a functional role, so one person
-- can be a workshop supervisor AND a system administrator.
ALTER TABLE users ADD COLUMN is_system_admin INTEGER NOT NULL DEFAULT 0;

-- Existing administrators keep full privileges through the flag and are given
-- the functional role that matches their review/approval duties.
UPDATE users
   SET is_system_admin = 1,
       role = 'penyelaras_osha'
 WHERE role = 'pentadbir_sistem';

CREATE INDEX IF NOT EXISTS idx_users_system_admin ON users(is_system_admin);
