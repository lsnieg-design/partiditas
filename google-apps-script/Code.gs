/**
 * PARTIDITAS — backend de Google Apps Script
 * Hojas creadas automáticamente: Groups, Games, Rounds, Rules.
 * IMPORTANTE: este script no reemplaza controles de acceso robustos. 
 */
const SHEETS = {
  Groups: ['id','name','accessCodeHash','createdAt','rulesJson'],
  Games: ['id','groupId','gameId','gameName','title','playersJson','rulesJson','status','createdAt','finishedAt','winner'],
  Rounds: ['id','groupId','gameId','roundNumber','scoresJson','note','createdAt'],
  Rules: ['groupId','rulesJson','updatedAt']
};
const DEFAULT_RULES = {
  chinchon: { target: 100, direction: 'lower', unit: 'puntos', roundBased: true, chinchonBonus: 10, endAtTarget: true },
  escoba: { target: 15, direction: 'higher', unit: 'tantos', roundBased: true, scoringMode: 'escoba-15', pointsPerEscoba: 1 },
  truco: { target: 30, direction: 'higher', unit: 'tantos', roundBased: true, scoringMode: 'truco-teams', splitAt: 15 },
  rummy: { target: 100, direction: 'lower', unit: 'puntos', roundBased: true, scoringMode: 'card-penalties' },
  libre: { target: 0, direction: 'higher', unit: 'puntos', roundBased: true }
};

