const express  = require('express');
const supabase = require('../config/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── GET /api/tasks ───────────────────────────────────────────────
// Retorna tarefas da turma do usuário logado
router.get('/', async (req, res) => {
  const { turma_id, id: userId } = req.user;

  const { data, error } = await supabase
    .from('tasks')
    .select(`id,nome,materia,data_entrega,data_envio,visibilidade,
             owner_id,turma_id,criado_em,
             task_done(user_id),
             users!owner_id(username)`)
    .eq('turma_id', turma_id)
    .or(`visibilidade.eq.publica,owner_id.eq.${userId}`)
    .order('data_entrega');

  if (error) return res.status(500).json({ error: error.message });

  const mapped = data.map(t => ({
    ...t,
    done_by:   (t.task_done || []).map(d => d.user_id),
    owner_username: t.users?.username || null,
    task_done: undefined,
    users:     undefined,
  }));

  res.json(mapped);
});

// ── POST /api/tasks ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { nome, materia, data_entrega, data_envio, visibilidade } = req.body;
  if (!nome || !materia || !data_entrega)
    return res.status(400).json({ error: 'nome, materia e data_entrega são obrigatórios.' });

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      nome, materia, data_entrega,
      data_envio:   data_envio || null,
      visibilidade: visibilidade || 'publica',
      turma_id:     req.user.turma_id,
      owner_id:     req.user.id,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ...data, done_by: [] });
});

// ── PATCH /api/tasks/:id ─────────────────────────────────────────
// Dono pode editar. Admin pode alterar qualquer campo.
router.patch('/:id', async (req, res) => {
  const task = await _getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarefa não encontrada.' });

  const isOwner = task.owner_id === req.user.id;
  const isAdmin = req.user.is_admin;
  if (!isOwner && !isAdmin)
    return res.status(403).json({ error: 'Sem permissão.' });

  const { data, error } = await supabase
    .from('tasks').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/tasks/:id ────────────────────────────────────────
// Dono ou admin podem excluir
router.delete('/:id', async (req, res) => {
  const task = await _getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarefa não encontrada.' });

  const isOwner = task.owner_id === req.user.id;
  const isAdmin = req.user.is_admin;
  if (!isOwner && !isAdmin)
    return res.status(403).json({ error: 'Sem permissão.' });

  const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ── POST /api/tasks/:id/done ─────────────────────────────────────
router.post('/:id/done', async (req, res) => {
  const { error } = await supabase
    .from('task_done')
    .upsert({ task_id: req.params.id, user_id: req.user.id });
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ── DELETE /api/tasks/:id/done ───────────────────────────────────
router.delete('/:id/done', async (req, res) => {
  const { error } = await supabase
    .from('task_done')
    .delete()
    .eq('task_id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

async function _getTask(id) {
  const { data } = await supabase
    .from('tasks').select('owner_id,turma_id').eq('id', id).single();
  return data;
}

module.exports = router;