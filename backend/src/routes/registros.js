const express  = require('express');
const multer   = require('multer');
const supabase = require('../config/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware);

// ── GET /api/registros ───────────────────────────────────────────
// Retorna registros da turma, com URLs das imagens
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('registros')
    .select(`id,titulo,materia,descricao,turma_id,owner_id,criado_em,
             users!owner_id(username),
             registro_imagens(id,storage_path)`)
    .eq('turma_id', req.user.turma_id)
    .order('criado_em', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const mapped = data.map(r => ({
    ...r,
    owner_username: r.users?.username || null,
    imagens: (r.registro_imagens || []).map(img => ({
      id:  img.id,
      url: _storageUrl(img.storage_path),
    })),
    users:            undefined,
    registro_imagens: undefined,
  }));

  res.json(mapped);
});

// ── POST /api/registros ──────────────────────────────────────────
// Cria registro. Imagens enviadas como multipart (campo "imagens")
router.post('/', upload.array('imagens', 10), async (req, res) => {
  const { titulo, materia, descricao } = req.body;
  if (!titulo || !materia || !descricao)
    return res.status(400).json({ error: 'titulo, materia e descricao são obrigatórios.' });

  // Insere registro
  const { data: registro, error: rErr } = await supabase
    .from('registros')
    .insert({ titulo, materia, descricao, turma_id: req.user.turma_id, owner_id: req.user.id })
    .select().single();
  if (rErr) return res.status(500).json({ error: rErr.message });

  // Upload de imagens para o Supabase Storage
  const imagens = [];
  for (const file of (req.files || [])) {
    const path = `registros/${req.user.turma_id}/${registro.id}/${Date.now()}-${file.originalname}`;
    const { error: upErr } = await supabase.storage
      .from('registros')
      .upload(path, file.buffer, { contentType: file.mimetype });

    if (!upErr) {
      const { data: img } = await supabase
        .from('registro_imagens')
        .insert({ registro_id: registro.id, storage_path: path })
        .select().single();
      if (img) imagens.push({ id: img.id, url: _storageUrl(path) });
    }
  }

  res.status(201).json({ ...registro, imagens, owner_username: req.user.username });
});

// ── PATCH /api/registros/:id ─────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const reg = await _getReg(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Registro não encontrado.' });
  if (reg.owner_id !== req.user.id && !req.user.is_admin)
    return res.status(403).json({ error: 'Sem permissão.' });

  const { titulo, materia, descricao } = req.body;
  const { data, error } = await supabase
    .from('registros').update({ titulo, materia, descricao })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/registros/:id ────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const reg = await _getReg(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Registro não encontrado.' });
  if (reg.owner_id !== req.user.id && !req.user.is_admin)
    return res.status(403).json({ error: 'Sem permissão.' });

  // Remove imagens do Storage antes de deletar o registro
  const { data: imgs } = await supabase
    .from('registro_imagens').select('storage_path').eq('registro_id', req.params.id);
  if (imgs?.length) {
    await supabase.storage.from('registros').remove(imgs.map(i => i.storage_path));
  }

  const { error } = await supabase.from('registros').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// ── POST /api/registros/:id/imagens ──────────────────────────────
// Adiciona imagens a um registro existente
router.post('/:id/imagens', upload.array('imagens', 10), async (req, res) => {
  const reg = await _getReg(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Registro não encontrado.' });
  if (reg.owner_id !== req.user.id && !req.user.is_admin)
    return res.status(403).json({ error: 'Sem permissão.' });

  const imagens = [];
  for (const file of (req.files || [])) {
    const path = `registros/${req.user.turma_id}/${req.params.id}/${Date.now()}-${file.originalname}`;
    const { error: upErr } = await supabase.storage
      .from('registros')
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (!upErr) {
      const { data: img } = await supabase
        .from('registro_imagens')
        .insert({ registro_id: req.params.id, storage_path: path })
        .select().single();
      if (img) imagens.push({ id: img.id, url: _storageUrl(path) });
    }
  }
  res.status(201).json(imagens);
});

// ── DELETE /api/registros/imagens/:imgId ─────────────────────────
router.delete('/imagens/:imgId', async (req, res) => {
  const { data: img } = await supabase
    .from('registro_imagens').select('*').eq('id', req.params.imgId).single();
  if (!img) return res.status(404).json({ error: 'Imagem não encontrada.' });

  await supabase.storage.from('registros').remove([img.storage_path]);
  await supabase.from('registro_imagens').delete().eq('id', req.params.imgId);
  res.status(204).send();
});

// ── helpers ──────────────────────────────────────────────────────
function _storageUrl(path) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/authenticated/registros/${path}`;
}

async function _getReg(id) {
  const { data } = await supabase
    .from('registros').select('owner_id,turma_id').eq('id', id).single();
  return data;
}

module.exports = router;