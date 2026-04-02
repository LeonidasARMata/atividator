-- ================================================================
-- migration_v3.sql — execute no SQL Editor do Supabase
-- Renomeia data_envio → data_atribuicao na tabela tasks
-- ================================================================

ALTER TABLE tasks RENAME COLUMN data_envio TO data_atribuicao;

-- Define data_atribuicao como NOT NULL com default hoje
-- (tarefas antigas ficarão com NULL — tudo bem, o frontend trata)
ALTER TABLE tasks ALTER COLUMN data_atribuicao SET DEFAULT CURRENT_DATE;

COMMENT ON COLUMN tasks.data_atribuicao IS 'Data em que a tarefa foi passada (início do prazo)';
COMMENT ON COLUMN tasks.data_entrega    IS 'Data limite de entrega (fim do prazo)';