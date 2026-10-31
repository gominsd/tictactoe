/* =========================================
   틱택토 놀이 – Game Logic
   ========================================= */

'use strict';

// ─── Constants ───────────────────────────────────────────────
const MAX_ROUNDS = 9;
const STONES_PER_PLAYER = 4;
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],   // rows
  [0,3,6],[1,4,7],[2,5,8],   // cols
  [0,4,8],[2,4,6]            // diagonals
];
const CHARACTERS = {
  rabbit: '🐰',
  dog:    '🐶',
  cat:    '🐱',
  bear:   '🐻'
};

// ─── State ───────────────────────────────────────────────────
let board         = Array(9).fill(null);        // null | 'black' | 'white'
let currentPlayer = 'black';                     // 'black' | 'white'
let phase         = 'place';                     // 'place' | 'move'
let selectedIdx   = null;                        // cell index currently picked up (move phase)
let gameOver      = false;
let round         = 1;                           // current round (shown after finish)
let scores        = { black: 0, white: 0 };
let records       = [];                          // { round, winner } per finished game
let placedCount   = { black: 0, white: 0 };
let selectedChar  = { black: null, white: null };
let charEmoji     = { black: '⚫', white: '⚪' };

// ─── DOM References ──────────────────────────────────────────
const cells          = Array.from(document.querySelectorAll('.cell'));
const boardEl        = document.getElementById('board');
const turnText       = document.getElementById('turn-text');
const turnBanner     = document.getElementById('turn-banner');
const stockDotsBlack = document.getElementById('stock-dots-black');
const stockDotsWhite = document.getElementById('stock-dots-white');
const stockIconBlack = document.getElementById('stock-icon-black');
const stockIconWhite = document.getElementById('stock-icon-white');
const recordBody     = document.getElementById('record-body');
const scoreSymbolBlack = document.getElementById('score-symbol-black');
const scoreSymbolWhite = document.getElementById('score-symbol-white');
const scoreNumBlack  = document.getElementById('score-num-black');
const scoreNumWhite  = document.getElementById('score-num-white');
const modalOverlay   = document.getElementById('modal-overlay');
const modalIcon      = document.getElementById('modal-icon');
const modalTitle     = document.getElementById('modal-title');
const modalSubtitle  = document.getElementById('modal-subtitle');
const btnReset       = document.getElementById('btn-reset');
const btnNewRound    = document.getElementById('btn-new-round');
const btnModalReset  = document.getElementById('btn-modal-reset');
const btnModalNext   = document.getElementById('btn-modal-next');

const setupOverlay   = document.getElementById('setup-overlay');
const btnSetupStart  = document.getElementById('btn-setup-start');

// ─── Init ─────────────────────────────────────────────────────
function init() {
  renderRecordTable();
  renderStock();
  setupCharacterPicker();
}

// ─── Character Picker ──────────────────────────────────────────
function setupCharacterPicker() {
  document.querySelectorAll('.char-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const owner = btn.dataset.owner;
      const key = btn.dataset.char;
      selectedChar[owner] = key;
      refreshCharButtons();
      checkSetupReady();
    });
  });

  btnSetupStart.addEventListener('click', startGameWithCharacters);
}

function refreshCharButtons() {
  ['black', 'white'].forEach(owner => {
    const otherOwner = owner === 'black' ? 'white' : 'black';
    document.querySelectorAll(`.char-btn[data-owner="${owner}"]`).forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.char === selectedChar[owner]);
      btn.disabled = btn.dataset.char === selectedChar[otherOwner];
    });
  });
}

function checkSetupReady() {
  btnSetupStart.disabled = !(selectedChar.black && selectedChar.white);
}

function startGameWithCharacters() {
  charEmoji.black = CHARACTERS[selectedChar.black] || '⚫';
  charEmoji.white = CHARACTERS[selectedChar.white] || '⚪';

  scoreSymbolBlack.textContent = charEmoji.black;
  scoreSymbolWhite.textContent = charEmoji.white;
  stockIconBlack.textContent   = charEmoji.black;
  stockIconWhite.textContent   = charEmoji.white;

  setupOverlay.classList.add('hidden');
  boardEl.classList.remove('locked');
  cells.forEach(c => c.removeAttribute('disabled'));
  updateTurnBanner();
}

