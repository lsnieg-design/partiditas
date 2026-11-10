import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, Trophy, Settings2, ArrowLeft, PlusCircle, NotebookPen, LoaderCircle, Check, Download, Smartphone, Share, X, Pencil } from 'lucide-react';
import { api } from './api.js';

const GAMES = [
{ id: 'chinchon', name: 'Chinchón', emoji: '🃏', color: 'yellow', description: 'Puntos de penalización por ronda' },
{ id: 'escoba', name: 'Escoba de 15', emoji: '🧹', color: 'pink', description: 'Escobas, cartas y oros' },
{ id: 'truco', name: 'Truco', emoji: '♠', color: 'green', description: 'Marcador de buenas y malas' },
{ id: 'rummy', name: 'Rummy', emoji: '♦', color: 'purple', description: 'Puntos de las cartas que quedan' },
{ id: 'libre', name: 'Contador libre', emoji: '🎲', color: 'blue', description: 'Sumá o restá a tu manera' }
];

const DEFAULT_RULES = {
chinchon: { target: 100, direction: 'lower', unit: 'puntos', roundBased: true, chinchonBonus: 10, endAtTarget: true },
escoba: { target: 15, direction: 'higher', unit: 'tantos', roundBased: true, scoringMode: 'escoba-15', pointsPerEscoba: 1, pointsPerCategory: 1 },
truco: { target: 30, direction: 'higher', unit: 'tantos', roundBased: true, scoringMode: 'truco-teams', splitAt: 15 },
rummy: { target: 100, direction: 'lower', unit: 'puntos', roundBased: true, scoringMode: 'card-penalties' },
libre: { target: 0, direction: 'higher', unit: 'puntos', roundBased: true }
};

const blankGroup = { name: '', accessCode: '' };
const mergeRules = (saved = {}) => Object.fromEntries(Object.keys(DEFAULT_RULES).map(id => [id, { ...DEFAULT_RULES[id], ...(saved?.[id] || {}) }]));
const blankPlayers = () => ['', ''];
const DEVICE_GROUPS_KEY = 'partiditas_my_groups_v1';

function readDeviceGroups() {
if (typeof window === 'undefined') return [];
try {
const value = JSON.parse(window.localStorage.getItem(DEVICE_GROUPS_KEY) || '[]');
return Array.isArray(value) ? value.filter(item => item && item.id && item.name) : [];
} catch {
return [];
}
}

function writeDeviceGroups(groups) {
if (typeof window === 'undefined') return;
try { window.localStorage.setItem(DEVICE_GROUPS_KEY, JSON.stringify(groups)); }
catch {}
}

function rememberDeviceGroup(group) {
const existing = readDeviceGroups().filter(item => String(item.id) !== String(group.id));
const entry = {
id: String(group.id),
name: String(group.name || 'Mi mesa'),
accessCode: String(group.accessCode || ''),
requiresKey: true,
rememberedAt: new Date().toISOString()
};
const next = [entry, ...existing];
writeDeviceGroups(next);
return next;
}

function removeDeviceGroup(groupId) {
const next = readDeviceGroups().filter(item => String(item.id) !== String(groupId));
writeDeviceGroups(next);
return next;
}

/* Componente TallyBundle mejorado para el truco tradicional con palitos/porotos */
function TallyBundle({ fill = 0, onClick, disabled = false, label }) {
const count = Math.max(0, Math.min(5, Number(fill) || 0));
return (
<button
type="button"
className={tally-bundle ${count === 5 ? 'is-full' : ''} ${count > 0 ? 'has-marks' : ''}}
onClick={onClick}
disabled={disabled}
aria-label={label}
title={label}
>

{[0, 1, 2, 3].map(i => (
<line key={i} x1={8 + i * 9} y1="5" x2={8 + i * 9} y2="36" className={count > i ? 'tally-stroke on' : 'tally-stroke'} />
))}
= 5 ? 'tally-stroke diagonal on' : 'tally-stroke diagonal'} />

{count}/5

);
}

export default function App() {
const [groups, setGroups] = useState(() => readDeviceGroups());
const [group, setGroup] = useState(null);
const [history, setHistory] = useState([]);
const [activeGame, setActiveGame] = useState(null);
const [screen, setScreen] = useState('home');
const [groupForm, setGroupForm] = useState(blankGroup);
const [joinCode, setJoinCode] = useState('');
const [joinAccessCode, setJoinAccessCode] = useState('');
const [gameForm, setGameForm] = useState({ gameId: 'chinchon', players: blankPlayers(), title: '' });
const [teamSetup, setTeamSetup] = useState({ names: ['Nosotros', 'Ellos'], members: ['', ''] });
const [rules, setRules] = useState(DEFAULT_RULES);
const [ruleGameId, setRuleGameId] = useState('chinchon');
const [ruleDraft, setRuleDraft] = useState(null);
const [ruleReturnTo, setRuleReturnTo] = useState('rules');
const [roundNote, setRoundNote] = useState('');
const [roundScores, setRoundScores] = useState({});
const [escobaAwards, setEscobaAwards] = useState({ masCartas: '', masOros: '', sieteOro: '', masSietes: '' });
const [chinchonPlayer, setChinchonPlayer] = useState('');
const [busy, setBusy] = useState(false);
const [message, setMessage] = useState('');
const [error, setError] = useState('');
const [loaded, setLoaded] = useState(false);
const [showInstallHelp, setShowInstallHelp] = useState(false);
const [installTab, setInstallTab] = useState('android');
const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
const [showRoundModal, setShowRoundModal] = useState(false);
const [showJoinModal, setShowJoinModal] = useState(false);
const [showPlayHistory, setShowPlayHistory] = useState(false);
const [winnerInfo, setWinnerInfo] = useState(null);

useEffect(() => { refreshGroups(); }, []);

useEffect(() => {
const modalOpen = showRoundModal || showInstallHelp || showJoinModal || Boolean(winnerInfo);
document.body.classList.toggle('modal-open', modalOpen);
document.body.classList.toggle('game-active', screen === 'play');
return () => {
document.body.classList.remove('modal-open');
document.body.classList.remove('game-active');
};
}, [showRoundModal, showInstallHelp, showJoinModal, winnerInfo, screen]);

useEffect(() => {
const ua = window.navigator.userAgent || '';
const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
setInstallTab(isAppleMobile ? 'iphone' : 'android');

const handleBeforeInstallPrompt = (event) => {
  event.preventDefault();
  setDeferredInstallPrompt(event);
};
const handleAppInstalled = () => {
  setDeferredInstallPrompt(null);
  setShowInstallHelp(false);
  setMessage('¡Partiditas quedó instalada en tu dispositivo!');
};
window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
window.addEventListener('appinstalled', handleAppInstalled);
return () => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
};


}, []);

