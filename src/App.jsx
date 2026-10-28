import { useEffect, useMemo, useState } from 'react';
import { Plus, Users, Trophy, Settings2, ArrowLeft, PlusCircle, NotebookPen, LoaderCircle, Check, Download, Smartphone, Share, X, Pencil, Trash2 } from 'lucide-react';
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
  catch { /* La app sigue funcionando aunque el navegador bloquee el almacenamiento local. */ }
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

function TallyBundle({ fill = 0, onClick, disabled = false, label }) {
  const count = Math.max(0, Math.min(5, Number(fill) || 0));
  return <button
    type="button"
    className={`tally-bundle ${count === 5 ? 'is-full' : ''} ${count > 0 ? 'has-marks' : ''}`}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
  >
    <svg className="tally-bundle-svg" viewBox="0 0 52 42" aria-hidden="true" focusable="false">
      {[0,1,2,3].map(i => <line key={i} x1={8 + i * 9} y1="5" x2={8 + i * 9} y2="36" className={count > i ? 'tally-stroke on' : 'tally-stroke'} />)}
      <line x1="5" y1="35" x2="41" y2="6" className={count >= 5 ? 'tally-stroke diagonal on' : 'tally-stroke diagonal'} />
    </svg>
    <span>{count}/5</span>
  </button>;
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
      // Conserva la invitación nativa de Chrome/Android para mostrarla desde el botón.
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
      setError('No se pudo abrir la instalación automática. Seguí los pasos de Chrome para agregar Partiditas a la pantalla de inicio.');
    }
  }
  async function refreshGroups() {
    // La pantalla inicial solo muestra mesas recordadas en este dispositivo.
    // No llamamos listGroups: no debe existir un catálogo público de mesas.
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
      setError('La clave privada necesita al menos 12 caracteres. Elegí una que no uses en otras cuentas.');
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
    if (!name) {
      setError('El nombre de la mesa no puede quedar vacío.');
      return;
    }
    if (name.length > 60) {
      setError('El nombre de la mesa puede tener hasta 60 caracteres.');
      return;
    }

    let accessCode = (group?.id === g.id ? (group.accessCode || '') : '') || g.accessCode || '';
    if (g.requiresKey && !accessCode) {
      const entered = window.prompt(`La mesa “${g.name}” tiene clave. Ingresala para editarla:`);
      if (entered === null) return;
      accessCode = entered.trim();
      if (!accessCode) {
        setError('Necesitás ingresar la clave de esta mesa para editarla.');
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      const data = await api('updateGroup', { groupId: g.id, accessCode, name });
      const renamed = { ...g, name: data.group?.name || name, accessCode, requiresKey: true };
      setGroups(rememberDeviceGroup(renamed));
      if (group?.id === g.id) setGroup(prev => prev ? { ...prev, name: renamed.name, accessCode: accessCode || prev.accessCode || '' } : prev);
      setMessage(`Mesa actualizada: ${data.group?.name || name}.`);
      setTimeout(() => setMessage(''), 2600);
    } catch (e) {
      setError(`No se pudo editar la mesa: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  function removeGroupFromDevice(g) {
    const confirmed = window.confirm(
      `¿Quitar “${g.name}” de este celular?\n\nSolo se elimina de la lista de este dispositivo. La mesa, las partidas y el historial seguirán guardados en Google Sheets, y las demás personas conservarán su acceso. Para volver a entrar necesitarás el ID y la clave.`
    );
    if (!confirmed) return;
    setGroups(removeDeviceGroup(g.id));
    if (group?.id === g.id) {
      setGroup(null);
      setHistory([]);
      setActiveGame(null);
      setScreen('home');
      setRules(DEFAULT_RULES);
    }
    setMessage(`“${g.name}” se quitó de este dispositivo. El historial sigue guardado.`);
    window.setTimeout(() => setMessage(''), 3500);
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
    setGameForm({ gameId: id, players: id === 'truco' ? blankPlayers() : blankPlayers(), title: '' });
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
      if (new Set(players.map(p => p.toLocaleLowerCase())).size !== players.length) { setError('Cada jugador necesita un nombre diferente para no mezclar los puntajes.'); return; }
    }
    setBusy(true); setError('');
    try {
      const data = await api('createGame', { groupId: group.id, accessCode: group.accessCode || '', gameId: selected.id, gameName: selected.name, title: gameForm.title.trim() || `${selected.name} — ${new Date().toLocaleDateString('es-AR')}`, players, rules: gameRules });
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
        if (escobas) note = [note, `${name}: ${escobas} escoba(s)`].filter(Boolean).join(' · ');
        scores[name] = escobas * pointsPerEscoba;
      });
      Object.entries(escobaAwards).forEach(([key, winner]) => {
        if (winner && Object.hasOwn(scores, winner)) {
          scores[winner] += pointsPerCategory;
          note = [note, `${awardNames[key]}: ${winner} (+${pointsPerCategory})`].filter(Boolean).join(' · ');
        }
      });
    }
    if (activeGame.gameId === 'chinchon' && chinchonPlayer) {
      const bonus = Math.abs(Number(activeGame.rules?.chinchonBonus ?? 10));
      scores[chinchonPlayer] = (scores[chinchonPlayer] || 0) - bonus;
      note = [note, `Chinchón de ${chinchonPlayer} (-${bonus} puntos)`].filter(Boolean).join(' · ');
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
    } finally {
      setBusy(false);
    }
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
    if (activeGame && activeGame.gameId === 'truco') {
      setRoundNote('');
    } else if (activeGame) {
      setRoundScores(Object.fromEntries(activeGame.players.map(p => [p.name, 0])));
      setRoundNote('');
      setEscobaAwards({ masCartas: '', masOros: '', sieteOro: '', masSietes: '' });
      setChinchonPlayer('');
    }
  }

  function setTrucoScoreAt(playerName, requestedScore) {
    const persisted = Number(totals[playerName]) || 0;
    const next = Math.max(persisted, Math.min(trucoTarget, requestedScore));
    setRoundScores(current => ({ ...current, [playerName]: Math.max(0, next - persisted) }));
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
      const label = GAMES.find(g => g.id === ruleGameId)?.name || 'Juego';
      setMessage(`Reglas de ${label} guardadas.`);
      setTimeout(() => setMessage(''), 2600);
      setScreen(ruleReturnTo === 'newgame' ? 'newgame' : 'rules');
    } catch (e) {
      setError(`No se pudieron guardar las reglas: ${e.message}`);
    } finally {
      setBusy(false);
    }
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
  
  return <main className={`app-shell ${screen === 'play' ? 'app-shell-play' : ''}`}>
    {screen !== 'play' && <header className="topbar"><button className="brand" onClick={() => { setScreen(group ? 'group' : 'home'); setError(''); }} aria-label="Ir al inicio de Partiditas"><img className="brand-logo" src="/logo.png" alt=""/><span>partiditas<small>tu libreta de juegos</small></span></button><div className="topbar-actions"><button type="button" className="install-cta" onClick={openInstallHelp}><Download size={16}/> DESCARGÁ LA APP</button><a className="top-note" href="https://www.somosnomade.com.ar/" target="_blank" rel="noreferrer">hecho para jugar juntxs por <strong>NÓMADE</strong> <span>♥</span></a></div></header>}
    {error && <div className={`alert error ${screen === 'play' ? 'play-toast' : ''}`} role="alert">{error}<button onClick={() => setError('')} aria-label="Cerrar">×</button></div>}
    {message && <div className={`alert success ${screen === 'play' ? 'play-toast' : ''}`}>{message}</div>}
    {busy && <div className="busy"><LoaderCircle size={16} className="spin"/> Guardando…</div>}

    {screen === 'home' && <>
      <section className="hero home-hero-compact"><div><h1>Mis mesas</h1><p>Volvé a jugar en un toque.</p></div></section>
      <section className="section-head home-section-head"><div><h2>Tus mesas</h2><p className="section-subtitle">Tus grupos, siempre a mano.</p></div><div className="home-section-actions"><span className="count-pill">{groups.length} {groups.length === 1 ? 'mesa' : 'mesas'}</span><button type="button" className="button primary new-table-button" onClick={() => { setGroupForm(blankGroup); setError(''); setScreen('newgroup'); }}><Plus size={17}/> NUEVA MESA</button></div></section>
      {groups.length ? <div className="group-grid">{groups.map((g, i) => <article className={`group-card note-${i%4}`} key={g.id}>
        <button type="button" className="group-card-open" onClick={() => openGroup(g)} aria-label={`Abrir mesa ${g.name}`} disabled={busy}>
          <span className="pin">✦</span><span className="card-kicker">MESA DE JUEGO</span><strong>{g.name}</strong><span className="card-bottom"><Users size={15}/> Abrir mesa <span>↗</span></span>
        </button>
        <div className="group-card-actions" aria-label={`Acciones para ${g.name}`}>
          <button type="button" onClick={() => editGroup(g)} title={`Editar mesa ${g.name}`} aria-label={`Editar mesa ${g.name}`} disabled={busy}><Pencil size={14}/></button>
          <button type="button" className="delete-group-action" onClick={() => removeGroupFromDevice(g)} title={`Quitar ${g.name} de este dispositivo`} aria-label={`Quitar ${g.name} de este dispositivo`} disabled={busy}><X size={14}/></button>
        </div>
      </article>)}</div> : <div className="empty-state home-empty"><span>🗒️</span><strong>Este dispositivo todavía no tiene mesas guardadas</strong><p>Creá una nueva o sumate con el ID y la clave de una mesa existente.</p><button type="button" className="button secondary" onClick={() => setScreen('newgroup')}><Plus size={16}/> Nueva mesa</button></div>}
      <button type="button" className="join-trigger" onClick={() => { setError(''); setShowJoinModal(true); }}><span className="join-trigger-icon"><Users size={21}/></span><span><strong>Sumarme a una mesa</strong><small>Ingresá el código que te compartieron</small></span><ArrowLeft className="join-trigger-arrow" size={18}/></button>
      <p className="privacy-note"><NotebookPen size={15}/> Tus mesas se recuerdan en este dispositivo.</p>
    </>}

    {screen === 'newgroup' && <>
      <button className="back-link" onClick={() => setScreen('home')}><ArrowLeft size={16}/> Volver a mis mesas</button>
      <section className="form-panel new-group-panel"><span className="eyebrow">UNA MESA PROPIA</span><h1>¿Quiénes se juntan?</h1><p>Creá un espacio para tu grupo. Las partidas y los resultados van a quedar guardados en su propio historial.</p>
        <form onSubmit={createGroup}>
          <label>Nombre de la mesa<input required maxLength="60" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Ej. Los del domingo"/></label>
          <label>Clave privada del grupo<input value={groupForm.accessCode} onChange={e => setGroupForm({ ...groupForm, accessCode: e.target.value })} placeholder="Mínimo 12 caracteres" minLength={12} required autoComplete="new-password"/><small className="field-help">Compartila solo con tu grupo. Se recuerda en este dispositivo; si borrás los datos del navegador, necesitás el ID y la clave para volver.</small></label>
          <button className="button primary wide" disabled={busy}><Plus size={17}/> Crear mesa <span>→</span></button>
        </form>
      </section>
    </>}

    {screen === 'group' && group && <>
      <button className="back-link" onClick={() => setScreen('home')}><ArrowLeft size={16}/> Todas las mesas</button>
      <section className="group-banner"><div><span className="eyebrow">TU MESA PRIVADA</span><h1>{group.name}</h1><p>Compartí estos dos datos solo con quienes querés que entren a jugar.</p><div className="group-share-details"><div className="group-id"><span>ID de la mesa</span><code>{group.id}</code><button type="button" onClick={() => navigator.clipboard?.writeText(group.id)} title="Copiar ID">Copiar ID</button></div><div className="group-id"><span>Clave privada</span><code>{group.accessCode || 'Volvé a ingresar la clave para compartirla'}</code>{group.accessCode && <button type="button" onClick={() => navigator.clipboard?.writeText(group.accessCode)} title="Copiar clave privada">Copiar clave</button>}</div></div></div><div className="banner-stamp">QUE<br/>GANE<br/>EL MEJOR</div></section>
      <div className="action-row"><div><span className="eyebrow">¿QUÉ JUGAMOS?</span><h2>Elegí tu juego</h2></div><button className="button secondary" onClick={() => setScreen('rules')}><Settings2 size={16}/> Reglas</button></div>
      <div className="game-grid">{GAMES.map(g => <button className={`game-card ${g.color}`} key={g.id} onClick={() => { chooseGame(g.id); setScreen('newgame'); }}><span className="game-emoji">{g.emoji}</span><strong>{g.name}</strong><small>{g.description}</small><span className="game-arrow">↗</span></button>)}</div>
      <section className="history-section"><div className="section-head"><div><span className="eyebrow">LOS RECUERDOS</span><h2>Historial de partidas</h2></div><span className="count-pill">{history.length} partidas</span></div>{history.length ? <div className="history-list">{history.map((g, i) => { const inProgress = g.status !== 'finished' && !g.finishedAt; return <div className={`history-item ${inProgress ? 'history-item-open' : ''}`} key={g.id}><div className={`history-icon note-${i%4}`}>{GAMES.find(x => x.id === g.gameId)?.emoji || '🎲'}</div><div className="history-main"><strong>{g.title || g.gameName}</strong><span>{g.gameName} · {(g.players || []).map(p => p.name).join(', ')}</span><small>{inProgress ? 'Partida sin finalizar' : `Finalizada · ${new Date(g.finishedAt || g.createdAt).toLocaleDateString('es-AR')}`}</small></div><div className="history-score">{inProgress ? <button type="button" className="resume-game-button" onClick={() => resumeGame(g)} disabled={busy}>Continuar ↗</button> : g.winner ? <><Trophy size={15}/><span>{g.winner}</span></> : <span className="in-progress">Finalizada</span>}</div></div>;})}</div> : <div className="empty-state"><span>🗒️</span><strong>Acá van a quedar las partidas</strong><p>Cuando terminen de jugar, vas a poder volver a ver los resultados.</p></div>}</section>
    </>}

    {screen === 'newgame' && group && <>
      <button className="back-link" onClick={() => setScreen('group')}><ArrowLeft size={16}/> Volver a la mesa</button>
      <section className="form-panel"><span className="eyebrow">NUEVA PARTIDA</span><h1>Armemos la mesa.</h1><p>Configuramos el marcador según el juego que eligieron.</p>
        <form onSubmit={startGame}>
          <label>Juego<select value={gameForm.gameId} onChange={e => { chooseGame(e.target.value); }} >{GAMES.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
          <label>Nombre de la partida (opcional)<input value={gameForm.title} onChange={e => setGameForm({ ...gameForm, title: e.target.value })} placeholder="Ej. Final del campeonato"/></label>
          {gameForm.gameId === 'truco' ? <div className="truco-setup">
            <div className="team-setup-card team-us"><span className="eyebrow">EQUIPO 1</span><label>Nombre del equipo<input value={teamSetup.names[0]} onChange={e => setTeamSetup(s => ({ ...s, names: s.names.map((n,i) => i===0 ? e.target.value : n) }))} placeholder="Nosotros" required/></label><label>Integrantes (separados por coma)<input value={teamSetup.members[0]} onChange={e => setTeamSetup(s => ({ ...s, members: s.members.map((n,i) => i===0 ? e.target.value : n) }))} placeholder="Ej. Luli, Toto"/></label></div>
            <div className="team-setup-card team-them"><span className="eyebrow">EQUIPO 2</span><label>Nombre del equipo<input value={teamSetup.names[1]} onChange={e => setTeamSetup(s => ({ ...s, names: s.names.map((n,i) => i===1 ? e.target.value : n) }))} placeholder="Ellos" required/></label><label>Integrantes (separados por coma)<input value={teamSetup.members[1]} onChange={e => setTeamSetup(s => ({ ...s, members: s.members.map((n,i) => i===1 ? e.target.value : n) }))} placeholder="Ej. Fede, Juli"/></label></div>
            <p className="game-help">El marcador se lleva por equipos. Podés jugar mano a mano o en parejas; los nombres de quienes integran cada equipo quedan asociados a la partida.</p>
          </div> : <>
            <div className="players-head"><label>Jugadores <small>mínimo 2</small></label><button type="button" className="text-button" onClick={addPlayer}><Plus size={15}/> Agregar jugador</button></div>
            <div className="player-fields">{gameForm.players.map((p,i) => <div className="player-field" key={i}><span>{String(i+1).padStart(2,'0')}</span><input value={p} onChange={e => setPlayer(i,e.target.value)} placeholder={`Nombre de jugador/a ${i+1}`} required/><button type="button" title="Quitar jugador" disabled={gameForm.players.length<=2} onClick={() => setGameForm(f => ({ ...f, players: f.players.filter((_,j) => j!==i) }))}>×</button></div>)}</div>
          </>}
          <div className="rule-summary"><Settings2 size={17}/><span><strong>Reglas actuales:</strong> {rules[selectedGame.id].direction === 'lower' ? 'gana quien acumula menos' : 'gana quien acumula más'}{rules[selectedGame.id].target ? ` · objetivo ${rules[selectedGame.id].target} ${rules[selectedGame.id].unit}` : ''}</span><button type="button" onClick={() => openRuleEditor(selectedGame.id, 'newgame')}>Editar reglas</button></div>
          <button className="button primary wide" disabled={busy}>Empezar partida <span>→</span></button>
        </form>
      </section>
    </>}

    {screen === 'play' && activeGame && <>
      <section className="mobile-play-screen">
        <div className="mobile-play-top">
          <button className="mini-back" type="button" onClick={() => { if (activeGame.gameId === 'truco' && Object.values(roundScores).some(n => Number(n) !== 0)) { setError('Guardá los tantos pendientes antes de salir de la partida.'); return; } setScreen('group'); }}><ArrowLeft size={17}/><span>Mesa</span></button>
          <div className="mobile-play-title"><span className="eyebrow">{activeGame.gameName}</span><strong>{activeGame.title}</strong></div>
          <button className="mini-finish" type="button" onClick={finishGame} disabled={busy}><Trophy size={16}/></button>
        </div>

        <div className="mobile-play-content">
          {activeGame.gameId === 'truco' ? <>
            <div className="mobile-match-meta"><span>PARTIDO A {trucoTarget}</span><span>{(activeGame.rounds || []).length} manos guardadas</span></div>
            <div className="truco-tap-instruction">Tocá el lado del equipo para sumar 1 tanto. Cada grupo se completa con 5 rayas; al llegar a 15 pasan a las buenas.</div>
            <div className="truco-mobile-teams">
              {activeGame.players.map((p, i) => {
                const score = Math.max(0, Math.min(trucoTarget, shownTruco(p.name)));
                const malas = Math.min(score, trucoSplit);
                const buenas = Math.max(0, score - trucoSplit);
                const remainingSlots = trucoTarget - trucoSplit;
                const won = score >= trucoTarget;
                return <section className={`truco-mobile-team ${i === 0 ? 'team-mint' : 'team-rose'} ${won ? 'team-winner' : ''}`} key={p.id || p.name} onClick={(event) => { if (event.target.closest("button")) return; if (!busy && !won && score < trucoTarget) setTrucoScoreAt(p.name, score + 1); }} role="button" tabIndex={0} aria-label={`Sumar un tanto a ${p.name}`} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !busy && !won && score < trucoTarget) { event.preventDefault(); setTrucoScoreAt(p.name, score + 1); } }}>
                  <div className="truco-team-head"><div><span className="team-kicker">EQUIPO {i + 1}</span><h2>{p.name}</h2>{activeGame.rules?.teamMembers?.[p.name]?.length > 0 && <p>{activeGame.rules.teamMembers[p.name].join(' · ')}</p>}</div><div className="truco-score-bubble"><strong>{score}</strong><small>/{trucoTarget}</small></div></div>
                  <div className="tally-touch-area">
                    <div className="tally-section-mobile"><div className="tally-label-row"><span>MALAS</span><strong>{malas}<small>/{trucoSplit}</small></strong></div><div className="tally-bundles-grid">{Array.from({ length: Math.ceil(trucoSplit / 5) }, (_, n) => { const fill = Math.min(5, Math.max(0, malas - n * 5)); const blockEnd = Math.min((n + 1) * 5, trucoSplit); const canTap = !busy && !won && score < trucoSplit && score >= n * 5 && score < blockEnd; return <TallyBundle key={n} fill={fill} disabled={!canTap} onClick={() => setTrucoScoreAt(p.name, Math.min(trucoTarget, score + 1))} label={`Malas, bloque ${n + 1}: ${fill} de 5. Tocá para sumar el siguiente tanto.`} />; })}</div></div>
                    <div className="tally-section-mobile"><div className="tally-label-row"><span>BUENAS</span><strong>{buenas}<small>/{remainingSlots}</small></strong></div><div className="tally-bundles-grid">{Array.from({ length: Math.ceil(remainingSlots / 5) }, (_, n) => { const fill = Math.min(5, Math.max(0, buenas - n * 5)); const blockEnd = Math.min((n + 1) * 5, remainingSlots); const canTap = !busy && !won && score >= trucoSplit && buenas >= n * 5 && buenas < blockEnd; return <TallyBundle key={n} fill={fill} disabled={!canTap} onClick={() => setTrucoScoreAt(p.name, Math.min(trucoTarget, score + 1))} label={`Buenas, bloque ${n + 1}: ${fill} de 5. Tocá para sumar el siguiente tanto.`} />; })}</div></div>
                    <span className="tap-hint">{won ? '¡Llegó a la meta!' : score < trucoSplit ? 'Marcá las malas; las buenas se habilitan al completar 15.' : 'Tocá el bloque incompleto para dibujar el siguiente tanto.'}</span>
                  </div>
                  <div className="team-score-actions"><button type="button" onClick={() => setTrucoScoreAt(p.name, Math.max(0, score - 1))} disabled={busy || score <= (Number(totals[p.name]) || 0)}>− 1 tanto</button><button type="button" onClick={() => setTrucoScoreAt(p.name, Math.min(trucoTarget, score + 1))} disabled={busy || score >= trucoTarget}>+ 1 tanto</button></div>
                </section>;
              })}
            </div>
            {Object.values(roundScores).some(n => Number(n) !== 0) && <div className="pending-round-banner"><span>✦ Hay tantos sin guardar</span><strong>{Object.values(roundScores).reduce((sum, n) => sum + (Number(n) || 0), 0)} tanto(s)</strong></div>}
          </> : <>
            <div className="mobile-match-meta"><span>RONDA {(activeGame.rounds || []).length + 1}</span><span>{(activeGame.rounds || []).length} rondas guardadas</span></div>
            <section className="mobile-score-cards">
              {ranking.map(([name, score], i) => <article className={`mobile-player-score ${i === 0 ? 'is-leading' : ''}`} key={name}>
                <span className="mobile-player-rank">{i === 0 ? '★' : String(i + 1).padStart(2, '0')}</span><div className="mobile-player-data"><strong>{name}</strong><small>{i === 0 ? (activeGame.rules?.direction === 'lower' ? 'Menor puntaje' : 'Va primero') : 'Puntaje acumulado'}</small></div><strong className="mobile-player-total">{score}</strong>
              </article>)}
            </section>
            <div className="mobile-score-summary"><span>{activeGame.gameName}</span><strong>{activeGame.rules?.direction === 'lower' ? 'Gana el puntaje más bajo' : 'Gana el puntaje más alto'}</strong></div>
            {(activeGame.rounds || []).length > 0 && <section className="mobile-last-round"><div><span className="eyebrow">ÚLTIMA JUGADA</span><strong>{activeGame.rounds[activeGame.rounds.length - 1].note || `Ronda ${activeGame.rounds.length}`}</strong></div><span>{new Date(activeGame.rounds[activeGame.rounds.length - 1].createdAt || Date.now()).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span></section>}
          </>}

          {activeGame.gameId !== 'truco' && activeGame.gameId === 'chinchon' && activeGame.rules?.endAtTarget !== false && activeGame.players.some(p => Number(totals[p.name]) >= Number(activeGame.rules?.target)) && <div className="mobile-notice">Alguien alcanzó el límite de puntos. Revisá el marcador antes de cerrar.</div>}
          <section className={`mobile-history ${showPlayHistory ? 'is-open' : ''}`}>
            <button type="button" className="mobile-history-heading" onClick={() => setShowPlayHistory(value => !value)} aria-expanded={showPlayHistory}>
              <h3>Jugadas anteriores</h3><span>{(activeGame.rounds || []).length}</span><span className="history-chevron">{showPlayHistory ? '−' : '+'}</span>
            </button>
            {showPlayHistory && ((activeGame.rounds || []).length ? [...activeGame.rounds].reverse().map((r, i) => <div className="mobile-history-row" key={r.id || i}><div className="round-number-badge">{r.roundNumber || activeGame.rounds.length - i}</div><div className="mobile-history-text"><strong>{r.note || `Ronda ${r.roundNumber || activeGame.rounds.length - i}`}</strong><small>{activeGame.players.map(p => `${p.name}: ${r.scores?.[p.name] ?? 0}`).join(' · ')}</small></div></div>) : <p className="mobile-empty-history">Todavía no hay jugadas guardadas.</p>)}
          </section>
        </div>
        <div className="mobile-play-bottom">
          {activeGame.gameId === 'truco' ? <button type="button" className="mobile-primary-action" onClick={openRoundModal} disabled={busy || !Object.values(roundScores).some(n => Number(n) !== 0)}><Check size={18}/> Registrar mano {Object.values(roundScores).some(n => Number(n) !== 0) ? `· ${Object.values(roundScores).reduce((sum, n) => sum + (Number(n) || 0), 0)} tantos` : ''}</button> : <button type="button" className="mobile-primary-action" onClick={openRoundModal} disabled={busy}><PlusCircle size={18}/> Cargar jugada</button>}
          <button type="button" className="mobile-secondary-action" onClick={() => { if (activeGame.gameId === 'truco' && Object.values(roundScores).some(n => Number(n) !== 0)) { setError('Guardá los tantos pendientes antes de salir.'); return; } setScreen('group'); }}><ArrowLeft size={16}/> Volver a la mesa</button>
        </div>
      </section>
    </>}

    {screen === 'rules' && <>
      <button className="back-link" onClick={() => setScreen(group ? 'group' : 'home')}><ArrowLeft size={16}/> Volver</button>
      <section className="form-panel rules-panel rules-picker-panel"><span className="eyebrow">AJUSTES DE JUEGO</span><h1>Reglas a tu manera.</h1><p>Elegí un juego para configurar solamente sus reglas. Cada marcador tiene sus propias opciones.</p>
        <div className="rule-picker-grid">{GAMES.map(g => <button type="button" className={`rule-picker-card ${g.color}`} key={g.id} onClick={() => openRuleEditor(g.id, 'rules')}><span className="rule-picker-emoji">{g.emoji}</span><span className="rule-picker-name">{g.name}</span><span className="rule-picker-description">{g.description}</span><span className="rule-picker-link">Editar reglas <span>↗</span></span></button>)}</div>
      </section>
    </>}

    {screen === 'rule-editor' && <>
      <button className="back-link" onClick={() => setScreen(ruleReturnTo === 'newgame' ? 'newgame' : 'rules')}><ArrowLeft size={16}/> {ruleReturnTo === 'newgame' ? 'Volver a la partida' : 'Volver a los juegos'}</button>
      <section className="form-panel rules-panel rule-editor-panel"><div className={`rule-editor-hero ${ruleGame.color}`}><span className="rule-editor-emoji">{ruleGame.emoji}</span><span className="eyebrow">EDITOR EXCLUSIVO</span><h1>Reglas de {ruleGame.name}</h1><p>Estos ajustes se aplican a las nuevas partidas de este juego en la mesa {group?.name ? `“${group.name}”` : 'actual'}.</p></div>
        <div className="rule-card rule-editor-card">
          <div className="rule-title"><span>{ruleGame.emoji}</span><strong>{ruleGame.name}</strong><span className="saved-note">Cambios pendientes de guardar</span></div>
          {ruleGame.id !== 'truco' && <label>¿Cómo se gana?<select value={ruleValues.direction} onChange={e => changeRuleDraft('direction', e.target.value)}><option value="higher">Gana el puntaje más alto</option><option value="lower">Gana el puntaje más bajo</option></select></label>}
          <div className="rule-two"><label>{ruleGame.id === 'chinchon' || ruleGame.id === 'rummy' ? 'Límite de puntos' : ruleGame.id === 'truco' ? 'Objetivo del partido' : ruleGame.id === 'escoba' ? 'Objetivo de tantos' : 'Objetivo (0 = sin objetivo)'}<input type="number" min={ruleGame.id === 'truco' ? 2 : 0} value={ruleValues.target ?? 0} onChange={e => changeRuleDraft('target', Math.max(ruleGame.id === 'truco' ? 2 : 0, Number(e.target.value)))} /></label><label>Nombre del puntaje<input value={ruleValues.unit || ''} onChange={e => changeRuleDraft('unit', e.target.value)} placeholder="puntos, tantos…" maxLength="24"/></label></div>
          {ruleGame.id === 'chinchon' && <>
            <label>Bonus por hacer chinchón (se resta)<input type="number" min="0" value={ruleValues.chinchonBonus ?? 10} onChange={e => changeRuleDraft('chinchonBonus', Math.max(0, Number(e.target.value)))}/></label>
            <label>¿Avisar cuando alguien alcance el límite?<select value={ruleValues.endAtTarget === false ? 'no' : 'yes'} onChange={e => changeRuleDraft('endAtTarget', e.target.value === 'yes')}><option value="yes">Sí, mostrar aviso</option><option value="no">No mostrar aviso</option></select></label>
            <p className="rule-explainer">La app suma las penalizaciones que ingresás en cada ronda. Si alguien hace chinchón, podés aplicar el bonus configurado.</p>
          </>}
          {ruleGame.id === 'escoba' && <>
            <div className="rule-two"><label>Puntos por cada escoba<input type="number" min="0" max="20" value={ruleValues.pointsPerEscoba ?? 1} onChange={e => changeRuleDraft('pointsPerEscoba', Math.max(0, Number(e.target.value)))}/></label><label>Puntos por categoría<input type="number" min="0" max="20" value={ruleValues.pointsPerCategory ?? 1} onChange={e => changeRuleDraft('pointsPerCategory', Math.max(0, Number(e.target.value)))}/></label></div>
            <p className="rule-explainer">Las categorías son más cartas, más oros, siete de oros y más sietes. Los empates pueden quedar sin punto. Al cargar una ronda, indicás cuántas escobas consiguió cada jugador.</p>
          </>}
          {ruleGame.id === 'truco' && <>
            <label>División entre malas y buenas<input type="number" min="1" max={Math.max(1, Number(ruleValues.target) - 1)} value={ruleValues.splitAt ?? Math.floor(Number(ruleValues.target || 30) / 2)} onChange={e => changeRuleDraft('splitAt', Math.max(1, Math.min(Math.max(1, Number(ruleValues.target) - 1), Number(e.target.value) || 1)))}/><small className="field-help">Ejemplo: un partido a 30 tantos se divide en 15 malas y 15 buenas.</small></label>
            <p className="rule-explainer">El marcador se lleva por dos equipos. Los botones rápidos suman de 1 a 4 tantos. Podés anotar en la mano si fueron envido, real envido, truco, retruco o vale cuatro.</p>
          </>}
          {ruleGame.id === 'rummy' && <p className="rule-explainer">Esta variante acumula manualmente los valores de las cartas que quedan en la mano. Con “gana el puntaje más bajo”, vence quien acumule menos penalizaciones.</p>}
          {ruleGame.id === 'libre' && <p className="rule-explainer">Marcador flexible: en cada ronda podés sumar o restar cualquier cantidad. Elegí si gana el puntaje más alto o el más bajo, y dejá el objetivo en 0 si no hay una meta.</p>}
        </div>
        <div className="rule-editor-actions"><button type="button" className="button secondary" onClick={() => setScreen(ruleReturnTo === 'newgame' ? 'newgame' : 'rules')}>Cancelar</button><button type="button" className="button primary" onClick={saveRuleEditor} disabled={busy}><Check size={16}/> Guardar reglas</button></div>
      </section>
    </>}
    {showRoundModal && activeGame && <div className="mobile-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) cancelRoundModal(); }}>
      <section className="mobile-round-modal" role="dialog" aria-modal="true" aria-labelledby="round-modal-title">
        <div className="mobile-modal-grabber" />
        <div className="mobile-modal-head"><div><span className="eyebrow">{activeGame.gameName.toUpperCase()}</span><h2 id="round-modal-title">{activeGame.gameId === 'truco' ? 'Registrar la mano' : 'Cargar jugada'}</h2><p>{activeGame.gameId === 'truco' ? 'Dejá anotado qué pasó en esta mano.' : 'Ingresá los puntos y guardá la ronda.'}</p></div><button type="button" className="modal-x" onClick={cancelRoundModal} aria-label="Cerrar">×</button></div>
        <div className="mobile-modal-scroll">
          {activeGame.gameId === 'truco' ? <>
            <div className="modal-score-preview">{activeGame.players.map(p => <div key={p.name}><span>{p.name}</span><strong>+{Number(roundScores[p.name]) || 0}</strong></div>)}</div>
            <label className="mobile-modal-label">¿Qué pasó en la mano?<input value={roundNote} onChange={e => setRoundNote(e.target.value)} placeholder="Envido, retruco, vale cuatro…" /></label>
            <p className="modal-help">Los tantos se marcaron tocando las líneas del tablero. Al guardar, se registran en Google Sheets.</p>
          </> : <>
            <div className="modal-players-inputs">{activeGame.players.map((p, i) => <label className="mobile-modal-label" key={p.id || p.name}><span>{activeGame.gameId === 'escoba' ? `${p.name} · escobas` : activeGame.gameId === 'chinchon' ? `${p.name} · penalización` : activeGame.gameId === 'rummy' ? `${p.name} · puntos de cartas` : p.name}</span><div className="mobile-number-control"><button type="button" aria-label="Restar un punto" onClick={() => setRoundScores(s => ({ ...s, [p.name]: (Number(s[p.name]) || 0) - 1 }))}>−</button><input type="number" inputMode="decimal" value={roundScores[p.name] ?? 0} onChange={e => setRoundScores(s => ({ ...s, [p.name]: e.target.value }))} placeholder="0"/><button type="button" aria-label="Sumar un punto" onClick={() => setRoundScores(s => ({ ...s, [p.name]: (Number(s[p.name]) || 0) + 1 }))}>+</button></div></label>)}</div>
            {activeGame.gameId === 'escoba' && <div className="mobile-modal-special"><h3>Categorías de la mano</h3>{[['masCartas','Más cartas'],['masOros','Más oros'],['sieteOro','Siete de oros'],['masSietes','Más sietes']].map(([key,label]) => <label className="mobile-modal-label" key={key}>{label}<select value={escobaAwards[key]} onChange={e => setEscobaAwards(v => ({ ...v, [key]: e.target.value }))}><option value="">Sin punto / empate</option>{activeGame.players.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select></label>)}</div>}
            {activeGame.gameId === 'chinchon' && <label className="mobile-modal-label">¿Alguien hizo chinchón?<select value={chinchonPlayer} onChange={e => setChinchonPlayer(e.target.value)}><option value="">No aplicar bonus</option>{activeGame.players.map(p => <option key={p.name} value={p.name}>{p.name} (−{Math.abs(Number(activeGame.rules?.chinchonBonus ?? 10))} puntos)</option>)}</select></label>}
            <label className="mobile-modal-label">Nota de la jugada (opcional)<input value={roundNote} onChange={e => setRoundNote(e.target.value)} placeholder="Ej. cierre, escoba de mano…" /></label>
          </>}
        </div>
        <div className="mobile-modal-actions"><button type="button" className="mobile-secondary-action" onClick={cancelRoundModal}>Cancelar</button><button type="button" className="mobile-primary-action" onClick={addRound} disabled={busy || (activeGame.gameId === 'truco' && !Object.values(roundScores).some(n => Number(n) !== 0))}><Check size={17}/> Guardar jugada</button></div>
      </section>
    </div>}

    {winnerInfo && <div className="winner-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setWinnerInfo(null); }}>
      <div className="confetti-layer" aria-hidden="true">{Array.from({ length: 34 }, (_, i) => <i key={i} style={{ '--i': i, '--x': `${(i * 37) % 100}%`, '--delay': `${(i % 9) * -0.23}s`, '--hue': `${(i * 41) % 360}` }} />)}</div>
      <section className="winner-card" role="dialog" aria-modal="true" aria-labelledby="winner-title"><div className="winner-sparkle">✦</div><span className="winner-kicker">PARTIDA TERMINADA</span><h2 id="winner-title">¡Tenemos ganador/a!</h2><div className="winner-trophy">🏆</div><p className="winner-caption">La victoria de esta partida es para</p><strong className="winner-name">{winnerInfo.winner}</strong><span className="winner-game-name">{winnerInfo.gameName} · {winnerInfo.title}</span><div className="winner-results">{Object.entries(winnerInfo.totals || {}).sort((a,b) => (winnerInfo.direction === 'lower' ? a[1]-b[1] : b[1]-a[1])).map(([name, score], i) => <div key={name} className={name === winnerInfo.winner ? 'winner-result leader' : 'winner-result'}><span>{i === 0 ? '★' : String(i + 1).padStart(2, '0')} {name}</span><strong>{score}</strong></div>)}</div><button type="button" className="mobile-primary-action winner-dismiss" onClick={() => setWinnerInfo(null)}><Trophy size={17}/> Volver a la mesa</button><a href="https://www.somosnomade.com.ar/" target="_blank" rel="noreferrer" className="winner-brand">hecho para jugar juntxs por <strong>NÓMADE</strong> ♥</a></section>
    </div>}

    {showInstallHelp && <div className="install-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowInstallHelp(false); }}>
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button className="install-close" type="button" onClick={() => setShowInstallHelp(false)} aria-label="Cerrar instrucciones"><X size={18}/></button>
        <div className="install-intro"><img src="/logo.png" alt="Logo de Partiditas"/><div><span className="eyebrow">PARTIDITAS EN TU CELULAR</span><h2 id="install-title">Llevá la mesa con vos.</h2><p>Agregá Partiditas a la pantalla de inicio para abrirla como una app.</p></div></div>
        <div className="install-tabs" role="tablist" aria-label="Elegí tu dispositivo">
          <button type="button" role="tab" aria-selected={installTab === 'iphone'} className={installTab === 'iphone' ? 'active' : ''} onClick={() => setInstallTab('iphone')}>iPhone / iPad</button>
          <button type="button" role="tab" aria-selected={installTab === 'android'} className={installTab === 'android' ? 'active' : ''} onClick={() => setInstallTab('android')}>Android</button>
        </div>
        {installTab === 'iphone' ? <div className="install-instructions">
          <p className="install-platform-label"><Smartphone size={17}/> En iPhone o iPad</p>
          <ol><li>Abrí <strong>{window.location.host}</strong> en <strong>Safari</strong>.</li><li>Tocá el botón <strong>Compartir</strong> <Share size={14} className="inline-install-icon"/> (el cuadrado con la flecha hacia arriba).</li><li>Deslizá las opciones y elegí <strong>Agregar a pantalla de inicio</strong>.</li><li>Confirmá con <strong>Agregar</strong>. Listo: vas a ver el ícono de Partiditas entre tus apps.</li></ol>
          <p className="install-hint">Si no aparece la opción, asegurate de abrir la web en Safari y no dentro de otra aplicación.</p>
        </div> : <div className="install-instructions">
          <p className="install-platform-label"><Smartphone size={17}/> En Android</p>
          {deferredInstallPrompt && <button type="button" className="button primary wide install-now-button" onClick={installOnAndroid}><Download size={16}/> Instalar ahora</button>}
          <ol><li>Abrí <strong>{window.location.host}</strong> en <strong>Google Chrome</strong>.</li><li>{deferredInstallPrompt ? <>También podés tocar <strong>Instalar ahora</strong> arriba y aceptar el aviso de Chrome.</> : <>Tocá el menú de los tres puntos <strong>⋮</strong>, arriba a la derecha.</>}</li><li>Elegí <strong>Instalar aplicación</strong> o <strong>Agregar a pantalla principal</strong>. El nombre puede variar según el teléfono.</li><li>Confirmá con <strong>Instalar</strong> o <strong>Agregar</strong>. Después vas a encontrar Partiditas en la pantalla de inicio.</li></ol>
          {!deferredInstallPrompt && <p className="install-hint">Si Chrome ofrece directamente “Instalar aplicación”, usá esa opción. No hace falta descargar un APK.</p>}
        </div>}
        <div className="install-footer-note"><img src="/logo.png" alt=""/><p>Es una aplicación web instalable. Las partidas se siguen guardando en Google Sheets; la instalación no crea una copia de tus partidas en el teléfono.</p></div>
      </section>
    </div>}
    {screen !== 'play' && <footer><span className="footer-brand"><img src="/logo.png" alt=""/><span>partiditas</span></span><a className="footer-nomade" href="https://www.somosnomade.com.ar/" target="_blank" rel="noreferrer">hecho para jugar juntxs por <strong>NÓMADE</strong> <span>♥</span></a></footer>}
    {showJoinModal && <div className="mobile-modal-backdrop join-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowJoinModal(false); }}><section className="mobile-round-modal join-modal" role="dialog" aria-modal="true" aria-labelledby="join-modal-title"><div className="mobile-modal-grabber"/><div className="mobile-modal-head"><div><span className="eyebrow">ENTRAR A UN GRUPO</span><h2 id="join-modal-title">Sumarme a una mesa</h2><p>Usá el ID y la clave que te compartieron.</p></div><button type="button" className="modal-x" onClick={() => setShowJoinModal(false)} aria-label="Cerrar">×</button></div><form onSubmit={joinGroup} className="join-modal-form"><label className="mobile-modal-label">Código o ID de la mesa<input value={joinCode} onChange={e => setJoinCode(e.target.value)} required autoComplete="off" placeholder="Pegá el ID"/></label><label className="mobile-modal-label">Clave privada<input value={joinAccessCode} onChange={e => setJoinAccessCode(e.target.value)} required autoComplete="current-password" placeholder="Clave de la mesa"/></label><button className="mobile-primary-action" disabled={busy}><Users size={17}/> Entrar a la mesa</button></form></section></div>)}
  </main>;
}
