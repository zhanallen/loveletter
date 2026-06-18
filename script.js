/* ---------------- Firebase setup ----------------
   Fill these in with your own Firebase project's web config
   (Firebase console → Project settings → General → Your apps → Web app → SDK setup).
   These values are not secret — Firebase apps are secured via Realtime Database
   rules, not by hiding the config. See the setup notes shared alongside this file. */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD96EgkUG-4ibVF658eNbTsQG3j6-saH_M",
  authDomain: "loveletter-b1161.firebaseapp.com",
  databaseURL: "https://loveletter-b1161-default-rtdb.firebaseio.com",
  projectId: "loveletter-b1161",
  storageBucket: "loveletter-b1161.firebasestorage.app",
  messagingSenderId: "88339333761",
  appId: "1:88339333761:web:e8d3326fb7e588861d8380",
  measurementId: "G-R4CJG9QZCR"
};
const FIREBASE_READY = FIREBASE_CONFIG.apiKey !== "REPLACE_ME";
let db=null;
if(FIREBASE_READY){
  firebase.initializeApp(FIREBASE_CONFIG);
  db=firebase.database();
}

/* ---------------- Sound & voice ---------------- */
let soundEnabled=true, voiceEnabled=false;
try{ soundEnabled = localStorage.getItem('loveletter_sound')!=='off'; }catch(e){}
try{ voiceEnabled = localStorage.getItem('loveletter_voice')==='on'; }catch(e){}
let audioCtx=null;
function getAudioCtx(){
  if(!audioCtx){
    try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; }
  }
  return audioCtx;
}
function unlockAudio(){
  const ctx=getAudioCtx();
  if(ctx && ctx.state==='suspended'){ ctx.resume().catch(()=>{}); }
}
document.addEventListener('click', unlockAudio, true);
function vibrate(pattern){
  if(!soundEnabled) return;
  try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
}
let originalTitle=null;
function flashTitle(msg){
  if(!soundEnabled) return;
  if(!originalTitle) originalTitle=document.title;
  try{ document.title=msg; }catch(e){}
}
function restoreTitle(){
  if(originalTitle){ try{ document.title=originalTitle; }catch(e){} }
}
try{
  window.addEventListener('focus', restoreTitle);
}catch(e){}
function beep(freq, duration, type, delay, volume){
  if(!soundEnabled) return;
  const ctx=getAudioCtx();
  if(!ctx) return;
  if(ctx.state==='suspended'){ ctx.resume().catch(()=>{}); }
  try{
    const t0=ctx.currentTime+(delay||0);
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type=type||'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume!=null?volume:0.12, t0+0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0+(duration||0.1));
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0+(duration||0.1)+0.02);
  }catch(e){}
}
function sfxDraw(){ beep(520,0.07,'sine'); }
function sfxPlay(){ beep(360,0.09,'triangle'); beep(500,0.09,'triangle',0.07); }
function sfxEliminate(){ beep(320,0.14,'sawtooth'); beep(190,0.22,'sawtooth',0.12); }
function sfxYourTurn(){ beep(660,0.09,'sine'); beep(880,0.12,'sine',0.11); }
function sfxEmote(){ beep(720,0.06,'square'); beep(920,0.07,'square',0.06); }
function sfxRoundEnd(){ beep(523,0.1,'sine'); beep(659,0.14,'sine',0.1); }
function sfxWin(){ beep(523,0.12,'sine'); beep(659,0.12,'sine',0.12); beep(784,0.2,'sine',0.24); }
function sfxTick(){ beep(440,0.06,'sine'); }
function sfxGo(){ beep(880,0.22,'sine'); }
function speak(text){
  if(!voiceEnabled) return;
  try{
    if(!('speechSynthesis' in window)) return;
    const u=new SpeechSynthesisUtterance(text);
    u.lang='zh-TW'; u.rate=1.05;
    speechSynthesis.speak(u);
  }catch(e){}
}
function toggleSound(){
  soundEnabled=!soundEnabled;
  try{ localStorage.setItem('loveletter_sound', soundEnabled?'on':'off'); }catch(e){}
  if(soundEnabled) beep(660,0.08,'sine');
  render();
}
function toggleVoice(){
  voiceEnabled=!voiceEnabled;
  try{ localStorage.setItem('loveletter_voice', voiceEnabled?'on':'off'); }catch(e){}
  if(voiceEnabled) speak('語音播報已開啟');
  render();
}
let settingsOpen=false;
function toggleSettings(){ settingsOpen=!settingsOpen; render(); }
function renderSettingsModal(){
  return `<div class="modal-overlay" onclick="if(event.target===this) toggleSettings()">
    <div class="modal-box">
      <h3>音效與語音</h3>
      <div class="player-row" style="background:rgba(0,0,0,0.05);color:var(--ink);">
        <span>音效・震動・分頁提醒</span>
        <span class="btn secondary" style="padding:5px 14px;" onclick="toggleSound()">${soundEnabled?'開':'關'}</span>
      </div>
      <div class="player-row" style="background:rgba(0,0,0,0.05);color:var(--ink);margin-top:8px;">
        <span>語音播報最新動態</span>
        <span class="btn secondary" style="padding:5px 14px;" onclick="toggleVoice()">${voiceEnabled?'開':'關'}</span>
      </div>
      <p class="hint" style="margin-top:10px;">語音播報是用瀏覽器內建的文字轉語音朗讀,音色跟支援度依手機/瀏覽器而不同。</p>
      <div class="btn full mt14" onclick="toggleSettings()">關閉</div>
    </div>
  </div>`;
}
let lastCountdownTick=null;

/* ---------------- Card definitions ---------------- */
const CARDS = {
  1:{name:'衛兵',roman:'I',count:5,desc:'指定一名玩家並猜測其手牌(不可猜「衛兵」)。猜中則該玩家立即出局。'},
  2:{name:'神父',roman:'II',count:2,desc:'查看任一玩家的手牌內容。'},
  3:{name:'男爵',roman:'III',count:2,desc:'與任一玩家秘密比較手牌,點數較小的一方出局。'},
  4:{name:'侍女',roman:'IV',count:2,desc:'保護自己,直到你的下一回合開始前不會被其他效果指定。'},
  5:{name:'王子',roman:'V',count:2,desc:'指定任一玩家(包括自己)棄掉手牌,並重新抽一張新牌。'},
  6:{name:'國王',roman:'VI',count:1,desc:'與任一玩家交換手牌。'},
  7:{name:'伯爵夫人',roman:'VII',count:1,desc:'若同時持有「國王」或「王子」,必須棄掉此牌。單獨棄掉沒有其他效果。'},
  8:{name:'公主',roman:'VIII',count:1,desc:'萬萬不可棄掉這張牌——無論原因,棄掉公主就立即出局。'}
};
function cardName(v){return CARDS[v]?CARDS[v].name:'?';}
function cardRoman(v){return CARDS[v]?CARDS[v].roman:'?';}
function cardDesc(v){return CARDS[v]?CARDS[v].desc:'';}

const CARD_ICONS = {
  1:'<svg viewBox="0 0 64 64"><path d="M32 6 L54 14 V30 C54 46 44 56 32 60 C20 56 10 46 10 30 V14 Z"/><path d="M32 18 V46 M22 26 H42"/></svg>',
  2:'<svg viewBox="0 0 64 64"><path d="M8 32 C20 16 44 16 56 32 C44 48 20 48 8 32 Z"/><circle cx="32" cy="32" r="7"/><circle cx="32" cy="32" r="1.6" fill="currentColor" stroke="none"/></svg>',
  3:'<svg viewBox="0 0 64 64"><path d="M12 12 L52 52 M12 52 L52 12"/><path d="M12 12 L19 12 M12 12 L12 19 M52 52 L45 52 M52 52 L52 45 M12 52 L19 52 M12 52 L12 45 M52 12 L45 12 M52 12 L52 19"/></svg>',
  4:'<svg viewBox="0 0 64 64"><path d="M32 8 C46 8 54 22 52 38 C50 50 42 56 32 58 C22 56 14 50 12 38 C10 22 18 8 32 8 Z"/><path d="M21 30 C26 25 38 25 43 30"/></svg>',
  5:'<svg viewBox="0 0 64 64"><path d="M10 42 L18 20 L32 36 L46 20 L54 42 Z"/><path d="M10 42 H54 V49 H10 Z"/><circle cx="32" cy="14" r="2.6" fill="currentColor" stroke="none"/></svg>',
  6:'<svg viewBox="0 0 64 64"><path d="M8 44 L14 18 L24 34 L32 14 L40 34 L50 18 L56 44 Z"/><path d="M8 44 H56 V51 H8 Z"/><circle cx="32" cy="10" r="2.6" fill="currentColor" stroke="none"/><circle cx="14" cy="14" r="2" fill="currentColor" stroke="none"/><circle cx="50" cy="14" r="2" fill="currentColor" stroke="none"/></svg>',
  7:'<svg viewBox="0 0 64 64"><path d="M32 56 L10 18 C20 10 44 10 54 18 Z"/><path d="M32 56 L18 22 M32 56 L25 16 M32 56 L32 13 M32 56 L39 16 M32 56 L46 22"/></svg>',
  8:'<svg viewBox="0 0 64 64"><path d="M32 14 C40 14 46 22 44 30 C50 28 54 32 52 38 C56 38 58 44 54 48 C48 52 38 50 32 56 C26 50 16 52 10 48 C6 44 8 38 12 38 C10 32 14 28 20 30 C18 22 24 14 32 14 Z"/><circle cx="32" cy="34" r="4" fill="currentColor" stroke="none"/></svg>'
};
function cardIcon(v){ return CARD_ICONS[v] || ''; }

const CARD_IMAGES = {
  1: './images/cards/card_1_guard.png',
  2: './images/cards/card_2_priest.png',
  3: './images/cards/card_3_baron.png',
  4: './images/cards/card_4_handmaid.png',
  5: './images/cards/card_5_prince.png',
  6: './images/cards/card_6_king.png',
  7: './images/cards/card_7_countess.png',
  8: './images/cards/card_8_princess.png'
};
function cardImage(v){ return CARD_IMAGES[v] || ''; }

/* ---------------- Table Seating Helpers ---------------- */
function getSeatedPlayers() {
  if (!state || !state.players) return [];
  const players = state.players;
  let meIdx = players.findIndex(p => p.id === myId);
  if (meIdx === -1) meIdx = 0;
  
  const rotated = [];
  for (let i = 0; i < players.length; i++) {
    rotated.push(players[(meIdx + i) % players.length]);
  }
  return rotated;
}