function openInstallHelp() {
const ua = window.navigator.userAgent || '';
const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
setInstallTab(isAppleMobile ? 'iphone' : 'android');
setShowInstallHelp(true);
}

async function installOnAndroid() {
if (!deferredInstallPrompt) return;
const installPrompt = deferredInstallPrompt;
setDeferredInstallPrompt(null);
try {
await installPrompt.prompt();
const choice = await installPrompt.userChoice;
if (choice?.outcome === 'accepted') {
setShowInstallHelp(false);
setMessage('¡Partiditas se está instalando en tu dispositivo!');
}
} catch (e) {
setError('No se pudo abrir la instalación automática. Seguí los pasos del navegador para agregar Partiditas.');
}
}

async function refreshGroups() {
setGroups(readDeviceGroups());
setLoaded(true);
}

async function openGroup(g) {
let accessCode = String(g.accessCode || '').trim();
if (!accessCode) {
const entered = window.prompt('Ingresá la clave privada de esta mesa:');
if (entered === null) return;
accessCode = entered.trim();
if (!accessCode) return;
}
setBusy(true); setError('');
try {
const data = await api('getGroup', { groupId: g.id, accessCode });
const opened = { ...data.group, id: g.id, accessCode, requiresKey: true };
setGroup(opened);
setGroups(rememberDeviceGroup({ ...opened, accessCode }));
setHistory(data.games || []);
setRules(mergeRules(data.group?.rules));
setScreen('group');
} catch (e) { setError(e.message); }
finally { setBusy(false); }
}

async function createGroup(e) {
e.preventDefault();
const accessCode = groupForm.accessCode.trim();
if (accessCode.length < 12) {
setError('La clave privada necesita al menos 12 caracteres.');
return;
}
setBusy(true); setError('');
try {
const data = await api('createGroup', { name: groupForm.name.trim(), accessCode });
const created = { ...data.group, accessCode, requiresKey: true };
setGroup(created);
setGroups(rememberDeviceGroup(created));
setHistory([]);
setRules(mergeRules(data.group?.rules));
setGroupForm(blankGroup);
setScreen('group');
} catch (e) { setError(e.message); }
finally { setBusy(false); }
}

async function editGroup(g) {
const proposedName = window.prompt('¿Cómo querés llamar a esta mesa?', g.name || '');
if (proposedName === null) return;
const name = proposedName.trim();
if (!name) { setError('El nombre no puede estar vacío.'); return; }

let accessCode = (group?.id === g.id ? (group.accessCode || '') : '') || g.accessCode || '';
if (g.requiresKey && !accessCode) {
  const entered = window.prompt(`La mesa “${g.name}” tiene clave. Ingresala para editarla:`);
  if (entered === null) return;
  accessCode = entered.trim();
}

setBusy(true); setError('');
try {
  const data = await api('updateGroup', { groupId: g.id, accessCode, name });
  const renamed = { ...g, name: data.group?.name || name, accessCode, requiresKey: true };
  setGroups(rememberDeviceGroup(renamed));
  if (group?.id === g.id) setGroup(prev => prev ? { ...prev, name: renamed.name, accessCode: accessCode || prev.accessCode || '' } : prev);
  setMessage(`Mesa actualizada: ${data.group?.name || name}.`);
  setTimeout(() => setMessage(''), 2600);
} catch (e) {
  setError(`No se pudo editar: ${e.message}`);
} finally { setBusy(false); }


}

function removeGroupFromDevice(g) {
const confirmed = window.confirm(¿Quitar “${g.name}” de este celular?\n\nSolo se elimina de este dispositivo. El historial sigue guardado en el servidor.);
if (!confirmed) return;
setGroups(removeDeviceGroup(g.id));
if (group?.id === g.id) {
setGroup(null);
setHistory([]);
setActiveGame(null);
setScreen('home');
setRules(DEFAULT_RULES);
}
}

async function joinGroup(e) {
e.preventDefault(); setBusy(true); setError('');
const id = joinCode.trim();
const accessCode = joinAccessCode.trim();
try {
const data = await api('getGroup', { groupId: id, accessCode });
const joined = { ...data.group, id, accessCode, requiresKey: true };
setGroup(joined);
setGroups(rememberDeviceGroup(joined));
setHistory(data.games || []);
setRules(mergeRules(data.group?.rules));
setJoinCode(''); setJoinAccessCode(''); setShowJoinModal(false); setScreen('group');
} catch (e) { setError(e.message); }
finally { setBusy(false); }
}

function resumeGame(gameToResume) {
if (!gameToResume || gameToResume.status === 'finished' || gameToResume.finishedAt) return;
setActiveGame(gameToResume);
setRoundScores(Object.fromEntries((gameToResume.players || []).map(p => [p.name, 0])));
setRoundNote('');
setEscobaAwards({ masCartas: '', masOros: '', sieteOro: '', masSietes: '' });
setChinchonPlayer('');
setError('');
setShowPlayHistory(false);
setScreen('play');
}

function addPlayer() { setGameForm(f => ({ ...f, players: [...f.players, ''] })); }
function setPlayer(i, value) { setGameForm(f => ({ ...f, players: f.players.map((p, j) => i === j ? value : p) })); }

