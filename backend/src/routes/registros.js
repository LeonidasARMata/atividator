const express  = require('express');
const multer   = require('multer');
const supabase = require('../config/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },  // 10MB
});

router.use(authMiddleware);

// ── GET /api/registros ───────────────────────────────────────────
// Todos os usuários da turma veem os registros (todos são públicos)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('registros')
    .select(`
      id, titulo, materia, descricao, fixado,
      data_atribuicao, arquivo_path, turma_id, owner_id, criado_em,
      users!owner_id(username),
      registro_imagens(id, storage_path)
    `)
    .eq('turma_id', req.user.turma_id)
    .order('fixado',          { ascending: false })
    .order('data_atribuicao', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const mapped = data.map(r => ({
    ...r,
    owner_username:   r.users?.username || null,
    imagens:          (r.registro_imagens || []).map(img => ({
      id:  img.id,
      url: _storageUrl(img.storage_path),
    })),
    arquivo_url: r.arquivo_path ? _storageUrl(r.arquivo_path) : null,
    users:            undefined,
    registro_imagens: undefined,
  }));

  res.json(mapped);
});

// ── POST /api/registros ──────────────────────────────────────────
// Apenas admins criam registros
router.post('/', adminMiddleware, upload.fields([
  { name: 'imagens', maxCount: 10 },
  { name: 'arquivo', maxCount: 1  },
]), async (req, res) => {
  const { titulo, materia, descricao, data_atribuicao } = req.body;

  if (!titulo || !materia)
    return res.status(400).json({ error: 'titulo e materia são obrigatórios.' });

  // Precisa de pelo menos um: descrição, imagem ou arquivo
  const temDescricao = descricao && descricao.trim().length > 0;
  const temImagem    = (req.files?.imagens?.length || 0) > 0;
  const temArquivo   = (req.files?.arquivo?.length  || 0) > 0;
  if (!temDescricao && !temImagem && !temArquivo)
    return res.status(400).json({ error: 'Preencha pelo menos descrição, imagem ou arquivo.' });

  // Insere o registro
  const { data: registro, error: rErr } = await supabase
    .from('registros')
    .insert({
      titulo,
      materia,
      descricao:       descricao || null,
      data_atribuicao: data_atribuicao || new Date().toISOString().split('T')[0],
      turma_id:        req.user.turma_id,
      owner_id:        req.user.id,
    })
    .select().single();

  if (rErr) return res.status(500).json({ error: rErr.message });

  // Upload de imagens
  const imagens = [];
  for (const file of (req.files?.imagens || [])) {
    const path = `registros/${req.user.turma_id}/${registro.id}/img-${Date.now()}-${file.originalname}`;
    const { error: upErr } = await supabase.storage
      .from('registros').upload(path, file.buffer, { contentType: file.mimetype });
    if (!upErr) {
      const { data: img } = await supabase
        .from('registro_imagens').insert({ registro_id: registro.id, storage_path: path }).select().single();
      if (img) imagens.push({ id: img.id, url: _storageUrl(path) });
    }
  }

  // Upload de arquivo
  let arquivo_url = null;
  if (req.files?.arquivo?.[0]) {
    const file = req.files.arquivo[0];
    const path = `registros/${req.user.turma_id}/${registro.id}/arq-${Date.now()}-${file.originalname}`;
    const { error: upErr } = await supabase.storage
      .from('registros').upload(path, file.buffer, { contentType: file.mimetype });
    if (!upErr) {
      await supabase.from('registros').update({ arquivo_path: path }).eq('id', registro.id);
      arquivo_url = _storageUrl(path);
    }
  }

  res.status(201).json({
    ...registro,
    imagens,
    arquivo_url,
    owner_username: req.user.username,
  });
});

// ── PATCH /api/registros/:id ─────────────────────────────────────
// Apenas admins editam
router.patch('/:id', adminMiddleware, upload.fields([
  { name: 'imagens', maxCount: 10 },
  { name: 'arquivo', maxCount: 1  },
]), async (req, res) => {
  const { titulo, materia, descricao, data_atribuicao } = req.body;
  const update = {};
  if (titulo)          update.titulo          = titulo;
  if (materia)         update.materia         = materia;
  if (descricao !== undefined) update.descricao = descricao || null;
  if (data_atribuicao) update.data_atribuicao = data_atribuicao;

  const { data, error } = await supabase
    .from('registros').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Novas imagens
  const imagens = [];
  for (const file of (req.files?.imagens || [])) {
    const path = `registros/${req.user.turma_id}/${req.params.id}/img-${Date.now()}-${file.originalname}`;
    const { error: upErr } = await supabase.storage
      .from('registros').upload(path, file.buffer, { contentType: file.mimetype });
    if (!upErr) {
      const { data: img } = await supabase
        .from('registro_imagens').insert({ registro_id: req.params.id, storage_path: path }).select().single();
      if (img) imagens.push({ id: img.id, url: _storageUrl(path) });
    }
  }

  // Novo arquivo (substitui o anterior)
  let arquivo_url = data.arquivo_path ? _storageUrl(data.arquivo_path) : null;
  if (req.files?.arquivo?.[0]) {
    if (data.arquivo_path)
      await supabase.storage.from('registros').remove([data.arquivo_path]);
    const file = req.files.arquivo[0];
    const path = `registros/${req.user.turma_id}/${req.params.id}/arq-${Date.now()}-${file.originalname}`;
    await supabase.storage.from('registros').upload(path, file.buffer, { contentType: file.mimetype });
    await supabase.from('registros').update({ arquivo_path: path }).eq('id', req.params.id);
    arquivo_url = _storageUrl(path);
  }

  res.json({ ...data, imagens, arquivo_url });
});

// ── DELETE /api/registros/:id ────────────────────────────────────
// Apenas admins excluem
router.delete('/:id', adminMiddleware, async (req, res) => {
  const { data: imgs } = await supabase
    .from('registro_imagens').select('storage_path').eq('registro_id', req.params.id);
  const { data: reg } = await supabase
    .from('registros').select('arquivo_path').eq('id', req.params.id).single();

  const paths = (imgs || []).map(i => i.storage_path);
  if (reg?.arquivo_path) paths.push(reg.arquivo_path);
  if (paths.length) await supabase.storage.from('registros').remove(paths);

  await supabase.from('registros').delete().eq('id', req.params.id);
  res.status(204).send();
});

// ── DELETE /api/registros/imagens/:imgId ─────────────────────────
router.delete('/imagens/:imgId', adminMiddleware, async (req, res) => {
  const { data: img } = await supabase
    .from('registro_imagens').select('*').eq('id', req.params.imgId).single();
  if (!img) return res.status(404).json({ error: 'Imagem não encontrada.' });
  await supabase.storage.from('registros').remove([img.storage_path]);
  await supabase.from('registro_imagens').delete().eq('id', req.params.imgId);
  res.status(204).send();
});

function _storageUrl(path) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/authenticated/registros/${path}`;
}

module.exports = router;