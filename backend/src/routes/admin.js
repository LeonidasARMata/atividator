const express  = require('express');
const supabase = require('../config/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

// ══════════════════════════════════════════════════════════════════
// TURMAS
// ══════════════════════════════════════════════════════════════════

router.get('/turmas', async (_req, res) => {
  const { data, error } = await supabase
    .from('turmas').select('id, ano, letra').order('ano').order('letra');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/turmas', async (req, res) => {
  const { ano, letra } = req.body;
  if (!ano || !letra)
    return res.status(400).json({ error: 'ano e letra são obrigatórios.' });

  const id = `${ano}${letra.toUpperCase()}`;
  const { data, error } = await supabase
    .from('turmas').insert({ id, ano: parseInt(ano), letra: letra.toUpperCase() })
    .select().single();

  if (error) return res.status(409).json({ error: 'Turma já existe ou dados inválidos.' });
  res.status(201).json(data);
});

router.delete('/turmas/:id', async (req, res) => {
  const { data: users } = await supabase
    .from('users').select('id').eq('turma_id', req.params.id).limit(1);
  if (users?.length)
    return res.status(409).json({ error: 'Turma possui usuários. Mova-os antes de excluir.' });

  const { error } = await supabase.from('turmas').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ══════════════════════════════════════════════════════════════════
// USUÁRIOS
// ══════════════════════════════════════════════════════════════════

router.get('/users', async (_req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, nome, username, turma_id, is_admin, criado_em')
    .order('turma_id').order('nome');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/users/:id', async (req, res) => {
  const allowed = ['turma_id', 'is_admin', 'nome', 'username'];
  const update  = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  if (!Object.keys(update).length)
    return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' });

  if (update.turma_id) {
    const { data: t } = await supabase
      .from('turmas').select('id').eq('id', update.turma_id).single();
    if (!t) return res.status(400).json({ error: 'Turma inválida.' });
  }

  const { data, error } = await supabase
    .from('users').update(update).eq('id', req.params.id)
    .select('id, email, nome, username, turma_id, is_admin').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/users/:id', async (req, res) => {
  const { error } = await supabase.from('users').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ══════════════════════════════════════════════════════════════════
// TAREFAS
// ══════════════════════════════════════════════════════════════════

router.get('/tasks', async (_req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, nome, materia, data_entrega, visibilidade, turma_id, owner_id, criado_em, users!owner_id(username)')
    .order('turma_id').order('data_entrega');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(t => ({ ...t, owner_username: t.users?.username, users: undefined })));
});

router.delete('/tasks/:id', async (req, res) => {
  const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ══════════════════════════════════════════════════════════════════
// REGISTROS — fixar/desafixar
// ══════════════════════════════════════════════════════════════════

router.patch('/registros/:id/fixar', async (req, res) => {
  const { data: reg } = await supabase
    .from('registros').select('fixado').eq('id', req.params.id).single();
  if (!reg) return res.status(404).json({ error: 'Registro não encontrado.' });

  const { data, error } = await supabase
    .from('registros').update({ fixado: !reg.fixado })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;