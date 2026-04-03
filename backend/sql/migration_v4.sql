-- ================================================================
-- migration_v4.sql — execute no SQL Editor do Supabase
-- Adiciona data_atribuicao e arquivo_path à tabela registros
-- ================================================================

ALTER TABLE registros ADD COLUMN IF NOT EXISTS data_atribuicao DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE registros ADD COLUMN IF NOT EXISTS arquivo_path    TEXT;
ALTER TABLE registros ALTER COLUMN descricao DROP NOT NULL;

COMMENT ON COLUMN registros.data_atribuicao IS 'Data em que o registro foi atribuído/criado';
COMMENT ON COLUMN registros.arquivo_path    IS 'Path do arquivo no Supabase Storage (bucket: registros)';
COMMENT ON COLUMN registros.descricao       IS 'Descrição opcional do registro';

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_registros_data_atrib ON registros(data_atribuicao DESC);