// ─── Cell Click ──────────────────────────────────────────────
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (gameOver) return;
    const idx = parseInt(cell.dataset.index, 10);
    if (phase === 'place') {
      handlePlaceClick(idx, cell);
    } else {
      handleMoveClick(idx);
    }
  });
});

// ─── Place Phase: put a stone on an empty cell ────────────────
function handlePlaceClick(idx, cell) {
  if (board[idx]) return;
  if (placedCount[currentPlayer] >= STONES_PER_PLAYER) return;

  board[idx] = currentPlayer;
  placedCount[currentPlayer]++;
  renderCell(cell, currentPlayer);
  renderStock();

  if (placedCount.black >= STONES_PER_PLAYER && placedCount.white >= STONES_PER_PLAYER) {
    phase = 'move';
  }
  afterMove();
}

// ─── Move Phase: slide a stone into an empty neighboring cell ─
function handleMoveClick(idx) {
  if (board[idx] === currentPlayer) {
    if (selectedIdx === idx) {
      clearSelection();
    } else {
      selectCell(idx);
    }
    return;
  }
  if (selectedIdx === null) return;
  if (board[idx] !== null) return;
  if (!neighbors(selectedIdx).includes(idx)) return;

  moveStone(selectedIdx, idx);
  clearSelection();
  afterMove();
}

function moveStone(from, to) {
  const player = board[from];
  board[from] = null;
  board[to] = player;

  cells[from].innerHTML = '';
  cells[from].classList.remove('mark-black', 'mark-white');
  renderCell(cells[to], player);
}

function selectCell(idx) {
  clearSelection();
  selectedIdx = idx;
  cells[idx].classList.add('selected');
  neighbors(idx).forEach(n => {
    if (board[n] === null) cells[n].classList.add('movable-target');
  });
}

function clearSelection() {
  if (selectedIdx !== null) {
    cells[selectedIdx].classList.remove('selected');
  }
  cells.forEach(c => c.classList.remove('movable-target'));
  selectedIdx = null;
}

// ─── Adjacency (3x3 grid, 8 directions) ───────────────────────
function neighbors(idx) {
  const row = Math.floor(idx / 3), col = idx % 3;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < 3 && c >= 0 && c < 3) out.push(r * 3 + c);
    }
  }
  return out;
}

function hasLegalMove(color) {
  if (phase !== 'move') return true;
  const emptyIdx = board.findIndex(v => v === null);
  if (emptyIdx === -1) return false;
  return neighbors(emptyIdx).some(n => board[n] === color);
}

// ─── Shared post-move checks (win / stalemate / turn switch) ──
function afterMove() {
  const winLine = checkWin();
  if (winLine) {
    highlightWin(winLine);
    endGame(currentPlayer);
    return;
  }

  currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
  if (phase === 'move' && !hasLegalMove(currentPlayer)) {
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    if (!hasLegalMove(currentPlayer)) {
      endGame(null);  // neither player can move — draw
      return;
    }
  }
  updateTurnBanner();
}

// ─── Render Cell ─────────────────────────────────────────────
function renderCell(cellEl, player) {
  cellEl.innerHTML = `<span class="stone ${player}"></span>`;
  cellEl.classList.add(player === 'black' ? 'mark-black' : 'mark-white');
}

// ─── Render Stone Stock (remaining count) ─────────────────────
function renderStock() {
  renderStockFor('black', stockDotsBlack);
  renderStockFor('white', stockDotsWhite);
}

function renderStockFor(color, container) {
  container.innerHTML = '';
  for (let i = 0; i < STONES_PER_PLAYER; i++) {
    const dot = document.createElement('span');
    dot.className = 'stock-dot ' + color + (i < placedCount[color] ? ' used' : '');
    container.appendChild(dot);
  }
}

// ─── Update Turn Banner ──────────────────────────────────────
function updateTurnBanner() {
  const phaseLabel = phase === 'place' ? '말 올려놓기' : '말 이동하기';
  if (currentPlayer === 'black') {
    turnText.textContent = `${charEmoji.black} 흑돌 차례예요! (${phaseLabel})`;
    turnBanner.classList.remove('player-white');
  } else {
    turnText.textContent = `${charEmoji.white} 백돌 차례예요! (${phaseLabel})`;
    turnBanner.classList.add('player-white');
  }
}