function chooseGame(id) {
setGameForm({ gameId: id, players: blankPlayers(), title: '' });
setTeamSetup({ names: ['Nosotros', 'Ellos'], members: ['', ''] });
}

async function startGame(e) {
e.preventDefault();
const selected = GAMES.find(g => g.id === gameForm.gameId) || GAMES[0];
let players;
let gameRules = { ...rules[selected.id] };
if (selected.id === 'truco') {
const teamNames = teamSetup.names.map((n, i) => n.trim() || (i === 0 ? 'Nosotros' : 'Ellos'));
if (teamNames[0].toLocaleLowerCase() === teamNames[1].toLocaleLowerCase()) { setError('Los dos equipos necesitan nombres diferentes.'); return; }
players = teamNames;
gameRules.teamMode = true;
gameRules.teamMembers = Object.fromEntries(teamNames.map((name, i) => [name, teamSetup.members[i].split(',').map(n => n.trim()).filter(Boolean)]));
} else {
players = gameForm.players.map(x => x.trim()).filter(Boolean);
if (players.length < 2) { setError('Agregá al menos dos jugadores.'); return; }
}
setBusy(true); setError('');
try {
const data = await api('createGame', { groupId: group.id, accessCode: group.accessCode || '', gameId: selected.id, gameName: selected.name, title: gameForm.title.trim() || ${selected.name} — ${new Date().toLocaleDateString('es-AR')}, players, rules: gameRules });
setActiveGame(data.game); setRoundScores(Object.fromEntries(players.map(p => [p, 0]))); setRoundNote(''); setEscobaAwards({ masCartas: '', masOros: '', sieteOro: '', masSietes: '' }); setChinchonPlayer(''); setShowPlayHistory(false); setScreen('play');
} catch (e) { setError(e.message); }
finally { setBusy(false); }
}

async function addRound() {
if (!activeGame) return;
let scores = Object.fromEntries(activeGame.players.map(p => [p.name, Number(roundScores[p.name]) || 0]));
let note = roundNote.trim();
if (activeGame.gameId === 'escoba') {
const awardNames = { masCartas: 'Más cartas', masOros: 'Más oros', sieteOro: 'Siete de oros', masSietes: 'Más sietes' };
const pointsPerEscoba = Math.max(0, Number(activeGame.rules?.pointsPerEscoba ?? 1));
const pointsPerCategory = Math.max(0, Number(activeGame.rules?.pointsPerCategory ?? 1));
Object.entries(scores).forEach(([name, val]) => {
const escobas = Number(val) || 0;
if (escobas) note = [note, ${name}: ${escobas} escoba(s)].filter(Boolean).join(' · ');
scores[name] = escobas * pointsPerEscoba;
});
Object.entries(escobaAwards).forEach(([key, winner]) => {
if (winner && Object.hasOwn(scores, winner)) {
scores[winner] += pointsPerCategory;
note = [note, ${awardNames[key]}: ${winner} (+${pointsPerCategory})].filter(Boolean).join(' · ');
}
});
}
if (activeGame.gameId === 'chinchon' && chinchonPlayer) {
const bonus = Math.abs(Number(activeGame.rules?.chinchonBonus ?? 10));
scores[chinchonPlayer] = (scores[chinchonPlayer] || 0) - bonus;
note = [note, Chinchón de ${chinchonPlayer} (-${bonus} puntos)].filter(Boolean).join(' · ');
}
if (activeGame.gameId === 'truco' && !Object.values(scores).some(n => n !== 0)) { setError('Sumá o restá tantos antes de guardar el marcador.'); return; }
setBusy(true); setError('');
try {
const data = await api('addRound', { groupId: group.id, accessCode: group.accessCode || '', gameId: activeGame.id, scores, note });
setActiveGame(data.game); setRoundScores(Object.fromEntries(activeGame.players.map(p => [p.name, 0]))); setRoundNote(''); setEscobaAwards({ masCartas: '', masOros: '', sieteOro: '', masSietes: '' }); setChinchonPlayer(''); setShowRoundModal(false);
const savedTotals = Object.fromEntries(activeGame.players.map(p => [p.name, (data.game.rounds || []).reduce((sum, r) => sum + (Number(r.scores?.[p.name]) || 0), 0)]));
const target = Math.max(0, Number(activeGame.rules?.target) || 0);
const autoWinnerReached = target > 0 && (
(activeGame.gameId === 'truco' && activeGame.players.some(p => savedTotals[p.name] >= target)) ||
(activeGame.gameId === 'escoba' && activeGame.players.some(p => savedTotals[p.name] >= target))
);
if (autoWinnerReached) {
await finishAndCelebrate(data.game, savedTotals);
return;
}
setMessage('¡Jugada guardada!'); setTimeout(() => setMessage(''), 2200);
} catch (e) { setError(e.message); }
finally { setBusy(false); }
}

async function finishAndCelebrate(gameToFinish = activeGame, totalsOverride = null) {
if (!gameToFinish || !group) return;
setBusy(true); setError('');
try {
await api('finishGame', { groupId: group.id, accessCode: group.accessCode || '', gameId: gameToFinish.id });
const data = await api('getGroup', { groupId: group.id, accessCode: group.accessCode || '' });
const finished = (data.games || []).find(g => g.id === gameToFinish.id) || gameToFinish;
const totalsFinal = totalsOverride || Object.fromEntries((finished.players || []).map(p => [p.name, (finished.rounds || []).reduce((sum, r) => sum + (Number(r.scores?.[p.name]) || 0), 0)]));
const entries = Object.entries(totalsFinal);
const direction = finished.rules?.direction || 'higher';
entries.sort((a, b) => direction === 'lower' ? a[1] - b[1] : b[1] - a[1]);
const winnerName = finished.winner || entries[0]?.[0] || '¡Gran partida!';
setGroup({ ...data.group, accessCode: group.accessCode || '' });
setHistory(data.games || []);
setActiveGame(null);
setScreen('group');
setWinnerInfo({
winner: winnerName,
gameName: finished.gameName || gameToFinish.gameName,
title: finished.title || gameToFinish.title,
totals: totalsFinal,
players: finished.players || gameToFinish.players || [],
ties: entries.length > 1 && entries[0][1] === entries[1][1],
direction
});
} catch (e) {
setError(e.message);
} finally { setBusy(false); }
}

