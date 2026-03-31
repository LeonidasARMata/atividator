-- ================================================================
-- migration_v2.sql — execute no SQL Editor do Supabase
-- ================================================================

-- ── Turmas ────────────────────────────────────────────────────────
-- Gerenciadas pelo admin via painel ou API. Sem seed fixo.
CREATE TABLE IF NOT EXISTS turmas (
  id        TEXT PRIMARY KEY,   -- ex: "1A", "2B", "3C"
  ano       INTEGER NOT NULL,
  letra     TEXT    NOT NULL,
  UNIQUE (ano, letra)
);

-- ── Usuários ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT    UNIQUE NOT NULL,
  nome             TEXT    NOT NULL,          -- nome real
  username         TEXT    UNIQUE NOT NULL,   -- exibido para a turma
  turma_id         TEXT    NOT NULL REFERENCES turmas(id),
  senha_hash       TEXT    NOT NULL,
  is_admin         BOOLEAN NOT NULL DEFAULT false,
  dias_urgencia    INTEGER NOT NULL DEFAULT 3,
  materias_atencao TEXT[]  NOT NULL DEFAULT '{}',
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tarefas ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT  NOT NULL,
  materia      TEXT  NOT NULL,
  data_entrega DATE  NOT NULL,
  data_envio   DATE,
  visibilidade TEXT  NOT NULL DEFAULT 'publica'
                     CHECK (visibilidade IN ('publica','privada')),
  turma_id     TEXT  NOT NULL REFERENCES turmas(id),  -- ← isolamento por turma
  owner_id     UUID  REFERENCES users(id) ON DELETE SET NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Conclusões ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_done (
  task_id  UUID REFERENCES tasks(id)  ON DELETE CASCADE,
  user_id  UUID REFERENCES users(id)  ON DELETE CASCADE,
  feito_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

-- ── Registros ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registros (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      TEXT    NOT NULL,
  materia     TEXT    NOT NULL,
  descricao   TEXT    NOT NULL,
  fixado      BOOLEAN NOT NULL DEFAULT false,   -- admin pode fixar no topo
  turma_id    TEXT    NOT NULL REFERENCES turmas(id),
  owner_id    UUID    REFERENCES users(id) ON DELETE SET NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Imagens dos registros ─────────────────────────────────────────
-- Cada registro pode ter N imagens; o path é relativo ao Supabase Storage
CREATE TABLE IF NOT EXISTS registro_imagens (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id UUID  NOT NULL REFERENCES registros(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,   -- ex: "registros/turma-1A/uuid.jpg"
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_turma        ON users(turma_id);
CREATE INDEX IF NOT EXISTS idx_tasks_turma        ON tasks(turma_id);
CREATE INDEX IF NOT EXISTS idx_tasks_entrega      ON tasks(data_entrega);
CREATE INDEX IF NOT EXISTS idx_registros_turma    ON registros(turma_id);
CREATE INDEX IF NOT EXISTS idx_registros_fixado   ON registros(fixado);
CREATE INDEX IF NOT EXISTS idx_reg_imgs_registro  ON registro_imagens(registro_id);
CREATE INDEX IF NOT EXISTS idx_task_done_user     ON task_done(user_id);

-- ── RLS desativado (acesso via service key no backend) ────────────
ALTER TABLE turmas            DISABLE ROW LEVEL SECURITY;
ALTER TABLE users             DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_done         DISABLE ROW LEVEL SECURITY;
ALTER TABLE registros         DISABLE ROW LEVEL SECURITY;
ALTER TABLE registro_imagens  DISABLE ROW LEVEL SECURITY;

-- ── Bucket Storage ────────────────────────────────────────────────
-- Crie manualmente no painel:
-- Storage > New Bucket > nome: "registros" > Public: false

-- ── Como criar o primeiro admin ───────────────────────────────────
-- 1. Crie sua conta normalmente pelo app
-- 2. No SQL Editor do Supabase, rode:
--    UPDATE users SET is_admin = true WHERE email = 'seu@email.com';