// ─── Check Win ───────────────────────────────────────────────
function checkWin() {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

// ─── Highlight Win Cells ─────────────────────────────────────
function highlightWin(line) {
  line.forEach(idx => cells[idx].classList.add('winning'));
}

// ─── End Game ────────────────────────────────────────────────
function endGame(winner) {
  gameOver = true;
  clearSelection();
  cells.forEach(c => c.setAttribute('disabled', ''));

  // Save record
  records.push({ round, winner });
  renderRecordTable();

  // Update scores
  if (winner) {
    scores[winner]++;
    const numEl = winner === 'black' ? scoreNumBlack : scoreNumWhite;
    numEl.textContent = scores[winner];
    bumpScore(numEl);
  }

  // Show modal after slight delay
  setTimeout(() => showModal(winner), 400);
}

// ─── Score Bump Animation ────────────────────────────────────
function bumpScore(el) {
  el.classList.remove('bump');
  void el.offsetWidth;  // reflow
  el.classList.add('bump');
  el.addEventListener('transitionend', () => el.classList.remove('bump'), { once: true });
}

// ─── Show Modal ──────────────────────────────────────────────
function showModal(winner) {
  if (winner === 'black') {
    modalIcon.textContent = '🎉';
    modalTitle.textContent = `${charEmoji.black} 흑돌 승리!`;
    modalSubtitle.textContent = `${round}회차 — 플레이어 1이 이겼어요!`;
  } else if (winner === 'white') {
    modalIcon.textContent = '🎊';
    modalTitle.textContent = `${charEmoji.white} 백돌 승리!`;
    modalSubtitle.textContent = `${round}회차 — 플레이어 2가 이겼어요!`;
  } else {
    modalIcon.textContent = '🤝';
    modalTitle.textContent = '무승부!';
    modalSubtitle.textContent = `${round}회차 — 아슬아슬한 접전이었어요!`;
  }

  // Hide "다음 회차" if all rounds done
  btnModalNext.style.display = round >= MAX_ROUNDS ? 'none' : '';

  modalOverlay.classList.remove('hidden');
}

// ─── Render Record Table ─────────────────────────────────────
function renderRecordTable() {
  recordBody.innerHTML = '';

  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const tr = document.createElement('tr');
    const tdRound  = document.createElement('td');
    const tdWinner = document.createElement('td');

    tdRound.textContent = `${r}회`;

    const rec = records.find(x => x.round === r);
    if (rec) {
      if (rec.winner === 'black') {
        tdWinner.textContent = `${charEmoji.black} 흑돌`;
        tdWinner.className   = 'winner-black';
      } else if (rec.winner === 'white') {
        tdWinner.textContent = `${charEmoji.white} 백돌`;
        tdWinner.className   = 'winner-white';
      } else {
        tdWinner.textContent = '무승부';
        tdWinner.className   = 'draw';
      }
    } else {
      tdWinner.textContent = '';
      tdWinner.className   = 'empty';
    }

    tr.appendChild(tdRound);
    tr.appendChild(tdWinner);
    recordBody.appendChild(tr);
  }
}

// ─── Reset Current Board ─────────────────────────────────────
function resetBoard() {
  board = Array(9).fill(null);
  currentPlayer = 'black';
  phase = 'place';
  selectedIdx = null;
  gameOver = false;
  placedCount = { black: 0, white: 0 };

  cells.forEach(cell => {
    cell.innerHTML = '';
    cell.removeAttribute('disabled');
    cell.className = 'cell';
  });

  renderStock();
  turnBanner.classList.remove('player-white');
  updateTurnBanner();
  modalOverlay.classList.add('hidden');
}

// ─── New Round ───────────────────────────────────────────────
function startNewRound() {
  if (round >= MAX_ROUNDS) return;
  round++;
  resetBoard();
}

// ─── Full Reset (score + records) ────────────────────────────
function fullReset() {
  round   = 1;
  scores  = { black: 0, white: 0 };
  records = [];
  scoreNumBlack.textContent = '0';
  scoreNumWhite.textContent = '0';
  renderRecordTable();
  resetBoard();
}

// ─── Button Events ───────────────────────────────────────────
btnReset.addEventListener('click', fullReset);
btnNewRound.addEventListener('click', () => {
  if (!gameOver) {
    // If game not over yet, just reset board (same round)
    resetBoard();
  } else {
    startNewRound();
  }
});

btnModalReset.addEventListener('click', fullReset);
btnModalNext.addEventListener('click', startNewRound);

// ─── Start ───────────────────────────────────────────────────
init();