function doGet() {
  return json_({ ok: true, service: 'Partiditas API', message: 'API disponible. Enviá POST con una acción.' });
}
function doPost(e) {
  try {
    const input = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_(dispatch_(input));
  } catch (err) {
    return json_({ ok: false, error: err.message || 'Error inesperado.' });
  }
}
function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function dispatch_(x) {
  ensureSheets_();
  switch (x.action) {
    case 'listGroups': return listGroups_();
    case 'createGroup': return createGroup_(x);
    case 'getGroup': return getGroup_(x);
    case 'createGame': return createGame_(x);
    case 'addRound': return addRound_(x);
    case 'finishGame': return finishGame_(x);
    case 'saveRules': return saveRules_(x);
    default: throw new Error('Acción desconocida: ' + x.action);
  }
}
function db_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Falta SPREADSHEET_ID en las propiedades del script. Seguí el README.');
  return SpreadsheetApp.openById(id);
}
function ensureSheets_() {
  const ss = db_();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
  });
}
function rows_(name) {
  const sh = db_().getSheetByName(name), values = sh.getDataRange().getValues();
  const headers = values.shift() || [];
  return values.filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(headers.map((h,i) => [h, r[i]])));
}
function append_(name, obj) {
  const sh = db_().getSheetByName(name), headers = SHEETS[name];
  sh.appendRow(headers.map(h => obj[h] === undefined ? '' : obj[h]));
}
function updateById_(name, key, value, patch) {
  const sh = db_().getSheetByName(name), values = sh.getDataRange().getValues(), headers = values[0];
  const rowIndex = values.findIndex((r,i) => i > 0 && String(r[headers.indexOf(key)]) === String(value));
  if (rowIndex < 1) throw new Error('No se encontró el registro.');
  Object.keys(patch).forEach(k => { const col = headers.indexOf(k); if (col >= 0) sh.getRange(rowIndex + 1, col + 1).setValue(patch[k]); });
}
function id_() { return Utilities.getUuid(); }
function now_() { return new Date().toISOString(); }
function hash_(value) { return value ? Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value))) : ''; }
function groupById_(id) { return rows_('Groups').find(g => String(g.id) === String(id)); }
function checkGroup_(x) {
  const group = groupById_(x.groupId);
  if (!group) throw new Error('No encontramos esa mesa. Revisá el ID.');
  if (group.accessCodeHash && hash_(x.accessCode || '') !== group.accessCodeHash) throw new Error('La clave de acceso de esta mesa no es correcta.');
  return group;
}
function parse_(v, fallback) { try { return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; } }
function listGroups_() { return { ok: true, groups: rows_('Groups').map(g => ({ id: g.id, name: g.name, createdAt: g.createdAt, requiresKey: Boolean(g.accessCodeHash) })) }; }
function createGroup_(x) {
  const name = String(x.name || '').trim();
  if (!name) throw new Error('Poné un nombre para la mesa.');
  const rulesJson = JSON.stringify(DEFAULT_RULES), group = { id: id_(), name, accessCodeHash: hash_(x.accessCode || ''), createdAt: now_(), rulesJson };
  append_('Groups', group); append_('Rules', { groupId: group.id, rulesJson, updatedAt: now_() });
  return { ok: true, group: { id: group.id, name: group.name, createdAt: group.createdAt, rules: DEFAULT_RULES } };
}
function getGroup_(x) {
  const group = checkGroup_(x), rules = parse_(group.rulesJson, DEFAULT_RULES);
  const games = rows_('Games').filter(g => String(g.groupId) === String(group.id)).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(g => publicGame_(g));
  return { ok: true, group: { id: group.id, name: group.name, createdAt: group.createdAt, rules }, games };
}
function createGame_(x) {
  const group = checkGroup_(x), players = (x.players || []).map(n => String(n).trim()).filter(Boolean);
  if (players.length < 2) throw new Error('La partida necesita al menos dos jugadores.');
  const groupRules = parse_(group.rulesJson, DEFAULT_RULES), gameRules = x.rules || groupRules[x.gameId] || DEFAULT_RULES.libre;
  const game = { id: id_(), groupId: group.id, gameId: String(x.gameId || 'libre'), gameName: String(x.gameName || 'Contador libre'), title: String(x.title || x.gameName || 'Partida'), playersJson: JSON.stringify(players.map((name,index) => ({ id: id_(), name, index }))), rulesJson: JSON.stringify(gameRules), status: 'active', createdAt: now_(), finishedAt: '', winner: '' };
  append_('Games', game);
  return { ok: true, game: publicGame_(game) };
}
function gameById_(groupId, gameId) {
  return rows_('Games').find(g => String(g.id) === String(gameId) && String(g.groupId) === String(groupId));
}
function roundsFor_(groupId, gameId) {
  return rows_('Rounds').filter(r => String(r.groupId) === String(groupId) && String(r.gameId) === String(gameId)).sort((a,b) => Number(a.roundNumber)-Number(b.roundNumber)).map(r => ({ id:r.id, roundNumber:Number(r.roundNumber), scores:parse_(r.scoresJson,{}), note:r.note, createdAt:r.createdAt }));
}
function publicGame_(g) {
  const players = parse_(g.playersJson, []), rounds = roundsFor_(g.groupId, g.id), rules = parse_(g.rulesJson, DEFAULT_RULES.libre);
  const totals = {};
  players.forEach(p => { totals[p.name] = rounds.reduce((sum,r) => sum + (Number(r.scores[p.name]) || 0), 0); });
  return { id:g.id, groupId:g.groupId, gameId:g.gameId, gameName:g.gameName, title:g.title, players, rules, status:g.status, createdAt:g.createdAt, finishedAt:g.finishedAt, winner:g.winner, rounds, totals };
}
function addRound_(x) {
  checkGroup_(x); const game = gameById_(x.groupId, x.gameId);
  if (!game) throw new Error('No encontramos esa partida.');
  if (game.status !== 'active') throw new Error('Esta partida ya está finalizada.');
  const players = parse_(game.playersJson, []), scores = {};
  players.forEach(p => { const raw = x.scores && x.scores[p.name]; const n = Number(raw); scores[p.name] = Number.isFinite(n) ? n : 0; });
  const roundNumber = roundsFor_(x.groupId, x.gameId).length + 1;
  append_('Rounds', { id:id_(), groupId:x.groupId, gameId:x.gameId, roundNumber, scoresJson:JSON.stringify(scores), note:String(x.note || ''), createdAt:now_() });
  return { ok:true, game:publicGame_(gameById_(x.groupId,x.gameId)) };
}
function finishGame_(x) {
  checkGroup_(x); const game = gameById_(x.groupId, x.gameId);
  if (!game) throw new Error('No encontramos esa partida.');
  const g = publicGame_(game), entries = Object.entries(g.totals);
  if (entries.length) {
    entries.sort((a,b) => g.rules.direction === 'lower' ? a[1]-b[1] : b[1]-a[1]);
    updateById_('Games','id',game.id,{ status:'finished', finishedAt:now_(), winner:entries[0][0] });
  } else updateById_('Games','id',game.id,{ status:'finished', finishedAt:now_(), winner:'' });
  return { ok:true };
}
function saveRules_(x) {
  const group = checkGroup_(x), rules = x.rules || DEFAULT_RULES, json = JSON.stringify(rules);
  updateById_('Groups','id',group.id,{ rulesJson:json });
  const sh = db_().getSheetByName('Rules'), vals = sh.getDataRange().getValues(), idx = vals.findIndex((r,i) => i > 0 && String(r[0]) === String(group.id));
  if (idx > 0) { sh.getRange(idx+1,2).setValue(json); sh.getRange(idx+1,3).setValue(now_()); }
  else append_('Rules',{groupId:group.id,rulesJson:json,updatedAt:now_()});
  return { ok:true };
}