function getSeatStyle(numPlayers, seatIndex, mobile) {
  if (mobile) {
    // Portrait canvas (400 x 600): me at the bottom, opponents up top / on the sides.
    if (seatIndex === 0) return 'bottom: 16px; left: 50%; transform: translateX(-50%);';
    if (numPlayers === 2) {
      if (seatIndex === 1) return 'top: 16px; left: 50%; transform: translateX(-50%);';
    } else if (numPlayers === 3) {
      if (seatIndex === 1) return 'top: 18px; left: 24%; transform: translateX(-50%);';
      if (seatIndex === 2) return 'top: 18px; right: 24%; transform: translateX(50%);';
    } else if (numPlayers === 4) {
      if (seatIndex === 1) return 'top: 40%; left: 10px; transform: translateY(-50%);';
      if (seatIndex === 2) return 'top: 16px; left: 50%; transform: translateX(-50%);';
      if (seatIndex === 3) return 'top: 40%; right: 10px; transform: translateY(-50%);';
    }
    return 'top: 0; left: 0;';
  }
  if (seatIndex === 0) {
    return 'bottom: 12px; left: 50%; transform: translateX(-50%);';
  }
  if (numPlayers === 2) {
    if (seatIndex === 1) return 'top: 12px; left: 50%; transform: translateX(-50%);';
  } else if (numPlayers === 3) {
    if (seatIndex === 1) return 'top: 25px; left: 20%; transform: translateX(-50%);';
    if (seatIndex === 2) return 'top: 25px; right: 20%; transform: translateX(50%);';
  } else if (numPlayers === 4) {
    if (seatIndex === 1) return 'top: 45%; left: 12px; transform: translateY(-50%);';
    if (seatIndex === 2) return 'top: 12px; left: 50%; transform: translateX(-50%);';
    if (seatIndex === 3) return 'top: 45%; right: 12px; transform: translateY(-50%);';
  }
  return 'top: 0; left: 0;';
}

function getDiscardStyle(numPlayers, seatIndex, mobile) {
  if (mobile) {
    // Portrait canvas (400 x 600). Keep each pile near its owner but clear of the
    // centre piles and the player's own hand (which sits across the bottom).
    if (seatIndex === 0) return 'bottom: 16px; left: 12px; justify-content: flex-start; max-width: 124px;';
    if (numPlayers === 2) {
      if (seatIndex === 1) return 'top: 96px; left: 50%; transform: translateX(-50%); justify-content: center;';
    } else if (numPlayers === 3) {
      if (seatIndex === 1) return 'top: 98px; left: 24%; transform: translateX(-50%); justify-content: center; max-width: 130px;';
      if (seatIndex === 2) return 'top: 98px; right: 24%; transform: translateX(50%); justify-content: center; max-width: 130px;';
    } else if (numPlayers === 4) {
      if (seatIndex === 1) return 'top: 58%; left: 10px; justify-content: flex-start; max-width: 96px;';
      if (seatIndex === 2) return 'top: 96px; left: 50%; transform: translateX(-50%); justify-content: center;';
      if (seatIndex === 3) return 'top: 58%; right: 10px; justify-content: flex-end; max-width: 96px;';
    }
    return 'display: none;';
  }
  if (seatIndex === 0) {
    return 'bottom: 80px; left: calc(50% + 110px); justify-content: flex-start;';
  }
  if (numPlayers === 2) {
    if (seatIndex === 1) return 'top: 110px; left: 50%; transform: translateX(-50%); justify-content: center;';
  } else if (numPlayers === 3) {
    if (seatIndex === 1) return 'top: 120px; left: 28%; transform: translateX(-50%);';
    if (seatIndex === 2) return 'top: 120px; right: 28%; transform: translateX(50%);';
  } else if (numPlayers === 4) {
    if (seatIndex === 1) return 'top: 45%; left: 130px; transform: translateY(-50%); flex-direction: row;';
    if (seatIndex === 2) return 'top: 110px; left: 50%; transform: translateX(-50%); justify-content: center;';
    if (seatIndex === 3) return 'top: 45%; right: 130px; transform: translateY(-50%); flex-direction: row-reverse;';
  }
  return 'display: none;';
}

/* ---------------- Global session ---------------- */
let roomCode=null, myId=null, myName='';
let state=null;
let localUI={stage:null, selectedCard:null, targetId:null, guess:null};
let rulesOpen=false;
let roomMenuOpen=false;
function toggleRoomMenu(){ roomMenuOpen=!roomMenuOpen; render(); }
let chatOpen=false;
let chatUnread=0;
let chatDraft='';
function toggleChat(){ chatOpen=!chatOpen; if(chatOpen) chatUnread=0; render(); }
function onChatInput(v){ chatDraft=v; }
async function sendChatMessage(){
  const text=(chatDraft||'').trim();
  if(!text || !state || !myId) return;
  const el = document.getElementById('chatInput');
  if (el) el.blur();
  const ns=clone(state);
  ns.chatMessages=(ns.chatMessages||[]);
  ns.chatMessages.push({id:genId(), playerId:myId, name:myName, text:text.slice(0,300), ts:Date.now()});
  if(ns.chatMessages.length>50) ns.chatMessages=ns.chatMessages.slice(-50);
  chatDraft='';
  await saveState(ns);
}
function renderChatModal(){
  const msgs=(state && state.chatMessages)||[];
  const items=msgs.map(m=>{
    const mine=m.playerId===myId;
    return `<div style="margin-bottom:8px;text-align:${mine?'right':'left'};">
      <div style="font-size:11px;opacity:.6;">${escapeHtml(m.name)}</div>
      <div style="display:inline-block;padding:6px 11px;border-radius:8px;font-size:14px;${mine?'background:var(--gold);color:#2c1c00;':'background:rgba(0,0,0,0.08);color:var(--ink);'}max-width:80%;word-break:break-word;">${escapeHtml(m.text)}</div>
    </div>`;
  }).join('');
  return `<div class="modal-overlay" onclick="if(event.target===this) toggleChat()">
    <div class="modal-box" style="display:flex;flex-direction:column;">
      <h3>聊天室</h3>
      <div id="chatLog" style="flex:1;overflow-y:auto;margin-bottom:10px;max-height:48vh;">${items || '<div class="hint">還沒有人說話,打個招呼吧。</div>'}</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="chatInput" oninput="onChatInput(this.value)" onkeydown="if(event.key==='Enter' && !event.isComposing){event.preventDefault();sendChatMessage();}" placeholder="輸入訊息…" maxlength="300" style="flex:1;padding:0 10px;margin:0;height:38px;border-radius:6px;border:1px solid rgba(201,164,80,0.5);font-size:16px;font-family:'EB Garamond',serif;">
        <div class="btn" onclick="sendChatMessage()" style="height:38px;padding:0 18px;">送出</div>
      </div>
      <div class="btn full secondary mt8" onclick="toggleChat()">關閉</div>
    </div>
  </div>`;
}
let notice=null; // {title, body}

function showNotice(body, title){
  notice={title: title||'提醒', body};
  render();
}
function closeNotice(){
  notice=null;
  render();
}

function genId(){
  if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'id-'+Math.random().toString(36).slice(2)+Date.now();
}
function genRoomCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c='';
  for(let i=0;i<4;i++) c+=chars[Math.floor(Math.random()*chars.length)];
  return c;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function copyRoomCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showNotice('房間代碼已複製到剪貼簿！', '複製成功');
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = code;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showNotice('房間代碼已複製到剪貼簿！', '複製成功');
  });
}
function clone(o){return JSON.parse(JSON.stringify(o));}
function sumArr(a){return a.reduce((s,v)=>s+v,0);}

/* ---------------- Deck / round setup ---------------- */
function buildDeck(){
  let d=[];
  Object.keys(CARDS).forEach(k=>{
    const v=Number(k);
    for(let i=0;i<CARDS[v].count;i++) d.push(v);
  });
  for(let i=d.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [d[i],d[j]]=[d[j],d[i]];
  }
  return d;
}
function startRound(st){
  st.players.forEach(p=>{p.hand=[];p.discardPile=[];p.alive=true;p.protected=false;});
  const deck=buildDeck();
  st.removedCard=deck.pop();
  st.faceUpRemoved = st.players.length===2 ? [deck.pop(),deck.pop(),deck.pop()] : [];
  st.players.forEach(p=>{p.hand=[deck.pop()];});
  st.deck=deck;
  st.startingPlayerIndex=(st.roundNumber-1) % st.players.length;
  st.currentPlayerId=st.players[st.startingPlayerIndex].id;
  st.log=[`第 ${st.roundNumber} 輪開始,由 ${st.players[st.startingPlayerIndex].name} 先出牌。`];
  st.status='playing';
  st.roundWinners=[];
}

/* ---------------- Storage helpers (Firebase Realtime Database) ---------------- */
let roomRef=null;
let eliminateToast=null;
let eliminateToastTimer=null;
const activeAnimations = {};