async function finishGame() {
if (!activeGame) return;
if (activeGame.gameId === 'truco' && Object.values(roundScores).some(n => Number(n) !== 0)) {
setError('Primero guardá los tantos pendientes de esta mano.');
return;
}
await finishAndCelebrate(activeGame);
}

function openRoundModal() {
if (!activeGame) return;
if (activeGame.gameId !== 'truco') {
setRoundScores(Object.fromEntries(activeGame.players.map(p => [p.name, 0])));
setRoundNote('');
setEscobaAwards({ masCartas: '', masOros: '', sieteOro: '', masSietes: '' });
setChinchonPlayer('');
}
setError('');
setShowRoundModal(true);
}

function cancelRoundModal() {
setShowRoundModal(false);
setError('');
}

async function setTrucoScoreAt(playerName, requestedScore) {
if (!activeGame || busy) return;
const persisted = Number(totals[playerName]) || 0;
const next = Math.max(persisted, Math.min(trucoTarget, requestedScore));
const updatedPending = {
...roundScores,
[playerName]: Math.max(0, next - persisted)
};
setRoundScores(updatedPending);

if (next < trucoTarget) return;
const scores = Object.fromEntries(activeGame.players.map(p => [p.name, Number(updatedPending[p.name]) || 0]));
if (!Object.values(scores).some(value => value !== 0)) return;

setBusy(true); setError('');
try {
  const saved = await api('addRound', {
    groupId: group.id,
    accessCode: group.accessCode || '',
    gameId: activeGame.id,
    scores,
    note: 'Última mano · objetivo alcanzado'
  });
  const savedTotals = Object.fromEntries(activeGame.players.map(p => [
    p.name,
    (saved.game.rounds || []).reduce((sum, round) => sum + (Number(round.scores?.[p.name]) || 0), 0)
  ]));
  setActiveGame(saved.game);
  setRoundScores(Object.fromEntries(activeGame.players.map(p => [p.name, 0])));
  setRoundNote('');
  setBusy(false);
  await finishAndCelebrate(saved.game, savedTotals);
} catch (e) {
  setError(`No se pudo guardar la última mano. ${e.message}`);
  setBusy(false);
}


}

function openRuleEditor(gameId, returnTo = 'rules') {
setRuleGameId(gameId);
setRuleDraft({ ...(rules[gameId] || DEFAULT_RULES[gameId]) });
setRuleReturnTo(returnTo);
setError('');
setScreen('rule-editor');
}

function changeRuleDraft(key, value) {
setRuleDraft(current => ({ ...(current || rules[ruleGameId] || DEFAULT_RULES[ruleGameId]), [key]: value }));
}

async function saveRuleEditor() {
if (!ruleDraft) return;
const next = { ...rules, [ruleGameId]: { ...ruleDraft } };
setBusy(true); setError('');
try {
if (group) await api('saveRules', { groupId: group.id, accessCode: group.accessCode || '', rules: next });
setRules(next);
setMessage('Reglas guardadas correctamente.');
setTimeout(() => setMessage(''), 2600);
setScreen(ruleReturnTo === 'newgame' ? 'newgame' : 'rules');
} catch (e) {
setError(No se pudieron guardar las reglas: ${e.message});
} finally { setBusy(false); }
}

const selectedGame = GAMES.find(g => g.id === gameForm.gameId) || GAMES[0];
const ruleGame = GAMES.find(g => g.id === ruleGameId) || GAMES[0];
const ruleValues = ruleDraft || rules[ruleGame.id] || DEFAULT_RULES[ruleGame.id];

const totals = useMemo(() => {
const out = {};
(activeGame?.players || []).forEach(p => { out[p.name] = (activeGame.rounds || []).reduce((sum, r) => sum + (Number(r.scores?.[p.name]) || 0), 0); });
return out;
}, [activeGame]);

const ranking = useMemo(() => Object.entries(totals).sort((a,b) => (activeGame?.rules?.direction === 'lower' ? a[1]-b[1] : b[1]-a[1])), [totals, activeGame]);
const shownTruco = (name) => (Number(totals[name]) || 0) + (Number(roundScores[name]) || 0);
const trucoTarget = Math.max(2, Number(activeGame?.rules?.target) || 30);
const trucoSplit = Math.min(trucoTarget - 1, Math.max(1, Number(activeGame?.rules?.splitAt) || Math.floor(trucoTarget / 2)));