function animateCardPlay(playerId, cardValue, onComplete) {
  activeAnimations[playerId] = true;
  
  setTimeout(() => {
    const seatEl = document.getElementById('seat-' + playerId);
    const tableEl = document.querySelector('.game-table');
    if (!seatEl || !tableEl) {
      delete activeAnimations[playerId];
      if (onComplete) onComplete(); else render();
      return;
    }
    
    const animCard = document.createElement('div');
    animCard.className = 'animating-card-overlay';
    animCard.innerHTML = `
      <div class="animating-card-content">
        <div class="card-badge">${cardRoman(cardValue)}</div>
        <div class="card-portrait-wrap">
          <img class="card-portrait" src="${cardImage(cardValue)}" alt="">
        </div>
        <div class="card-info">
          <div class="cname">${cardName(cardValue)}</div>
          <div class="cdesc">${cardDesc(cardValue)}</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(animCard);
    
    const container = document.querySelector('.game-table-container');
    const tableScale = container ? parseFloat(container.style.getPropertyValue('--table-scale')) || 1 : 1;
    
    const seatRect = seatEl.getBoundingClientRect();
    const tableRect = tableEl.getBoundingClientRect();
    
    const startX = seatRect.left + seatRect.width / 2 - 65;
    const startY = seatRect.top + seatRect.height / 2 - 90;
    
    animCard.style.left = startX + 'px';
    animCard.style.top = startY + 'px';
    animCard.style.transform = 'scale(' + (0.1 * tableScale) + ')';
    animCard.style.opacity = '0';
    
    animCard.offsetHeight; // force reflow
    
    const centerX = tableRect.left + tableRect.width / 2 - 65;
    const centerY = tableRect.top + tableRect.height / 2 - 90;
    
    animCard.style.left = centerX + 'px';
    animCard.style.top = centerY + 'px';
    animCard.style.transform = 'scale(' + (1.5 * tableScale) + ')';
    animCard.style.opacity = '1';
    
    setTimeout(() => {
      const discardEl = document.getElementById('discards-' + playerId);
      let targetX = centerX;
      let targetY = centerY;
      
      if (discardEl) {
        const discardRect = discardEl.getBoundingClientRect();
        targetX = discardRect.left + discardRect.width / 2 - 65;
        targetY = discardRect.top + discardRect.height / 2 - 90;
      } else {
        targetX = startX;
        targetY = startY;
      }
      
      animCard.style.transition = 'all 0.6s cubic-bezier(0.5, 0, 0.75, 0)';
      animCard.style.left = targetX + 'px';
      animCard.style.top = targetY + 'px';
      animCard.style.transform = 'scale(' + (0.13 * tableScale) + ')';
      animCard.style.opacity = '0.3';
      
      setTimeout(() => {
        if (animCard.parentNode) {
          document.body.removeChild(animCard);
        }
        delete activeAnimations[playerId];
        if (onComplete) onComplete(); else render();
      }, 600);
      
    }, 1500);
    
  }, 100);
}

let screenFlash=null;
let screenFlashTimer=null;
function triggerScreenFlash(kind){
  screenFlash=kind;
  clearTimeout(screenFlashTimer);
  screenFlashTimer=setTimeout(()=>{ screenFlash=null; render(); }, 700);
}
function applyEventEffects(oldS, newS){
  if(!newS) return;
  if(newS.status==='playing' && newS.currentPlayerId===myId && (!oldS || oldS.currentPlayerId!==myId)){
    sfxYourTurn();
    speak('輪到你了');
    vibrate([120,60,120]);
    flashTitle('🔴 輪到你了 · 命運情書');
    triggerScreenFlash('turn');
  }
  if(oldS && oldS.status!==newS.status){
    if(newS.status==='roundEnd') sfxRoundEnd();
    if(newS.status==='gameOver'){ 
      sfxWin(); 
      vibrate([100,60,100,60,160]); 
      triggerConfetti();
    }
  }
  if(oldS && oldS.players){
    newS.players.forEach(p=>{
      const old=oldS.players.find(o=>o.id===p.id);
      if(old && old.alive && !p.alive){
        sfxEliminate();
        
        // Show eliminate toast directly in the DOM
        const oldToast = document.getElementById('game-eliminate-toast');
        if(oldToast) oldToast.remove();
        const toast = document.createElement('div');
        toast.id = 'game-eliminate-toast';
        toast.className = 'eliminate-toast';
        toast.innerHTML = `⚜ ${escapeHtml(p.name)} 出局了 ⚜`;
        document.body.appendChild(toast);
        setTimeout(() => { if(toast.parentNode) toast.remove(); }, 2200);
        
        if(p.id===myId){ vibrate([200]); triggerScreenFlash('eliminate'); }
      }
    });
  }
  if(voiceEnabled && oldS && newS.log && newS.log.length>oldS.log.length){
    speak(newS.log[newS.log.length-1]);
  }
  if(oldS && newS.chatMessages && oldS.chatMessages && newS.chatMessages.length>oldS.chatMessages.length){
    const incoming=newS.chatMessages.slice(oldS.chatMessages.length);
    
    // Append new messages directly to DOM if chat modal is open
    const cl=document.getElementById('chatLog');
    if(cl){
      const hint=cl.querySelector('.hint');
      if(hint) hint.remove();
      incoming.forEach(m=>{
        const mine=m.playerId===myId;
        const msgDiv=document.createElement('div');
        msgDiv.style.marginBottom='8px';
        msgDiv.style.textAlign=mine?'right':'left';
        msgDiv.innerHTML=`
          <div style="font-size:11px;opacity:.6;">${escapeHtml(m.name)}</div>
          <div style="display:inline-block;padding:6px 11px;border-radius:8px;font-size:14px;${mine?'background:var(--gold);color:#2c1c00;':'background:rgba(0,0,0,0.08);color:var(--ink);'}max-width:80%;word-break:break-word;">${escapeHtml(m.text)}</div>
        `;
        cl.appendChild(msgDiv);
      });
      cl.scrollTop=cl.scrollHeight;
    }

    const remoteIncoming=incoming.filter(m=>m.playerId!==myId);
    if(remoteIncoming.length>0 && !chatOpen){
      chatUnread+=remoteIncoming.length;
      beep(700,0.05,'sine'); beep(850,0.06,'sine',0.05);
    }
  }
  checkEmote();
}

let pendingState = null;
function transitionToState(ns) {
  if (!ns) return;
  
  if (state && JSON.stringify(ns) === JSON.stringify(state)) return;
  if (pendingState && JSON.stringify(ns) === JSON.stringify(pendingState)) return;
  
  const oldS = state;
  
  // Detect all players whose discard piles grew
  const plays = [];
  if (oldS && oldS.players) {
    ns.players.forEach(p => {
      const old = oldS.players.find(o => o.id === p.id);
      if (old) {
        const oldPile = old.discardPile || [];
        const newPile = p.discardPile || [];
        if (newPile.length > oldPile.length) {
          plays.push({
            playerId: p.id,
            cardValue: newPile[newPile.length - 1],
            isActor: p.id === oldS.currentPlayerId
          });
        }
      }
    });
  }
  
  // Sort: active player (actor) plays first
  plays.sort((a, b) => (b.isActor ? 1 : 0) - (a.isActor ? 1 : 0));
  
  if (plays.length > 0) {
    pendingState = ns;
    
    let currentAnimIndex = 0;
    function runNextAnimation() {
      if (currentAnimIndex < plays.length) {
        const play = plays[currentAnimIndex];
        currentAnimIndex++;
        animateCardPlay(play.playerId, play.cardValue, runNextAnimation);
      } else {
        const targetState = pendingState;
        pendingState = null;
        if (targetState) {
          applyEventEffects(state, targetState);
          state = targetState;
          render();
        }
      }
    }
    
    runNextAnimation();
  } else {
    applyEventEffects(oldS, ns);
    state = ns;
    render();
  }
}

async function saveState(ns){
  transitionToState(ns);
  try{
    await db.ref('rooms/'+roomCode).set(ns);
  }catch(e){
    showNotice('儲存失敗,請檢查網路後再試一次。('+errMsg(e)+')');
  }
}

/* Firebase Realtime Database silently omits keys whose value is an empty
   array/null, so fields like an empty discard pile or faceUpRemoved come
   back missing instead of []. Restore sane defaults on every read. */
function normalizeState(ns){
  if(!ns) return ns;
  ns.log = ns.log || [];
  ns.deck = ns.deck || [];
  ns.faceUpRemoved = ns.faceUpRemoved || [];
  ns.roundWinners = ns.roundWinners || [];
  ns.championIds = ns.championIds || [];
  ns.roundEndReason = ns.roundEndReason || [];
  ns.chatMessages = ns.chatMessages || [];
  ns.removedCard = (ns.removedCard===undefined) ? null : ns.removedCard;
  ns.currentPlayerId = (ns.currentPlayerId===undefined) ? null : ns.currentPlayerId;
  ns.players = (ns.players||[]).map(p=>{
    p.hand = p.hand || [];
    p.discardPile = p.discardPile || [];
    return p;
  });
  return ns;
}

function tableDims() {
  // On phones we switch the table to a taller, narrower "portrait" canvas so the
  // same content downscales far less (bigger seats/cards/text). The page scrolls,
  // so a taller table is fine — nothing gets covered.
  const mobile = window.innerWidth < 588;
  return mobile ? { w: 400, h: 600, mobile: true } : { w: 560, h: 480, mobile: false };
}

function updateTableScale() {
  const container = document.querySelector('.game-table-container');
  if (container) {
    const dims = tableDims();
    const w = container.getBoundingClientRect().width;
    // Phones never upscale past the portrait design; desktop is allowed to grow
    // with the (now wider) column so the table fills the extra space.
    const scale = dims.mobile ? Math.min(1, w / dims.w) : Math.min(1.35, w / dims.w);
    container.style.setProperty('--table-scale', scale);
    container.style.setProperty('--table-w', dims.w + 'px');
    container.style.setProperty('--table-h', dims.h + 'px');
    container.style.height = (dims.h * scale) + 'px';
  }
}

function subscribeRoom(code){
  if(roomRef) roomRef.off();
  roomRef=db.ref('rooms/'+code);
  roomRef.on('value', snap=>{
    const ns=normalizeState(snap.val());
    if(!ns) return;
    if(JSON.stringify(ns)!==JSON.stringify(state)){
      if(state && ns.currentPlayerId!==state.currentPlayerId) localUI={stage:null,selectedCard:null,targetId:null,guess:null};
      transitionToState(ns);
    }
  });
}

function unsubscribeRoom(){
  if(roomRef){ roomRef.off(); roomRef=null; }
}


/* ---------------- Lobby actions ---------------- */
function errMsg(e){
  if(!e) return '未知錯誤';
  if(typeof e==='string') return e;
  if(e.message) return e.message;
  try{ return JSON.stringify(e); }catch(_){ return String(e); }
}
async function doCreateRoom(){
  if(!FIREBASE_READY){
    showNotice('Firebase 還沒設定好,請先在程式碼最上面填入你的 Firebase 設定。');
    return;
  }
  const nameInput=document.getElementById('nameInput');
  const name=(nameInput.value||'').trim();
  if(!name){showNotice('請先輸入你的名字');return;}
  const id=genId();
  const code=genRoomCode();
  const ns={
    status:'lobby',
    players:[{id,name,tokens:0,alive:true,protected:false,hand:[],discardPile:[],isBot:false}],
    hostId:id, deck:[], removedCard:null, faceUpRemoved:[],
    currentPlayerId:null, log:[], roundNumber:0, tokenGoal:0,
    championIds:[], roundWinners:[], chatMessages:[]
  };
  try{
    await db.ref('rooms/'+code).set(ns);
  }catch(e){
    showNotice('建立房間失敗:'+errMsg(e));
    return;
  }
  myName=name; myId=id; roomCode=code; state=ns; render();
  subscribeRoom(code);
  try{ localStorage.setItem('loveletter_session', JSON.stringify({roomCode:code,myId:id,myName:name})); }catch(e){}
  try{ localStorage.setItem('loveletter_name', name); }catch(e){}
}
async function doJoinRoom(){
  if(!FIREBASE_READY){
    showNotice('Firebase 還沒設定好,請先在程式碼最上面填入你的 Firebase 設定。');
    return;
  }
  const nameInput=document.getElementById('nameInput');
  const codeInput=document.getElementById('joinCodeInput');
  const name=(nameInput.value||'').trim();
  const code=(codeInput.value||'').trim().toUpperCase();
  if(!name){showNotice('請先輸入你的名字');return;}
  if(!code){showNotice('請輸入房間代碼');return;}
  let snap;
  try{ snap=await db.ref('rooms/'+code).get(); }
  catch(e){ showNotice('找不到這個房間,請確認代碼是否正確。('+errMsg(e)+')'); return; }
  if(!snap.exists()){ showNotice('找不到這個房間,請確認代碼是否正確。'); return; }
  const ns=normalizeState(snap.val());
  if(ns.status!=='lobby'){ showNotice('這個房間的遊戲已經開始了,無法加入。'); return; }
  if(ns.players.length>=4){ showNotice('房間已滿(最多 4 人)。'); return; }
  if(ns.players.some(p=>p.name===name)){ showNotice('這個名字已經有人用了,換一個吧。'); return; }
  const id=genId();
  ns.players.push({id,name,tokens:0,alive:true,protected:false,hand:[],discardPile:[],isBot:false});
  try{
    await db.ref('rooms/'+code).set(ns);
  }catch(e){
    showNotice('加入房間失敗:'+errMsg(e));
    return;
  }
  myId=id; myName=name; roomCode=code; state=ns; render();
  subscribeRoom(code);
  try{ localStorage.setItem('loveletter_session', JSON.stringify({roomCode:code,myId:id,myName:name})); }catch(e){}
  try{ localStorage.setItem('loveletter_name', name); }catch(e){}
}
const BOT_NAMES=['電腦對手・甲','電腦對手・乙','電腦對手・丙'];
const EMOTES=['😏','😂','😈','👀','🔥','😱','🤡','💪'];
async function sendEmote(emoji){
  if(!state || !myId) return;
  const ns=clone(state);
  ns.lastEmote={playerId:myId, emoji, nonce:Math.random().toString(36).slice(2)+Date.now()};
  await saveState(ns);
}
let emoteDraft='';
function onEmoteInput(v){ emoteDraft=v; }
function sendCustomEmote(){
  const text=(emoteDraft||'').trim();
  if(!text) return;
  emoteDraft='';
  const el = document.getElementById('emoteInput');
  if (el) el.blur();
  sendEmote(text.slice(0,20));
}
function renderEmoteBar(){
  return `<div class="panel"><h2>嗆人一下</h2>
    <div class="btn-row" style="flex-wrap:wrap;">
      ${EMOTES.map(e=>`<div class="pill" style="font-size:20px;padding:7px 12px;" onclick="sendEmote('${e}')">${e}</div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;align-items:center;">
      <input type="text" id="emoteInput" oninput="onEmoteInput(this.value)" onkeydown="if(event.key==='Enter' && !event.isComposing){event.preventDefault();sendCustomEmote();}" placeholder="或自己輸入表情/文字" maxlength="20" style="flex:1;padding:0 10px;margin:0;height:38px;border-radius:6px;border:1px solid rgba(201,164,80,0.5);font-size:16px;font-family:'EB Garamond',serif;">
      <div class="btn secondary" onclick="sendCustomEmote()" style="height:38px;padding:0 18px;">送出</div>
    </div>
  </div>`;
}
async function doAddBot(){
  if(!state || state.players.length>=4) return;
  const ns=clone(state);
  const botCount=ns.players.filter(p=>p.isBot).length;
  const id='bot-'+genId();
  ns.players.push({id,name:BOT_NAMES[botCount]||('電腦對手 '+(botCount+1)),tokens:0,alive:true,protected:false,hand:[],discardPile:[],isBot:true});
  saveState(ns);
}
async function doRemoveBot(id){
  if(!state) return;
  const ns=clone(state);
  ns.players=ns.players.filter(p=>p.id!==id);
  saveState(ns);
}
async function doLeaveRoom(){
  const code = roomCode;
  const id = myId;
  const oldState = state;

  // 1. Immediately unsubscribe from Firebase to stop receiving optimistic state events
  unsubscribeRoom();
  
  // 2. Instantly reset all UI-related and toast variables to return to a clean home screen
  roomCode=null; myId=null; state=null;
  localUI={stage:null,selectedCard:null,targetId:null,guess:null};
  rulesOpen=false;
  roomMenuOpen=false;
  chatOpen=false;
  chatUnread=0;
  settingsOpen=false;
  notice=null;
  emoteToast=null;
  eliminateToast=null;
  screenFlash=null;
  clearTimeout(emoteToastTimer);
  clearTimeout(eliminateToastTimer);
  
  // Clean up any dynamic toasts currently in the DOM
  const et = document.getElementById('game-emote-toast');
  if(et) et.remove();
  const elt = document.getElementById('game-eliminate-toast');
  if(elt) elt.remove();
  
  // 3. Forcefully remove any in-progress card play animations from the DOM
  document.querySelectorAll('.animating-card-overlay').forEach(el => el.remove());
  
  // 4. Instantly render the home page
  render();

  // 5. Asynchronously write the update to Firebase in the background
  if(oldState && id && code){
    try{
      const ns=clone(oldState);
      const me=ns.players.find(p=>p.id===id);
      if(me){
        ns.log=ns.log||[];
        if(ns.status==='lobby'){
          ns.players=ns.players.filter(p=>p.id!==id);
          if(ns.hostId===id){
            const nextHost=ns.players[0];
            if(nextHost) ns.hostId=nextHost.id;
          }
          ns.log.push(`${me.name} 離開了房間。`);
        }else{
          me.alive=false;
          me.left=true;
          if(me.hand && me.hand.length){ me.discardPile=(me.discardPile||[]).concat(me.hand); me.hand=[]; }
          ns.log.push(`${me.name} 離開了遊戲。`);
          if(ns.hostId===id){
            const nextHost=ns.players.find(p=>p.id!==id && !p.isBot) || ns.players.find(p=>p.id!==id);
            if(nextHost) ns.hostId=nextHost.id;
          }
          if(ns.status==='playing'){
            if(ns.currentPlayerId===id){
              finalizeTurnOrRoundEnd(ns);
            }else{
              const alivePlayers=ns.players.filter(p=>p.alive);
              if(alivePlayers.length<=1){
                endRound(ns, alivePlayers);
              }
            }
          }
        }
        await db.ref('rooms/'+code).set(ns);
      }
    }catch(e){ /* best effort */ }
  }
  try{ localStorage.removeItem('loveletter_session'); }catch(e){}
}
function enterCountdown(ns){
  ns.status='countdown';
  ns.countdownEndAt=Date.now()+3000;
  saveState(ns);
}
async function doStartGame(){
  if(!state||state.players.length<2) return;
  const ns=clone(state);
  ns.tokenGoal = ns.players.length===2?7:(ns.players.length===3?5:4);
  ns.roundNumber=1;
  ns.players.forEach(p=>p.tokens=0);
  enterCountdown(ns);
}
async function doNextRound(){
  const ns=clone(state);
  ns.roundNumber+=1;
  enterCountdown(ns);
}
async function doPlayAgain(){
  const ns=clone(state);
  ns.players.forEach(p=>p.tokens=0);
  ns.tokenGoal = ns.players.length===2?7:(ns.players.length===3?5:4);
  ns.roundNumber=1;
  ns.championIds=[];
  enterCountdown(ns);
}
async function doResetGame(){
  if(!state || state.hostId!==myId) return;
  const ns=clone(state);
  ns.players.forEach(p=>p.tokens=0);
  ns.tokenGoal = ns.players.length===2?7:(ns.players.length===3?5:4);
  ns.roundNumber=1;
  ns.championIds=[];
  enterCountdown(ns);
}
let countdownLock=false;
function checkCountdownFinish(){
  if(!state || state.status!=='countdown') return;
  if(!state.hostId || state.hostId!==myId) return;
  if(Date.now() < state.countdownEndAt) return;
  if(countdownLock) return;
  countdownLock=true;
  const ns=clone(state);
  startRound(ns);
  saveState(ns);
  setTimeout(()=>{countdownLock=false;}, 1500);
}
let lastSeenRevealNonce=null;
try { lastSeenRevealNonce = sessionStorage.getItem('loveletter_last_seen_reveal'); } catch(e){}
function checkBaronReveal(){
  if(!state || !state.lastReveal) return;
  const r=state.lastReveal;
  if(r.nonce===lastSeenRevealNonce) return;
  lastSeenRevealNonce=r.nonce;
  try { sessionStorage.setItem('loveletter_last_seen_reveal', r.nonce); } catch(e){}
  if(r.type==='priest'){
    if(myId!==r.aId) return; // only the player who peeked sees the card
    const opp=findP(r.bId);
    showNotice(`你偷看到 ${opp?opp.name:'對方'} 的手牌是:「${cardRoman(r.bVal)} ${cardName(r.bVal)}」`, '神父 · 偷看手牌');
    return;
  }
  if(myId!==r.aId && myId!==r.bId) return; // not one of the two players involved, no peek
  const meIsA=myId===r.aId;
  const myVal=meIsA?r.aVal:r.bVal;
  const oppVal=meIsA?r.bVal:r.aVal;
  const opp=findP(meIsA?r.bId:r.aId);
  showNotice(`你的手牌是「${cardRoman(myVal)} ${cardName(myVal)}」,${opp?opp.name:'對方'} 的手牌是「${cardRoman(oppVal)} ${cardName(oppVal)}」。`, '男爵 · 比較手牌');
}
let lastSeenEmoteNonce=null;
try { lastSeenEmoteNonce = sessionStorage.getItem('loveletter_last_seen_emote'); } catch(e){}
let emoteToast=null;
let emoteToastTimer=null;
function checkEmote(){
  if(!state || !state.lastEmote) return;
  const e=state.lastEmote;
  if(e.nonce===lastSeenEmoteNonce) return;
  lastSeenEmoteNonce=e.nonce;
  try { sessionStorage.setItem('loveletter_last_seen_emote', e.nonce); } catch(e){}
  const p=findP(e.playerId);
  const name=p?p.name:'?';
  
  sfxEmote();
  
  // Create and show the emote toast directly in the DOM
  const oldToast=document.getElementById('game-emote-toast');
  if(oldToast) oldToast.remove();
  
  const toast=document.createElement('div');
  toast.id='game-emote-toast';
  toast.className='emote-toast';
  toast.innerHTML=`${escapeHtml(name)} <span style="font-size:20px;">${escapeHtml(e.emoji)}</span>`;
  document.body.appendChild(toast);
  
  setTimeout(()=>{
    if(toast.parentNode) toast.remove();
  }, 2500);
}
setInterval(()=>{ if(state && state.status==='countdown') render(); }, 350);

/* ---------------- Turn actions ---------------- */
function myPlayer(){ return state.players.find(p=>p.id===myId); }
function findP(id){ return state.players.find(p=>p.id===id); }

function doDraw(){
  if(localUI.stage) return;
  const deck=[...state.deck];
  const drawn=deck.pop();
  localUI.stage={deck, drawnCard:drawn};
  sfxDraw();
  restoreTitle();
  render();
}
function tempHand(){
  const me=myPlayer();
  if(!localUI.stage) return me.hand.slice();
  return me.hand.concat([localUI.stage.drawnCard]);
}
function forcedCountess(){
  const th=tempHand();
  return th.includes(7) && (th.includes(6)||th.includes(5));
}
function selectCard(v){
  // Can only choose a card to play on your own turn, after drawing from the deck.
  if(!state || state.currentPlayerId!==myId) return;
  if(!localUI.stage){ showNotice('請先點擊牌堆抽牌,再選擇要出的牌。'); return; }
  if(forcedCountess() && v!==7){
    showNotice('你同時持有伯爵夫人與國王/王子,必須棄掉伯爵夫人。');
    return;
  }
  localUI.selectedCard=v; localUI.targetId=null; localUI.guess=null;
  render();
}
function cancelSelection(){
  localUI.selectedCard=null; localUI.targetId=null; localUI.guess=null;
  render();
}
function selectTarget(id){ localUI.targetId=id; render(); }
function selectGuess(n){ localUI.guess=n; render(); }

function computeValidTargets(card){
  if(card===5){
    return state.players.filter(p=>p.alive && (p.id===myId || !p.protected));
  }
  if([1,2,3,6].includes(card)){
    return state.players.filter(p=>p.alive && !p.protected && p.id!==myId);
  }
  return [];
}

function confirmPlay(){
  const card=localUI.selectedCard;
  if(!card) return;
  const needsTarget=[1,2,3,5,6].includes(card);
  const targets=computeValidTargets(card);
  if(needsTarget && targets.length>0){
    if(localUI.targetId==null){ showNotice('請先選擇目標'); return; }
    if(card===1 && localUI.guess==null){ showNotice('請選擇你要猜測的牌'); return; }
  }
  const ns=clone(state);
  ns.deck=[...localUI.stage.deck];
  const me=ns.players.find(p=>p.id===myId);
  const th=me.hand.concat([localUI.stage.drawnCard]);
  const idx=th.indexOf(card);
  th.splice(idx,1);
  me.hand=th;
  me.discardPile.push(card);
  ns.log.push(`${me.name} 出了「${cardName(card)}」。`);

  resolveEffect(ns, me, card, localUI.targetId, localUI.guess);
  finalizeTurnOrRoundEnd(ns);
  localUI={stage:null,selectedCard:null,targetId:null,guess:null};
  sfxPlay();
  saveState(ns);
}

/* Shared effect resolver used by both human plays and bot turns.
   `actor` must already have had the played card removed from hand
   (and pushed to discardPile) before this is called. */
function resolveEffect(ns, actor, card, tId, guess){
  switch(card){
    case 1:{
      const t = tId!=null ? ns.players.find(p=>p.id===tId) : null;
      if(t){
        if(t.hand[0]===guess){
          t.alive=false;
          ns.log.push(`${actor.name} 猜測 ${t.name} 持有「${cardName(guess)}」,猜中了!${t.name} 出局。`);
        }else{
          ns.log.push(`${actor.name} 猜測 ${t.name} 持有「${cardName(guess)}」,猜錯了。`);
        }
      }else{
        ns.log.push('沒有可指定的目標,衛兵效果無效。');
      }
      break;
    }
    case 2:{
      const t = tId!=null ? ns.players.find(p=>p.id===tId) : null;
      if(t){
        ns.log.push(`${actor.name} 偷看了 ${t.name} 的手牌。`);
        // Mirror the baron flow: stash the peek in state so the reveal is shown
        // after the card-play animation finishes (see checkBaronReveal), not before.
        ns.lastReveal={type:'priest', aId:actor.id, bId:t.id, bVal:t.hand[0], nonce:Math.random().toString(36).slice(2)+Date.now()};
      }else{
        ns.log.push('沒有可指定的目標,神父效果無效。');
      }
      break;
    }
    case 3:{
      const t = tId!=null ? ns.players.find(p=>p.id===tId) : null;
      if(t){
        const myVal=actor.hand[0], tVal=t.hand[0];
        ns.lastReveal={type:'baron', aId:actor.id, bId:t.id, aVal:myVal, bVal:tVal, nonce:Math.random().toString(36).slice(2)+Date.now()};
        if(myVal===tVal){
          ns.log.push(`${actor.name} 與 ${t.name} 比較手牌,點數相同,平手無事發生。`);
        }else if(myVal>tVal){
          t.alive=false;
          ns.log.push(`${actor.name} 與 ${t.name} 比較手牌,${t.name} 出局。`);
        }else{
          actor.alive=false;
          ns.log.push(`${actor.name} 與 ${t.name} 比較手牌,${actor.name} 出局。`);
        }
      }else{
        ns.log.push('沒有可指定的目標,男爵效果無效。');
      }
      break;
    }
    case 4:{
      actor.protected=true;
      ns.log.push(`${actor.name} 使用侍女,獲得保護,直到下一回合開始前都不會被指定。`);
      break;
    }
    case 5:{
      const t = tId!=null ? ns.players.find(p=>p.id===tId) : null;
      if(t){
        if(t.hand[0]===8){
          t.alive=false; t.discardPile.push(8); t.hand=[];
          ns.log.push(`${actor.name} 指定 ${t.name} 使用王子,${t.name} 被迫棄掉公主,立即出局!`);
        }else{
          const old=t.hand.pop();
          if(old!==undefined) t.discardPile.push(old);
          let newCard;
          if(ns.deck.length>0){ newCard=ns.deck.pop(); }
          else{ newCard=ns.removedCard; ns.removedCard=null; }
          t.hand=[newCard];
          ns.log.push(`${actor.name} 指定 ${t.name} 使用王子,棄掉手牌並重新抽了一張新牌。`);
        }
      }
      break;
    }
    case 6:{
      const t = tId!=null ? ns.players.find(p=>p.id===tId) : null;
      if(t){
        const tmp=actor.hand[0]; actor.hand[0]=t.hand[0]; t.hand[0]=tmp;
        ns.log.push(`${actor.name} 與 ${t.name} 交換了手牌。`);
      }else{
        ns.log.push('沒有可指定的目標,國王效果無效。');
      }
      break;
    }
    case 7:{
      ns.log.push(`${actor.name} 棄掉了伯爵夫人。`);
      break;
    }
    case 8:{
      actor.alive=false;
      ns.log.push(`${actor.name} 棄掉了公主,立即出局!`);
      break;
    }
  }
}

function finalizeTurnOrRoundEnd(ns){
  const alivePlayers=ns.players.filter(p=>p.alive);
  if(alivePlayers.length<=1){
    endRound(ns, alivePlayers);
    return;
  }
  const order=ns.players;
  let idx=order.findIndex(p=>p.id===ns.currentPlayerId);
  let next=idx;
  do{ next=(next+1)%order.length; }while(!order[next].alive);
  order[next].protected=false;
  ns.currentPlayerId=order[next].id;
  if(ns.deck.length===0){
    endRound(ns, ns.players.filter(p=>p.alive));
    return;
  }
  ns.status='playing';
}

function endRound(ns, aliveList){
  let winners;
  let reasonLines=[];
  if(aliveList.length<=1){
    winners=aliveList.slice();
    if(winners.length===1){
      reasonLines.push(`其他玩家都已出局,${winners[0].name} 是本輪唯一存活的玩家。`);
    }else{
      reasonLines.push('本輪所有人都出局了。');
    }
  }else{
    const maxVal=Math.max(...aliveList.map(p=>p.hand[0]));
    let candidates=aliveList.filter(p=>p.hand[0]===maxVal);
    reasonLines.push(`牌堆已用盡,存活玩家亮出手牌比點數:${aliveList.map(p=>`${p.name}「${cardRoman(p.hand[0])} ${cardName(p.hand[0])}」`).join('、')}。`);
    if(candidates.length===1){
      winners=candidates;
      reasonLines.push(`${winners[0].name} 的點數最高,贏得本輪。`);
    }else{
      const maxSum=Math.max(...candidates.map(p=>sumArr(p.discardPile)));
      let finalists=candidates.filter(p=>sumArr(p.discardPile)===maxSum);
      reasonLines.push(`${candidates.map(c=>c.name).join('、')} 點數相同,改比較棄牌堆點數總和:${candidates.map(p=>`${p.name}(${sumArr(p.discardPile)} 點)`).join('、')}。`);
      if(finalists.length===1){
        winners=finalists;
        reasonLines.push(`${winners[0].name} 的棄牌堆點數總和最高,贏得本輪。`);
      }else{
        winners=finalists;
        reasonLines.push(`${finalists.map(f=>f.name).join('、')} 仍然平手,共同獲得一枚信物。`);
      }
    }
  }
  winners.forEach(w=>{
    const p=ns.players.find(pp=>pp.id===w.id);
    p.tokens+=1;
  });
  ns.status='roundEnd';
  ns.roundWinners=winners.map(w=>w.id);
  ns.roundEndReason=reasonLines;
  ns.log.push(`本輪結束。${winners.map(w=>w.name).join('、')} 獲得一枚信物。`);
  const champs=ns.players.filter(p=>p.tokens>=ns.tokenGoal);
  if(champs.length>0){
    ns.status='gameOver';
    ns.championIds=champs.map(c=>c.id);
  }
}

/* ---------------- Bot AI ---------------- */
let botLock=false;
function maybeRunBot(){
  if(!state || state.status!=='playing') return;
  if(!state.hostId || state.hostId!==myId) return; // only the host's browser drives bots
  const cur=findP(state.currentPlayerId);
  if(!cur || !cur.isBot || !cur.alive) return;
  if(botLock) return;
  botLock=true;
  setTimeout(()=>{ botLock=false; runBotTurn(); }, 3200);
}
function runBotTurn(){
  if(!state || state.status!=='playing') return;
  const curCheck=findP(state.currentPlayerId);
  if(!curCheck || !curCheck.isBot || !curCheck.alive) return;
  const ns=clone(state);
  const bot=ns.players.find(p=>p.id===ns.currentPlayerId);
  if(ns.deck.length===0){
    endRound(ns, ns.players.filter(p=>p.alive));
    saveState(ns);
    return;
  }
  const drawn=ns.deck.pop();
  let hand=bot.hand.concat([drawn]);

  const forced = hand.includes(7) && (hand.includes(6)||hand.includes(5));
  let card;
  if(forced){
    card=7;
  }else{
    let candidates=hand.slice();
    if(candidates.includes(8) && candidates.length>1){
      candidates=candidates.filter(c=>c!==8);
    }
    card=candidates[Math.floor(Math.random()*candidates.length)];
  }
  const idx=hand.indexOf(card);
  hand.splice(idx,1);
  bot.hand=hand;
  bot.discardPile.push(card);
  ns.log.push(`${bot.name} 出了「${cardName(card)}」。`);

  function targetsFor(c){
    if(c===5) return ns.players.filter(p=>p.alive && (p.id===bot.id || !p.protected));
    if([1,2,3,6].includes(c)) return ns.players.filter(p=>p.alive && !p.protected && p.id!==bot.id);
    return [];
  }
  let tId=null, guess=null;
  if([1,2,3,5,6].includes(card)){
    const targets=targetsFor(card);
    if(card===5){
      const others=targets.filter(t=>t.id!==bot.id);
      const pick = others.length>0 ? others[Math.floor(Math.random()*others.length)] : targets[0];
      tId = pick ? pick.id : null;
    }else if(targets.length>0){
      tId = targets[Math.floor(Math.random()*targets.length)].id;
    }
    if(card===1 && tId!=null){
      const opts=[2,3,4,5,6,7,8];
      guess=opts[Math.floor(Math.random()*opts.length)];
    }
  }

  resolveEffect(ns, bot, card, tId, guess);
  finalizeTurnOrRoundEnd(ns);
  saveState(ns);
}


function toggleRules(){ rulesOpen=!rulesOpen; render(); }

function renderNoticeModal(){
  return `<div class="modal-overlay" style="z-index:3000;">
    <div class="modal-box">
      <h3>${escapeHtml(notice.title)}</h3>
      <p style="font-size:15px;line-height:1.6;">${escapeHtml(notice.body)}</p>
      <div class="btn full mt14" onclick="closeNotice()">知道了</div>
    </div>
  </div>`;
}

/* ---------------- Render ---------------- */
/* While the user is mid-IME-composition (e.g. typing Chinese), rebuilding the
   #app DOM would destroy the <input> and abort the composition. Defer any render
   requested during composition and flush it once the composition ends, so toasts
   and remote state updates can't interrupt typing in the chat / emote fields. */
let isComposing=false;
let pendingRender=false;
let lastRenderedState=null;

document.addEventListener('compositionstart', ()=>{ isComposing=true; }, true);
document.addEventListener('compositionend', ()=>{
  isComposing=false;
  if(pendingRender){ pendingRender=false; render(); }
}, true);

// Listen to focusout globally to trigger deferred renders when typing ends
document.addEventListener('focusout', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
        if (pendingRender) {
          pendingRender = false;
          render();
        }
      }
    }, 100);
  }
}, true);

function isCriticalStateChange(oldS, newS) {
  if (!oldS || !newS) return true;
  if (oldS.status !== newS.status) return true;
  if (oldS.currentPlayerId !== newS.currentPlayerId) return true;
  if (oldS.deck && newS.deck && oldS.deck.length !== newS.deck.length) return true;
  if (oldS.players.length !== newS.players.length) return true;
  for (let i = 0; i < newS.players.length; i++) {
    const pNew = newS.players[i];
    const pOld = oldS.players.find(p => p.id === pNew.id);
    if (!pOld) return true;
    if (pOld.alive !== pNew.alive) return true;
    if (pOld.tokens !== pNew.tokens) return true;
    if (pNew.hand && pOld.hand && pOld.hand.length !== pNew.hand.length) return true;
  }
  return false;
}

function render(force = false){
  if(isComposing){ pendingRender=true; return; }
  
  const _act=document.activeElement;
  const isInputFocused = _act && (_act.id === 'emoteInput' || _act.id === 'chatInput');
  
  if (isInputFocused && !force) {
    if (!isCriticalStateChange(lastRenderedState, state)) {
      pendingRender = true;
      return;
    }
  }

  lastRenderedState = state ? clone(state) : null;
  const app=document.getElementById('app');
  // Remember which field is focused (and the caret position) so a re-render
  // triggered by a notification bubble doesn't kick the user out of typing.
  const _focus=(_act && _act.id && (_act.tagName==='INPUT'||_act.tagName==='TEXTAREA'))
    ? {id:_act.id, start:_act.selectionStart, end:_act.selectionEnd} : null;
  let html='';
  html+=`<div class="glow-wrap"><div class="glow"></div><h1 class="title display">命運情書</h1><div class="subtitle">Love Letter · 與朋友共寫的賭局</div></div>`;

  if(!FIREBASE_READY){
    html+=`<div class="panel">
      <h2>還差一步:設定 Firebase</h2>
      <p class="hint">這個頁面需要連到你自己的 Firebase Realtime Database 才能讓不同裝置同步房間狀態。打開這個 HTML 檔案,找到最上面的 <code>FIREBASE_CONFIG</code>,把裡面的 <code>REPLACE_ME</code> 換成你 Firebase 專案的設定值,存檔後重新整理這個頁面就可以了。</p>
    </div>`;
    app.innerHTML=html;
    return;
  }

  if(!roomCode || !state){
    html+=renderHome();
  }else if(state.status==='lobby'){
    html+=renderLobby();
  }else if(state.status==='countdown'){
    html+=renderCountdown();
  }else if(state.status==='playing'){
    html+=renderPlaying();
  }else if(state.status==='roundEnd'){
    html+=renderRoundEnd();
  }else if(state.status==='gameOver'){
    html+=renderGameOver();
  }

  if(rulesOpen) html+=renderRulesModal();
  if(roomMenuOpen) html+=renderRoomMenu();
  if(settingsOpen) html+=renderSettingsModal();
  if(chatOpen) html+=renderChatModal();
  if(notice) html+=renderNoticeModal();
  if(screenFlash) html+=`<div class="screen-flash ${screenFlash}"></div>`;
  app.innerHTML=html;
  updateTableScale();

  const ni=document.getElementById('nameInput');
  if(ni && myName) ni.value=myName;
  const leaveLink=document.getElementById('leaveLink');
  if(leaveLink) leaveLink.style.display = roomCode ? 'flex' : 'none';
  const chatLink=document.getElementById('chatLink');
  if(chatLink){
    chatLink.style.display = roomCode ? 'flex' : 'none';
    chatLink.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm0-3h12v2H6V6zm0 6h9v2H6v-2z"/>
      </svg>
      ${chatUnread > 0 ? `<span class="chat-badge">${chatUnread}</span>` : ''}
    `;
  }
  const ci=document.getElementById('chatInput');
  if(ci) ci.value=chatDraft;
  const ei=document.getElementById('emoteInput');
  if(ei) ei.value=emoteDraft;
  const cl=document.getElementById('chatLog');
  if(cl) cl.scrollTop=cl.scrollHeight;

  // Re-focus the field the user was typing in and restore their caret position.
  if(_focus){
    const el=document.getElementById(_focus.id);
    if(el){
      el.focus({preventScroll:true});
      if(_focus.start!=null){ try{ el.setSelectionRange(_focus.start, _focus.end); }catch(e){} }
    }
  }

  maybeRunBot();
  checkCountdownFinish();
  checkBaronReveal();
}

function renderCountdown(){
  const remaining=Math.max(0, Math.ceil((state.countdownEndAt-Date.now())/1000));
  if(remaining!==lastCountdownTick){
    lastCountdownTick=remaining;
    if(remaining>0) sfxTick(); else sfxGo();
  }
  return `<div class="panel center-text">
    <h2 style="border:none;">即將開始</h2>
    <div style="font-family:'Cormorant Garamond',serif;font-size:64px;color:var(--gold-light);margin:6px 0;">${remaining>0?remaining:'開始!'}</div>
    <div class="hint">準備好你的措辭,信箋即將送出…</div>
  </div>`;
}

function renderHome(){
  return `
  <div class="panel">
    <h2>展開新的信箋</h2>
    <label>你的名字</label>
    <input type="text" id="nameInput" placeholder="例如:夜風" maxlength="12">
    <div class="btn-row">
      <div class="btn full" onclick="doCreateRoom()">建立房間</div>
    </div>
    <div class="hint">建立後會得到一個 4 碼房間代碼,分享給朋友讓他們加入。</div>
  </div>
  <div class="panel">
    <h2>加入朋友的房間</h2>
    <label>房間代碼</label>
    <input type="text" id="joinCodeInput" placeholder="輸入 4 碼代碼" maxlength="4" style="text-transform:uppercase;">
    <div class="btn-row">
      <div class="btn full secondary" onclick="doJoinRoom()" style="border:1px solid var(--gold-deep);">加入房間</div>
    </div>
  </div>
  <div class="hint center-text">支援 2~4 人,真人與電腦對手可以混搭——建好房間後到等候室加電腦對手就行。</div>
  `;
}

function renderLobby(){
  const isHost=state.hostId===myId;
  const botCount=state.players.filter(p=>p.isBot).length;
  const humanCount=state.players.length-botCount;
  let rows=state.players.map(p=>`
    <div class="player-row">
      <span>${escapeHtml(p.name)}${p.id===state.hostId?'<span class="tag host">房主</span>':''}${p.isBot?'<span class="tag prot">AI</span>':''}</span>
      <span style="opacity:.7;font-size:12px;">${p.isBot && isHost ? `<span class="btn secondary" style="padding:4px 10px;font-size:11px;" onclick="doRemoveBot('${p.id}')">移除</span>` : '已加入'}</span>
    </div>`).join('');
  return `
  <div class="panel">
    <h2>等候室</h2>
    <div class="room-code" style="display:flex;align-items:center;justify-content:center;gap:6px;">
      <span style="margin-left:6px;">${roomCode}</span>
      <span class="copy-btn" onclick="copyRoomCode('${roomCode}')" title="複製房間代碼">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </span>
    </div>
    <div class="hint center-text mt8">把代碼分享給朋友,讓他們在「加入房間」輸入;也可以直接加電腦對手一個人玩。</div>
    <div class="mt14">${rows}</div>
    ${isHost && state.players.length<4 ? `<div class="btn-row mt8"><div class="btn secondary" onclick="doAddBot()">新增電腦對手</div></div>` : ''}
    <div class="mt14">
      ${isHost
        ? (state.players.length>=2
            ? `<div class="btn full" onclick="doStartGame()">開始遊戲</div>`
            : `<div class="hint center-text">至少需要 2 人(含電腦對手)才能開始。</div>`)
        : `<div class="hint center-text">等待房主開始遊戲…</div>`}
    </div>
    <div class="mt8 center-text"><span class="btn secondary" onclick="doLeaveRoom()">離開房間</span></div>
  </div>`;
}

function renderGameTable() {
  const me = myPlayer();
  const myTurn = state.currentPlayerId === myId;
  const canDraw = myTurn && !localUI.stage;
  const validTargets = localUI.selectedCard != null ? computeValidTargets(localUI.selectedCard) : [];
  
  const dims = tableDims();
  const seated = getSeatedPlayers();
  let seatsHtml = '';
  let discardsHtml = '';

  seated.forEach((p, i) => {
    const seatStyle = getSeatStyle(seated.length, i, dims.mobile);
    const discardStyle = getDiscardStyle(seated.length, i, dims.mobile);
    
    let cls = 'player-seat';
    if (p.id === state.currentPlayerId) cls += ' active';
    if (!p.alive) cls += ' dead';
    if (p.protected) cls += ' protected';
    
    const isValidTarget = validTargets.some(t => t.id === p.id);
    let seatAttr = '';
    if (isValidTarget) {
      cls += ' targetable';
      seatAttr = `onclick="selectTarget('${p.id}')"`;
    }
    if (localUI.targetId === p.id) {
      cls += ' target-selected';
    }
    
    let tags = '';
    if (p.id === state.currentPlayerId) tags += '<span class="seat-tag turn">行動</span>';
    if (p.protected) tags += '<span class="seat-tag prot">保護</span>';
    if (p.isBot) tags += '<span class="seat-tag bot">AI</span>';
    if (p.id === state.hostId) tags += '<span class="seat-tag host">房主</span>';
    if (p.left) tags += '<span class="seat-tag dead" style="background:#5a3a3a;color:#f0d0d0;">離開</span>';
    
    let dots = '';
    for (let t = 0; t < p.tokens; t++) {
      dots += '<span class="token-dot"></span>';
    }
    
    let handCountHtml = '';
    if (p.alive) {
      const cardCount = p.hand ? p.hand.length : 0;
      let cardIcons = '';
      for (let c = 0; c < cardCount; c++) {
        cardIcons += '<span class="seat-hand-card-icon"></span>';
      }
      handCountHtml = `<span class="seat-hand-icon">${cardIcons}</span>`;
    } else {
      handCountHtml = `<span>💀</span>`;
    }
    
    seatsHtml += `<div class="${cls}" id="seat-${p.id}" style="${seatStyle}" ${seatAttr}>
      <div class="seat-name">${escapeHtml(p.name)}</div>
      <div class="seat-tags">${tags}</div>
      <div class="seat-tokens-hand">
        <div class="tokens">${dots}</div>
        ${p.id === myId ? '' : handCountHtml}
      </div>
    </div>`;
    
    const pile = p.discardPile || [];
    let discardCardsHtml = '';
    if (pile.length > 0) {
      pile.forEach(v => {
        discardCardsHtml += `<span class="table-discard-card" title="${cardName(v)}">${cardRoman(v)}</span>`;
      });
    }
    discardsHtml += `<div class="table-discards-wrap" id="discards-${p.id}" style="${discardStyle}">
      ${discardCardsHtml}
    </div>`;
  });
  
  let centerHtml = `<div class="table-center">`;
  centerHtml += `<div style="display:flex;align-items:center;gap:12px;">`;
  
  if (state.faceUpRemoved && state.faceUpRemoved.length > 0) {
    let faceupCards = state.faceUpRemoved.map(v => `<span class="center-faceup-card" title="${cardName(v)}">${cardRoman(v)}</span>`).join('');
    centerHtml += `<div class="center-faceup-piles" style="margin-top:0;margin-right:8px;">${faceupCards}</div>`;
  }
  
  centerHtml += `<div style="display:flex;flex-direction:column;align-items:center;">`;
  centerHtml += `<div class="center-piles">`;
  if (state.deck.length > 0) {
    let deckClass = 'draw-pile-deck';
    let deckAttr = '';
    let deckTipHtml = '';
    if (canDraw) {
      deckClass += ' interactive glow-deck';
      deckAttr = 'onclick="doDraw()"';
      deckTipHtml = `<div class="deck-click-tip">點擊抽牌</div>`;
    }
    centerHtml += `<div class="${deckClass}" ${deckAttr}>${state.deck.length}${deckTipHtml}</div>`;
  } else {
    centerHtml += `<div class="draw-pile-deck" style="opacity: 0.15; border-style: dashed; background: none;">0</div>`;
  }
  if (state.removedCard != null) {
    centerHtml += `<div class="draw-pile-deck" style="opacity: 0.35; transform: rotate(15deg); margin-left: -12px;"></div>`;
  }
  centerHtml += `</div>`; // end center-piles
  centerHtml += `<div class="center-deck-count">牌堆剩餘: ${state.deck.length} 張</div>`;
  centerHtml += `</div>`; // end right column
  
  centerHtml += `</div>`; // end flex row
  centerHtml += `</div>`; // end table-center`;
  
  let myHandHtml = '';
  if (me && me.alive) {
    const th = tempHand();
    let cardsHtml = '';
    th.forEach(v => {
      const countessLock = !!localUI.stage && forcedCountess() && v !== 7;
      const sel = localUI.selectedCard === v ? ' selected' : '';
      // Cards are only selectable on your own turn (and the selectCard guard
      // further requires that you've already drawn from the deck). On other
      // players' turns the hand is shown read-only.
      const clickAction = (myTurn && !countessLock) ? `onclick="selectCard(${v})"` : '';
      const cardClass = `table-hand-card${sel}${countessLock ? ' locked' : ''}${myTurn ? '' : ' readonly'}`;
      cardsHtml += `
        <div class="${cardClass}" ${clickAction}>
          <div class="card-badge">${cardRoman(v)}</div>
          <div class="card-portrait-wrap">
            <img class="card-portrait" src="${cardImage(v)}" alt="${cardName(v)}">
          </div>
          <div class="card-info">
            <div class="cname">${cardName(v)}</div>
            <div class="cdesc">${cardDesc(v)}</div>
          </div>
        </div>
      `;
    });
    myHandHtml = `<div class="table-my-hand">${cardsHtml}</div>`;
  }
  
  let tableActionHtml = '';
  if (myTurn && localUI.stage && localUI.selectedCard != null) {
    const card = localUI.selectedCard;
    const needsTarget = [1,2,3,5,6].includes(card);
    const targets = computeValidTargets(card);
    const canConfirm = !needsTarget || targets.length === 0 || (localUI.targetId != null && (card !== 1 || localUI.guess != null));
    
    tableActionHtml = `
      <div class="table-action-row">
        <div class="table-btn secondary" onclick="cancelSelection()">重新選擇</div>
        <div class="table-btn${canConfirm ? '' : ' disabled'}" onclick="${canConfirm ? 'confirmPlay()' : ''}">確認出牌</div>
      </div>
    `;
  }
  
  let guessOverlayHtml = '';
  if (myTurn && localUI.stage && localUI.selectedCard === 1 && localUI.targetId != null) {
    let guessButtons = '';
    for (let n = 2; n <= 8; n++) {
      const isSelected = localUI.guess === n ? ' selected' : '';
      guessButtons += `
        <div class="table-guess-btn${isSelected}" onclick="selectGuess(${n})">
          <span class="guess-roman">${cardRoman(n)}</span>
          <span class="guess-name">${cardName(n)}</span>
        </div>
      `;
    }
    guessOverlayHtml = `
      <div class="table-guess-overlay">
        <div class="table-guess-title">猜測對手的手牌</div>
        <div class="table-guess-grid">
          ${guessButtons}
        </div>
      </div>
    `;
  }
  
  const isDisabled = state.status !== 'playing';
  const tableClass = `game-table${isDisabled ? ' disabled' : ''}${dims.mobile ? ' mobile' : ''}`;

  let promptBannerHtml = '';
  if (myTurn && localUI.stage && localUI.selectedCard != null) {
    const card = localUI.selectedCard;
    const needsTarget = [1,2,3,5,6].includes(card);
    const targets = computeValidTargets(card);
    if (needsTarget && targets.length > 0 && localUI.targetId == null) {
      const promptText = card === 5 
        ? '請選擇一個玩家（對手或自己）施放王子技能' 
        : '請選擇一個對手玩家施放技能';
      promptBannerHtml = `
        <div class="table-target-prompt-banner">
          <div class="pulse-icon">🔮</div>
          <div>${promptText}</div>
        </div>
      `;
    }
  }

  return `<div class="game-table-container${dims.mobile ? ' mobile' : ''}">
    <div class="${tableClass}" style="width:${dims.w}px;height:${dims.h}px;">
      ${seatsHtml}
      ${discardsHtml}
      ${centerHtml}
      ${myHandHtml}
      ${guessOverlayHtml}
      ${tableActionHtml}
      ${promptBannerHtml}
    </div>
  </div>`;
}

function renderPlayerBoard(){
  let rows=state.players.map(p=>{
    let cls='player-row';
    if(p.id===state.currentPlayerId) cls+=' active';
    if(!p.alive) cls+=' dead';
    let tags='';
    if(p.id===state.currentPlayerId) tags+='<span class="tag turn">行動中</span>';
    if(p.isBot) tags+='<span class="tag prot" style="background:#3a3a55;color:#dde0ff;">AI</span>';
    if(p.protected) tags+='<span class="tag prot">受保護</span>';
    if(p.left) tags+='<span class="tag" style="background:#5a3a3a;color:#f0d0d0;">已離開</span>';
    if(p.id===state.hostId) tags+='<span class="tag host">房主</span>';
    let dots='';
    for(let i=0;i<p.tokens;i++) dots+='<span class="token-dot"></span>';
    return `<div class="${cls}">
      <span>${escapeHtml(p.name)}${tags}</span>
      <span class="tokens">${dots}</span>
    </div>`;
  });
  return `<div class="panel"><h2>計分板</h2>${rows.join('')}</div>`;
}

function renderLog(){
  const items=state.log.slice(-30).reverse().map(l=>`<div>${escapeHtml(l)}</div>`).join('');
  return `<div class="panel"><h2>信箋紀事</h2><div class="log-box">${items}</div></div>`;
}

let lastRenderedLogLen=0;
function renderHighlight(){
  if(!state.log || state.log.length===0) return '';
  const isFresh = state.log.length>lastRenderedLogLen;
  lastRenderedLogLen = state.log.length;
  const recent=state.log.slice(-4).reverse(); // newest first
  const opacities=[1, 0.8, 0.6, 0.42];
  const rows=recent.map((l,i)=>{
    const op=opacities[i] ?? 0.4;
    const size=i===0?'15px':'13px';
    const top=i===0?'0':'7px';
    const border=i===0?'':'border-top:1px dashed rgba(201,164,80,0.18);padding-top:6px;';
    const freshClass=(i===0 && isFresh)?' fresh':'';
    return `<div class="${freshClass.trim()}" style="opacity:${op};font-size:${size};margin-top:${top};${border}">${escapeHtml(l)}</div>`;
  }).join('');
  return `<div class="highlight-banner">
    <div class="eyebrow">最新動態</div>
    ${rows}
  </div>`;
}

function renderPlaying(){
  const me=myPlayer();
  const myTurn=state.currentPlayerId===myId;
  let html=renderGameTable();
  html+=renderHighlight();

  if(!me){
    html+='<div class="panel center-text">你不在這場遊戲中。</div>';
    return html+renderLog();
  }

  if(!me.alive){
    html+=`<div class="panel center-text">你已出局,先靜靜旁觀這一輪吧。</div>`;
  }else if(myTurn){
    html+=renderMyTurn(me);
  }else{
    const cur=findP(state.currentPlayerId);
    html+=`<div class="panel center-text">等待 <b>${escapeHtml(cur?cur.name:'')}</b> 行動…</div>`;
  }

  html+=renderEmoteBar();
  html+=renderLog();
  return html;
}

function renderMyTurn(me){
  if(!localUI.stage){
    return `<div class="panel center-text">
      <div>輪到你了。</div>
      <div style="margin: 15px 0; font-size: 16px; color: var(--gold-light); font-weight: 700; animation: flicker 1.8s infinite;">請點擊牌桌上的牌堆抽牌</div>
    </div>`;
  }
  
  let html = '';
  
  if (localUI.selectedCard == null) {
    html += `<div class="panel center-text">
      <div style="font-size: 15px; color: var(--gold-light); font-weight: 700;">請在牌桌上點擊選擇一張手牌出牌</div>
      ${forcedCountess() ? `<div class="hint mt8" style="color: #ff8888;">你同時持有伯爵夫人與國王/王子，必須點擊牌桌上的伯爵夫人棄掉它。</div>` : ''}
    </div>`;
    return html;
  }
  
  const card = localUI.selectedCard;
  html += `<div class="panel">
    <h2>出牌決策：${cardRoman(card)} ${cardName(card)}</h2>
    <div style="font-size:13px; font-style:italic; color:var(--parchment-dark); margin-bottom:12px;">${cardDesc(card)}</div>
  `;
  
  const needsTarget = [1,2,3,5,6].includes(card);
  const targets = computeValidTargets(card);
  if (needsTarget) {
    if (targets.length === 0) {
      html += `<div class="hint mt8">目前沒有可指定的目標，這個效果將會無效。</div>`;
    } else {
      const targetName = localUI.targetId != null ? (findP(localUI.targetId) ? findP(localUI.targetId).name : '') : null;
      html += `<div class="hint mt8" style="color: var(--gold-light); font-weight: 700; font-size: 14px;">
        選擇目標: ${targetName ? `已選擇 <b>${escapeHtml(targetName)}</b>` : '請在上方牌桌點擊目標玩家座位'}
      </div>`;
    }
  }
  
  html += `</div>`;
  return html;
}

function renderWinReason(){
  if(!state.roundEndReason || state.roundEndReason.length===0) return '';
  const lines=state.roundEndReason.map(l=>`<div style="margin-bottom:8px;">${escapeHtml(l)}</div>`).join('');
  return `<div class="panel win-reason banner-pop">
    <h2>勝負關鍵</h2>
    <div style="font-size:16px;line-height:1.7;color:var(--parchment);">${lines}</div>
  </div>`;
}
function renderRoundEnd(){
  const winners=state.roundWinners.map(id=>findP(id)).filter(Boolean);
  const isHost=state.hostId===myId;
  let html=`<div class="panel center-text banner-pop">
    <h2 style="border:none;">本輪結算</h2>
    <div style="color:var(--gold-light);font-size:18px;margin-bottom:8px;">${winners.map(w=>escapeHtml(w.name)).join('、')} 獲得一枚信物</div>
  </div>`;
  html+=renderWinReason();
  html+=`<div class="panel"><h2>各位的手牌</h2>`;
  state.players.forEach(p=>{
    html+=`<div class="player-row"><span>${escapeHtml(p.name)}${p.left?'(已離開)':!p.alive?'(已出局)':''}</span><span>${p.hand.length?cardRoman(p.hand[0])+' '+cardName(p.hand[0]):'—'}</span></div>`;
  });
  html+=`</div>`;
  html+=`<div class="panel center-text">
    ${isHost?`<div class="btn full" onclick="doNextRound()">下一輪</div>`:`<div class="hint">等待房主開始下一輪…</div>`}
  </div>`;
  html+=renderEmoteBar();
  html+=renderLog();
  return html;
}

function renderGameOver(){
  const champs = state.championIds.map(id => findP(id)).filter(Boolean);
  const isHost = state.hostId === myId;
  const champNames = champs.map(c => escapeHtml(c.name)).join('、');
  
  // Choose trophy or crown emoji based on tie or single champion
  const trophyEmoji = champs.length > 1 ? '👑' : '🏆';
  const celebrationTitle = champs.length > 1 ? '共同主宰賭局' : '至高無上的榮耀';

  let html = `<div class="winner-panel">
    <div class="winner-crown-wrapper">
      <span class="winner-crown">${trophyEmoji}</span>
    </div>
    <div class="winner-title">⚜ ${celebrationTitle} ⚜</div>
    <div class="winner-name">${champNames}</div>
    <div class="winner-stats">
      <div class="winner-token-badge">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="color:var(--gold-light); margin-right: 4px; display: inline-block; vertical-align: middle;">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
        </svg>
        <span style="vertical-align: middle;">奪冠信物數：${champs[0] ? champs[0].tokens : state.tokenGoal} / ${state.tokenGoal}</span>
      </div>
    </div>
    <button class="replay-confetti-btn" onclick="triggerConfetti()">
      🎉 重播慶祝特效
    </button>
  </div>`;

  html += renderWinReason();

  // Leaderboard panel
  html += `<div class="panel leaderboard-panel">
    <h2 class="leaderboard-title">🏆 最終名次排行榜</h2>`;
  
  // Sort players by token count (descending)
  const sortedPlayers = state.players.slice().sort((a, b) => b.tokens - a.tokens);
  sortedPlayers.forEach((p, index) => {
    const isChamp = state.championIds.includes(p.id);
    let dots = '';
    for (let i = 0; i < p.tokens; i++) {
      dots += '<span class="token-dot"></span>';
    }
    
    // Determine rank prefix / display
    let rankDisplay = `${index + 1}`;
    if (isChamp) {
      rankDisplay = '👑';
    }

    html += `<div class="leaderboard-row ${isChamp ? 'is-champion' : ''}">
      <span class="leaderboard-rank">${rankDisplay}</span>
      <span class="leaderboard-name">${escapeHtml(p.name)}${p.left ? '(已離開)' : ''}</span>
      <span class="leaderboard-tokens">${dots || '<span style="color:var(--ink-soft);font-size:12px;">無信物</span>'}</span>
    </div>`;
  });
  html += `</div>`;

  html += renderEmoteBar();
  html += `<div class="panel center-text">
    ${isHost ? `<div class="btn full" onclick="doPlayAgain()">重新開始</div>` : `<div class="hint">等待房主重新開始…</div>`}
    <div class="mt8"><span class="btn secondary" onclick="doLeaveRoom()">離開房間</span></div>
  </div>`;
  return html;
}

function renderRoomMenu(){
  const isHost = state && state.hostId===myId;
  const canReset = state && ['playing','roundEnd','gameOver'].includes(state.status);
  return `<div class="modal-overlay" onclick="if(event.target===this) toggleRoomMenu()">
    <div class="modal-box">
      <h3>房間選項</h3>
      ${roomCode?`<p class="hint">目前房間代碼:${escapeHtml(roomCode)}</p>`:''}
      ${isHost && canReset ? `<div class="btn full mt8" onclick="toggleRoomMenu();doResetGame();">重新開始整局</div>` : ''}
      <div class="btn full secondary mt8" onclick="toggleRoomMenu();doLeaveRoom();">離開房間</div>
      <div class="btn full secondary mt8" onclick="toggleRoomMenu()">取消</div>
    </div>
  </div>`;
}
function renderRulesModal(){
  let items='';
  for(let v=1;v<=8;v++){
    items+=`<div class="rule-item" style="display:flex;gap:10px;align-items:flex-start;">
      <img src="${cardImage(v)}" style="width:32px;height:42px;border-radius:4px;border:1px solid var(--gold-deep);object-fit:cover;flex:none;" alt="">
      <div><b>${cardRoman(v)} ${cardName(v)}</b> (${CARDS[v].count} 張)<br>${cardDesc(v)}</div>
    </div>`;
  }
  return `<div class="modal-overlay" onclick="if(event.target===this) toggleRules()">
    <div class="modal-box">
      <h3>遊戲規則</h3>
      <p style="font-size:13px;line-height:1.5;color:var(--ink-soft);">
        <b>遊戲目標：</b>在每輪結束時存活，或手牌點數最高者贏得一枚信物。先集滿信物者獲勝（2人:7枚 / 3人:5枚 / 4人:4枚）。<br>
        <b>基本流程：</b>輪到你時先抽一張牌（手牌變為兩張），選擇其中一張打出並執行其效果，留下另一張牌。<br>
        <b>雙人對決規則：</b>在雙人模式下，遊戲開始時除了隨機蓋掉 1 張牌外，會額外<b>隨機抽 3 張牌「面朝上（公開）」</b>置於牌堆旁。這 3 張牌本局不會被抽到，供雙方推理對手手牌時參考。
      </p>
      ${items}
      <div class="btn full mt14" onclick="toggleRules()">關閉</div>
    </div>
  </div>`;
}

/* ---------------- Confetti Animation ---------------- */
function triggerConfetti() {
  const oldContainer = document.getElementById('game-confetti-container');
  if (oldContainer) oldContainer.remove();

  const container = document.createElement('div');
  container.id = 'game-confetti-container';
  container.className = 'confetti-container';

  const colors = [
    '#e9cd7e', '#c8a13d', '#7a1c2b', '#5c1320', 
    '#2ecc71', '#3498db', '#9b59b6', '#ff6b6b', 
    '#f1c40f', '#fd79a8', '#e67e22', '#1abc9c'
  ];

  for (let i = 0; i < 110; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';

    const left = (Math.random() * 100).toFixed(2) + 'vw';
    const width = Math.floor(Math.random() * 6) + 8; // 8-13px
    const height = Math.floor(Math.random() * 10) + 6; // 6-15px
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    let borderRadius = '0px';
    const shapeRand = Math.random();
    if (shapeRand < 0.25) {
      borderRadius = '50%'; // Circle
    } else if (shapeRand < 0.5) {
      borderRadius = '4px'; // Rounded rect
    } else if (shapeRand < 0.75) {
      piece.style.transform = 'skewY(' + (Math.random() * 30 - 15) + 'deg)';
    }

    const duration = (Math.random() * 3 + 3.5).toFixed(2) + 's';
    const delay = (Math.random() * 3.5).toFixed(2) + 's';

    piece.style.left = left;
    piece.style.width = width + 'px';
    piece.style.height = height + 'px';
    piece.style.backgroundColor = color;
    piece.style.borderRadius = borderRadius;
    piece.style.animationDuration = duration;
    piece.style.animationDelay = delay;

    container.appendChild(piece);
  }

  document.body.appendChild(container);

  setTimeout(() => {
    if (container.parentNode) {
      container.remove();
    }
  }, 9000);
}

/* ---------------- Init ---------------- */
async function init(){
  if(!FIREBASE_READY){
    render();
    return;
  }
  try{
    const sess=localStorage.getItem('loveletter_session');
    if(sess){
      const data=JSON.parse(sess);
      try{
        const snap=await db.ref('rooms/'+data.roomCode).get();
        if(snap.exists()){
          const ns=normalizeState(snap.val());
          if(ns.players.find(p=>p.id===data.myId)){
            roomCode=data.roomCode; myId=data.myId; myName=data.myName;
            state=ns; render(); subscribeRoom(data.roomCode); return;
          }
        }
      }catch(e){}
    }
  }catch(e){}
  try{
    const n=localStorage.getItem('loveletter_name');
    if(n) myName=n;
  }catch(e){}
  render();
}
init();
let lastTableMobile = tableDims().mobile;
window.addEventListener('resize', () => {
  // Seat positions/canvas differ between the mobile (portrait) and desktop layouts,
  // so a full re-render is needed when crossing the breakpoint; otherwise just rescale.
  const nowMobile = tableDims().mobile;
  if (nowMobile !== lastTableMobile) {
    lastTableMobile = nowMobile;
    if (state) { render(); return; }
  }
  updateTableScale();
});