return (
<main className={app-shell ${screen === 'play' ? 'app-shell-play' : ''}}>
{screen !== 'play' && (

<button className="brand" onClick={() => { setScreen(group ? 'group' : 'home'); setError(''); }} aria-label="Inicio">

partiditastu libreta de juegos


 DESCARGÁ LA APP
hecho por NÓMADE ♥


)}

  {error && <div className={`alert error ${screen === 'play' ? 'play-toast' : ''}`} role="alert">{error}<button onClick={() => setError('')} aria-label="Cerrar">×</button></div>}
  {message && <div className={`alert success ${screen === 'play' ? 'play-toast' : ''}`}>{message}</div>}
  {busy && <div className="busy"><LoaderCircle size={16} className="spin"/> Guardando…</div>}

  {screen === 'home' && (
    <>
      <section className="hero home-hero-compact"><div><h1>Mis mesas</h1><p>Volvé a jugar en un toque.</p></div></section>
      <section className="section-head home-section-head">
        <div><h2>Tus mesas</h2><p className="section-subtitle">Tus grupos, siempre a mano.</p></div>
        <div className="home-section-actions">
          <span className="count-pill">{groups.length} {groups.length === 1 ? 'mesa' : 'mesas'}</span>
          <button type="button" className="button primary new-table-button" onClick={() => { setGroupForm(blankGroup); setError(''); setScreen('newgroup'); }}><Plus size={17}/> NUEVA MESA</button>
        </div>
      </section>
      {groups.length ? (
        <div className="group-grid">
          {groups.map((g, i) => (
            <article className={`group-card note-${i%4}`} key={g.id}>
              <button type="button" className="group-card-open" onClick={() => openGroup(g)} aria-label={`Abrir mesa ${g.name}`} disabled={busy}>
                <span className="pin">✦</span><span className="card-kicker">MESA DE JUEGO</span><strong>{g.name}</strong><span className="card-bottom"><Users size={15}/> Abrir mesa <span>↗</span></span>
              </button>
              <div className="group-card-actions">
                <button type="button" onClick={() => editGroup(g)} title="Editar" disabled={busy}><Pencil size={14}/></button>
                <button type="button" className="delete-group-action" onClick={() => removeGroupFromDevice(g)} title="Quitar" disabled={busy}><X size={14}/></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state home-empty"><span>🗒️</span><strong>Este dispositivo no tiene mesas guardadas</strong><p>Creá una nueva o sumate con el código de tu grupo.</p><button type="button" className="button secondary" onClick={() => setScreen('newgroup')}><Plus size={16}/> Nueva mesa</button></div>
      )}
      <button type="button" className="join-trigger" onClick={() => { setError(''); setShowJoinModal(true); }}>
        <span className="join-trigger-icon"><Users size={21}/></span>
        <span><strong>Sumarme a una mesa</strong><small>Ingresá el código que te compartieron</small></span>
        <ArrowLeft className="join-trigger-arrow" size={18}/>
      </button>
      <p className="privacy-note"><NotebookPen size={15}/> Tus mesas se recuerdan en este dispositivo de forma segura.</p>
    </>
  )}

  {screen === 'newgroup' && (
    <>
      <button className="back-link" onClick={() => setScreen('home')}><ArrowLeft size={16}/> Volver a mis mesas</button>
      <section className="form-panel new-group-panel">
        <span className="eyebrow">UNA MESA PROPIA</span><h1>¿Quiénes se juntan?</h1><p>Creá un espacio para tu grupo con su propio historial y partidas.</p>
        <form onSubmit={createGroup}>
          <label>Nombre de la mesa<input required maxLength="60" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Ej. Los del domingo"/></label>
          <label>Clave privada del grupo<input value={groupForm.accessCode} onChange={e => setGroupForm({ ...groupForm, accessCode: e.target.value })} placeholder="Mínimo 12 caracteres" minLength={12} required autoComplete="new-password"/><small className="field-help">Compartila solo con tus amigxs de confianza.</small></label>
          <button className="button primary wide" disabled={busy}><Plus size={17}/> Crear mesa <span>→</span></button>
        </form>
      </section>
    </>
  )}

  {screen === 'group' && group && (
    <>
      <button className="back-link" onClick={() => setScreen('home')}><ArrowLeft size={16}/> Todas las mesas</button>
      <section className="group-banner">
        <div>
          <span className="eyebrow">TU MESA PRIVADA</span>
          <h1>{group.name}</h1>
          <p>Compartí los datos de acceso con quienes vayan a jugar.</p>
          <div className="group-share-details">
            <div className="group-id"><span>ID de mesa</span><code>{group.id}</code><button type="button" onClick={() => navigator.clipboard?.writeText(group.id)}>Copiar ID</button></div>
            <div className="group-id"><span>Clave</span><code>{group.accessCode || 'Protegida'}</code>{group.accessCode && <button type="button" onClick={() => navigator.clipboard?.writeText(group.accessCode)}>Copiar clave</button>}</div>
          </div>
        </div>
        <div className="banner-stamp">QUE<br/>GANE<br/>EL MEJOR</div>
      </section>
      <div className="action-row"><div><span className="eyebrow">¿QUÉ JUGAMOS?</span><h2>Elegí tu juego</h2></div><button className="button secondary" onClick={() => setScreen('rules')}><Settings2 size={16}/> Reglas</button></div>
      <div className="game-grid">{GAMES.map(g => <button className={`game-card ${g.color}`} key={g.id} onClick={() => { chooseGame(g.id); setScreen('newgame'); }}><span className="game-emoji">{g.emoji}</span><strong>{g.name}</strong><small>{g.description}</small><span className="game-arrow">↗</span></button>)}</div>
      <section className="history-section">
        <div className="section-head"><div><span className="eyebrow">RECUERDOS</span><h2>Historial de partidas</h2></div><span className="count-pill">{history.length} partidas</span></div>
        {history.length ? (
          <div className="history-list">
            {history.map((g, i) => {
              const inProgress = g.status !== 'finished' && !g.finishedAt;
              return (
                <div className={`history-item ${inProgress ? 'history-item-open' : ''}`} key={g.id}>
                  <div className={`history-icon note-${i%4}`}>{GAMES.find(x => x.id === g.gameId)?.emoji || '🎲'}</div>
                  <div className="history-main"><strong>{g.title || g.gameName}</strong><span>{g.gameName} · {(g.players || []).map(p => p.name).join(', ')}</span><small>{inProgress ? 'Partida en curso' : `Finalizada · ${new Date(g.finishedAt || g.createdAt).toLocaleDateString('es-AR')}`}</small></div>
                  <div className="history-score">{inProgress ? <button type="button" className="resume-game-button" onClick={() => resumeGame(g)} disabled={busy}>Continuar ↗</button> : g.winner ? <><Trophy size={15}/><span>{g.winner}</span></> : <span className="in-progress">Finalizada</span>}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state"><span>🗒️</span><strong>Acá van a quedar tus partidas</strong><p>Cuando terminen de jugar, los resultados se guardarán aquí.</p></div>
        )}
      </section>
    </>
  )}

  {screen === 'newgame' && group && (
    <>
      <button className="back-link" onClick={() => setScreen('group')}><ArrowLeft size={16}/> Volver a la mesa</button>
      <section className="form-panel">
        <span className="eyebrow">NUEVA PARTIDA</span><h1>Armemos la mesa.</h1><p>Configuramos el marcador según el juego que eligieron.</p>
        <form onSubmit={startGame}>
          <label>Juego<select value={gameForm.gameId} onChange={e => chooseGame(e.target.value)}>{GAMES.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
          <label>Nombre de la partida (opcional)<input value={gameForm.title} onChange={e => setGameForm({ ...gameForm, title: e.target.value })} placeholder="Ej. Final de campeonato"/></label>
          {gameForm.gameId === 'truco' ? (
            <div className="truco-setup">
              <div className="team-setup-card team-us"><span className="eyebrow">EQUIPO 1</span><label>Nombre<input value={teamSetup.names[0]} onChange={e => setTeamSetup(s => ({ ...s, names: s.names.map((n,i) => i===0 ? e.target.value : n) }))} placeholder="Nosotros" required/></label><label>Jugadores (separados por coma)<input value={teamSetup.members[0]} onChange={e => setTeamSetup(s => ({ ...s, members: s.members.map((n,i) => i===0 ? e.target.value : n) }))} placeholder="Luli, Toto"/></label></div>
              <div className="team-setup-card team-them"><span className="eyebrow">EQUIPO 2</span><label>Nombre<input value={teamSetup.names[1]} onChange={e => setTeamSetup(s => ({ ...s, names: s.names.map((n,i) => i===1 ? e.target.value : n) }))} placeholder="Ellos" required/></label><label>Jugadores (separados por coma)<input value={teamSetup.members[1]} onChange={e => setTeamSetup(s => ({ ...s, members: s.members.map((n,i) => i===1 ? e.target.value : n) }))} placeholder="Fede, Juli"/></label></div>
              <p className="game-help">El marcador se lleva por equipos en paralelo.</p>
            </div>
          ) : (
            <>
              <div className="players-head"><label>Jugadores <small>mínimo 2</small></label><button type="button" className="text-button" onClick={addPlayer}><Plus size={15}/> Agregar jugador</button></div>
              <div className="player-fields">{gameForm.players.map((p,i) => <div className="player-field" key={i}><span>{String(i+1).padStart(2,'0')}</span><input value={p} onChange={e => setPlayer(i,e.target.value)} placeholder={`Jugador/a ${i+1}`} required/><button type="button" disabled={gameForm.players.length<=2} onClick={() => setGameForm(f => ({ ...f, players: f.players.filter((_,j) => j!==i) }))}>×</button></div>)}</div>
            </>
          )}
          <div className="rule-summary"><Settings2 size={17}/><span><strong>Reglas actuales:</strong> {rules[selectedGame.id].target ? `Objetivo ${rules[selectedGame.id].target} ${rules[selectedGame.id].unit}` : ''}</span><button type="button" onClick={() => openRuleEditor(selectedGame.id, 'newgame')}>Editar</button></div>
          <button className="button primary wide" disabled={busy}>Empezar partida <span>→</span></button>
        </form>
      </section>
    </>
  )}

  {screen === 'play' && activeGame && (
    <section className="mobile-play-screen">
      <div className="mobile-play-top">
        <button className="mini-back" type="button" onClick={() => setScreen('group')}><ArrowLeft size={17}/><span>Mesa</span></button>
        <div className="mobile-play-title"><span className="eyebrow">{activeGame.gameName}</span><strong>{activeGame.title}</strong></div>
        <button className="mini-finish" type="button" onClick={finishGame} disabled={busy}><Trophy size={16}/></button>
      </div>

      <div className="mobile-play-content">
        {activeGame.gameId === 'truco' ? (
          <>
            <div className="mobile-match-meta"><span>PARTIDO A {trucoTarget} TANTOS</span><span>{(activeGame.rounds || []).length} manos</span></div>
            <div className="truco-tap-instruction">Tocá las casillas de porotos para sumar puntos. Primer bloque (15) = Malas, segundo bloque = Buenas.</div>
            <div className="truco-mobile-teams">
              {activeGame.players.map((p, i) => {
                const score = Math.max(0, Math.min(trucoTarget, shownTruco(p.name)));
                const malas = Math.min(score, trucoSplit);
                const buenas = Math.max(0, score - trucoSplit);
                const remainingSlots = trucoTarget - trucoSplit;
                const won = score >= trucoTarget;
                return (
                  <section className={`truco-mobile-team ${i === 0 ? 'team-mint' : 'team-rose'} ${won ? 'team-winner' : ''}`} key={p.id || p.name}>
                    <div className="truco-team-head">
                      <div>
                        <span className="team-kicker">EQUIPO {i + 1}</span>
                        <h2>{p.name}</h2>
                        {activeGame.rules?.teamMembers?.[p.name]?.length > 0 && <p>{activeGame.rules.teamMembers[p.name].join(', ')}</p>}
                      </div>
                      <div className="truco-score-bubble"><strong>{score}</strong><small>/{trucoTarget}</small></div>
                    </div>

                    <div className="tally-touch-area">
                      <div className="tally-section-mobile">
                        <div className="tally-label-row"><span>MALAS</span><strong>{malas}<small>/{trucoSplit}</small></strong></div>
                        <div className="tally-bundles-grid">
                          {Array.from({ length: Math.ceil(trucoSplit / 5) }, (_, n) => {
                            const fill = Math.min(5, Math.max(0, malas - n * 5));
                            const blockEnd = Math.min((n + 1) * 5, trucoSplit);
                            const canTap = !busy && !won && score < trucoSplit && score >= n * 5 && score < blockEnd;
                            return <TallyBundle key={n} fill={fill} disabled={!canTap} onClick={() => setTrucoScoreAt(p.name, Math.min(trucoTarget, score + 1))} label={`Bloque ${n + 1}`} />;
                          })}
                        </div>
                      </div>
                      <div className="tally-section-mobile">
                        <div className="tally-label-row"><span>BUENAS</span><strong>{buenas}<small>/{remainingSlots}</small></strong></div>
                        <div className="tally-bundles-grid">
                          {Array.from({ length: Math.ceil(remainingSlots / 5) }, (_, n) => {
                            const fill = Math.min(5, Math.max(0, buenas - n * 5));
                            const blockEnd = Math.min((n + 1) * 5, remainingSlots);
                            const canTap = !busy && !won && score >= trucoSplit && buenas >= n * 5 && buenas < blockEnd;
                            return <TallyBundle key={n} fill={fill} disabled={!canTap} onClick={() => setTrucoScoreAt(p.name, Math.min(trucoTarget, score + 1))} label={`Buenas ${n + 1}`} />;
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="team-score-actions">
                      <button type="button" onClick={() => setTrucoScoreAt(p.name, Math.max(0, score - 1))} disabled={busy || score <= (Number(totals[p.name]) || 0)}>− 1</button>
                      <button type="button" onClick={() => setTrucoScoreAt(p.name, Math.min(trucoTarget, score + 1))} disabled={busy || score >= trucoTarget}>+ 1</button>
                    </div>
                  </section>
                );
              })}
            </div>
            {Object.values(roundScores).some(n => Number(n) !== 0) && (
              <div className="pending-round-banner"><span>✦ Tantos en juego</span><strong>{Object.values(roundScores).reduce((sum, n) => sum + (Number(n) || 0), 0)} pts</strong></div>
            )}
          </>
        ) : (
          <>
            <div className="mobile-match-meta"><span>RONDA {(activeGame.rounds || []).length + 1}</span><span>{(activeGame.rounds || []).length} rondas jugadas</span></div>
            <section className="mobile-score-cards">
              {ranking.map(([name, score], i) => (
                <article className={`mobile-player-score ${i === 0 ? 'is-leading' : ''}`} key={name}>
                  <span className="mobile-player-rank">{i === 0 ? '★' : String(i + 1).padStart(2, '0')}</span>
                  <div className="mobile-player-data"><strong>{name}</strong><small>{i === 0 ? 'Va ganando' : 'Puntaje'}</small></div>
                  <strong className="mobile-player-total">{score}</strong>
                </article>
              ))}
            </section>
          </>
        )}

        <section className={`mobile-history ${showPlayHistory ? 'is-open' : ''}`}>
          <button type="button" className="mobile-history-heading" onClick={() => setShowPlayHistory(value => !value)}>
            <h3>Historial de la partida</h3><span>{(activeGame.rounds || []).length}</span><span className="history-chevron">{showPlayHistory ? '−' : '+'}</span>
          </button>
          {showPlayHistory && ((activeGame.rounds || []).length ? [...activeGame.rounds].reverse().map((r, i) => (
            <div className="mobile-history-row" key={r.id || i}><div className="round-number-badge">{r.roundNumber || activeGame.rounds.length - i}</div><div className="mobile-history-text"><strong>{r.note || `Ronda`}</strong><small>{activeGame.players.map(p => `${p.name}: ${r.scores?.[p.name] ?? 0}`).join(' · ')}</small></div></div>
          )) : <p className="mobile-empty-history">Sin rondas registradas.</p>)}
        </section>
      </div>

      <div className="mobile-play-bottom">
        {activeGame.gameId === 'truco' ? (
          <button type="button" className="mobile-primary-action" onClick={openRoundModal} disabled={busy || !Object.values(roundScores).some(n => Number(n) !== 0)}>
            <Check size={18}/> Registrar mano
          </button>
        ) : (
          <button type="button" className="mobile-primary-action" onClick={openRoundModal} disabled={busy}>
            <PlusCircle size={18}/> Cargar jugada
          </button>
        )}
        <button type="button" className="mobile-secondary-action" onClick={() => setScreen('group')}>Mesa</button>
      </div>
    </section>
  )}

  {screen === 'rules' && (
    <>
      <button className="back-link" onClick={() => setScreen(group ? 'group' : 'home')}><ArrowLeft size={16}/> Volver</button>
      <section className="form-panel rules-panel rules-picker-panel">
        <span className="eyebrow">AJUSTES</span><h1>Reglas a tu medida.</h1><p>Elegí un juego para configurar sus límites y objetivos.</p>
        <div className="rule-picker-grid">{GAMES.map(g => <button type="button" className={`rule-picker-card ${g.color}`} key={g.id} onClick={() => openRuleEditor(g.id, 'rules')}><span className="rule-picker-emoji">{g.emoji}</span><span className="rule-picker-name">{g.name}</span><span className="rule-picker-description">{g.description}</span><span className="rule-picker-link">Configurar <span>↗</span></span></button>)}</div>
      </section>
    </>
  )}

  {screen === 'rule-editor' && (
    <>
      <button className="back-link" onClick={() => setScreen(ruleReturnTo === 'newgame' ? 'newgame' : 'rules')}><ArrowLeft size={16}/> Volver</button>
      <section className="form-panel rules-panel rule-editor-panel">
        <div className={`rule-editor-hero ${ruleGame.color}`}><span className="rule-editor-emoji">{ruleGame.emoji}</span><span className="eyebrow">REGLAS</span><h1>{ruleGame.name}</h1></div>
        <div className="rule-card rule-editor-card">
          {ruleGame.id !== 'truco' && <label>¿Cómo se gana?<select value={ruleValues.direction} onChange={e => changeRuleDraft('direction', e.target.value)}><option value="higher">Mayor puntaje</option><option value="lower">Menor puntaje</option></select></label>}
          <div className="rule-two">
            <label>Objetivo<input type="number" min={0} value={ruleValues.target ?? 0} onChange={e => changeRuleDraft('target', Number(e.target.value))}/></label>
            <label>Unidad<input value={ruleValues.unit || ''} onChange={e => changeRuleDraft('unit', e.target.value)} maxLength="24"/></label>
          </div>
        </div>
        <div className="rule-editor-actions"><button type="button" className="button secondary" onClick={() => setScreen(ruleReturnTo === 'newgame' ? 'newgame' : 'rules')}>Cancelar</button><button type="button" className="button primary" onClick={saveRuleEditor} disabled={busy}><Check size={16}/> Guardar</button></div>
      </section>
    </>
  )}

  {showRoundModal && activeGame && (
    <div className="mobile-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) cancelRoundModal(); }}>
      <section className="mobile-round-modal" role="dialog">
        <div className="mobile-modal-grabber" />
        <div className="mobile-modal-head"><div><span className="eyebrow">{activeGame.gameName.toUpperCase()}</span><h2>Cargar jugada</h2></div><button type="button" className="modal-x" onClick={cancelRoundModal}>×</button></div>
        <div className="mobile-modal-scroll">
          {activeGame.gameId === 'truco' ? (
            <>
              <div className="modal-score-preview">{activeGame.players.map(p => <div key={p.name}><span>{p.name}</span><strong>+{Number(roundScores[p.name]) || 0}</strong></div>)}</div>
              <label className="mobile-modal-label">Nota de la mano<input value={roundNote} onChange={e => setRoundNote(e.target.value)} placeholder="Ej. Envido y truco" /></label>
            </>
          ) : (
            <div className="modal-players-inputs">
              {activeGame.players.map((p) => (
                <label className="mobile-modal-label" key={p.id || p.name}>
                  <span>{p.name}</span>
                  <div className="mobile-number-control">
                    <button type="button" onClick={() => setRoundScores(s => ({ ...s, [p.name]: (Number(s[p.name]) || 0) - 1 }))}>−</button>
                    <input type="number" inputMode="decimal" value={roundScores[p.name] ?? 0} onChange={e => setRoundScores(s => ({ ...s, [p.name]: e.target.value }))}/>
                    <button type="button" onClick={() => setRoundScores(s => ({ ...s, [p.name]: (Number(s[p.name]) || 0) + 1 }))}>+</button>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="mobile-modal-actions"><button type="button" className="mobile-secondary-action" onClick={cancelRoundModal}>Cancelar</button><button type="button" className="mobile-primary-action" onClick={addRound} disabled={busy}><Check size={17}/> Guardar</button></div>
      </section>
    </div>
  )}

  {winnerInfo && (
    <div className="winner-backdrop" role="presentation">
      <div className="confetti-layer" aria-hidden="true">{Array.from({ length: 30 }, (_, i) => <i key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--delay': `${(i % 9) * -0.23}s`, '--hue': `${(i * 41) % 360}` }} />)}</div>
      <section className="winner-card">
        <div className="winner-sparkle">✦</div>
        <span className="winner-kicker">PARTIDA FINALIZADA</span>
        <h2>¡Ganó el equipo / jugador!</h2>
        <div className="winner-trophy">🏆</div>
        <strong className="winner-name">{winnerInfo.winner}</strong>
        <button type="button" className="mobile-primary-action winner-dismiss" onClick={() => setWinnerInfo(null)}><Trophy size={17}/> Volver a la mesa</button>
      </section>
    </div>
  )}

  {showInstallHelp && (
    <div className="install-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowInstallHelp(false); }}>
      <section className="install-dialog">
        <button className="install-close" type="button" onClick={() => setShowInstallHelp(false)}><X size={18}/></button>
        <div className="install-intro"><img src="/logo.png" alt=""/><div><h2>Instalá Partiditas</h2><p>Llevá la libreta directo a tu pantalla de inicio.</p></div></div>
        <div className="install-tabs"><button type="button" className={installTab === 'iphone' ? 'active' : ''} onClick={() => setInstallTab('iphone')}>iPhone / iPad</button><button type="button" className={installTab === 'android' ? 'active' : ''} onClick={() => setInstallTab('android')}>Android</button></div>
        {installTab === 'iphone' ? (
          <div className="install-instructions"><ol><li>Abrí en <strong>Safari</strong>.</li><li>Tocá <strong>Compartir</strong> <Share size={14}/>.</li><li>Elegí <strong>Agregar a pantalla de inicio</strong>.</li></ol></div>
        ) : (
          <div className="install-instructions">
            {deferredInstallPrompt && <button type="button" className="button primary wide install-now-button" onClick={installOnAndroid}><Download size={16}/> Instalar ahora</button>}
            <ol><li>Abrí en <strong>Google Chrome</strong>.</li><li>Tocá el menú <strong>⋮</strong> y seleccioná <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>.</li></ol>
          </div>
        )}
      </section>
    </div>
  )}

  {screen !== 'play' && <footer><span className="footer-brand"><img src="/logo.png" alt=""/><span>partiditas</span></span><a className="footer-nomade" href="https://www.somosnomade.com.ar/" target="_blank" rel="noreferrer">hecho por <strong>NÓMADE</strong> <span>♥</span></a></footer>}
  
  {showJoinModal && (
    <div className="mobile-modal-backdrop join-modal-backdrop" role="presentation">
      <section className="mobile-round-modal join-modal">
        <div className="mobile-modal-grabber"/><div className="mobile-modal-head"><div><span className="eyebrow">UNIRSE</span><h2>Sumarme a una mesa</h2></div><button type="button" className="modal-x" onClick={() => setShowJoinModal(false)}>×</button></div>
        <form onSubmit={joinGroup} className="join-modal-form">
          <label className="mobile-modal-label">ID de la mesa<input value={joinCode} onChange={e => setJoinCode(e.target.value)} required placeholder="Pegá el ID"/></label>
          <label className="mobile-modal-label">Clave privada<input value={joinAccessCode} onChange={e => setJoinAccessCode(e.target.value)} required type="password" placeholder="Clave"/></label>
          <button className="mobile-primary-action" disabled={busy}><Users size={17}/> Entrar a la mesa</button>
        </form>
      </section>
    </div>
  )}
</main>


);
}
