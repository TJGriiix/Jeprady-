                                                                      /*Constants*/
const QUESTION_URL = "https://opentdb.com/api.php";
const CATEGORY_URL = "https://opentdb.com/api_category.php";
const COLUMNS = 6;
const ROWS = 5;
const VALUES = [100, 200, 300, 400, 500]; 
const LEADERBOARD_KEY = "jepradyHighScores"; 
const MAX_LEADERBOARD = 5; 
const FETCH_DELAY_MS = 5200;  
const state = {
  board: [],   
  players: [],
  currentPlayer: 0, 
  playerCount: 1, 
  answeredCount: 0,  
  totalTiles: 0, 
  activeTile: null, 
  dailyDouble: null, 
};
                                                                        /*The DOM calls*/
const element = {
  startScreen: document.getElementById("startScreen"),
  setupScreen: document.getElementById("setupScreen"),
  gameScreen: document.getElementById("gameScreen"),
  newGameButton: document.getElementById("newGameButton"),
  countButtons: document.getElementById("countButtons"),
  nameFields: document.getElementById("nameFields"),
  toBoardButton: document.getElementById("toBoardButton"),
  loadingMessage: document.getElementById("loadingMessage"),
  loadingText: document.getElementById("loadingText"),
  errorMessage: document.getElementById("errorMessage"),
  errorText: document.getElementById("errorText"),
  retryButton: document.getElementById("retryButton"),
  board: document.getElementById("board"),
  turnLabel: document.getElementById("turnLabel"),
  scoreboard: document.getElementById("scoreboard"),
  answeredCount: document.getElementById("answeredCount"),
  totalTiles: document.getElementById("totalTiles"),
  clueModal: document.getElementById("clueModal"),
  clueTurn: document.getElementById("clueTurn"),
  dailyDoubleBanner: document.getElementById("dailyDoubleBanner"),
  noWagerNote: document.getElementById("noWagerNote"),
  clueCategory: document.getElementById("clueCategory"),
  clueValue: document.getElementById("clueValue"),
  clueQuestion: document.getElementById("clueQuestion"),
  wagerBox: document.getElementById("wagerBox"),
  wagerMax: document.getElementById("wagerMax"),
  wagerInput: document.getElementById("wagerInput"),
  wagerError: document.getElementById("wagerError"),
  wagerButton: document.getElementById("wagerButton"),
  clueOptions: document.getElementById("clueOptions"),
  clueAnswer: document.getElementById("clueAnswer"),
  clueAnswerText: document.getElementById("clueAnswerText"),
  revealButton: document.getElementById("revealButton"),
  gotItButton: document.getElementById("gotItButton"),
  missedButton: document.getElementById("missedButton"),
  resultsModal: document.getElementById("resultsModal"),
  winnerText: document.getElementById("winnerText"),
  resultsList: document.getElementById("resultsList"),
  playAgainButton: document.getElementById("playAgainButton"),
  leaderboardList: document.getElementById("leaderboardList"),
  leaderboardEmpty: document.getElementById("leaderboardEmpty"),
};
                                                                      /*Screen Switching*/
function switchToScreen(screen) {
  element.startScreen.hidden = screen !== "start";
  element.setupScreen.hidden = screen !== "setup";
  element.gameScreen.hidden = screen !== "game";
}

                                            /*Setup*/
function selectPlayerCount(count) {
  state.playerCount = count;

  const buttons = element.countButtons.querySelectorAll(".countButton");
  buttons.forEach((btn) => {
    const isChosen = Number(btn.dataset.count) === count;
    btn.classList.toggle("isSelected", isChosen);
    btn.setAttribute("aria-pressed", String(isChosen));
  });

  renderNameFields(count);
}
function renderNameFields(count) {
  const existing = readNameInputs();
  element.nameFields.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const row = document.createElement("div");
    row.className = "nameFieldRow";

    const inputId = `playerName${i}`;
    const label = document.createElement("label");
    label.setAttribute("for", inputId);
    label.textContent = `Player ${i + 1} name`;

    const input = document.createElement("input");
    input.type = "text";
    input.id = inputId;
    input.maxLength = 20;
    input.autocomplete = "off";
    input.placeholder = `Player ${i + 1}`;
    if (existing[i]) input.value = existing[i];

    row.appendChild(label);
    row.appendChild(input);
    element.nameFields.appendChild(row);
  }
}

function readNameInputs() {
  const inputs = element.nameFields.querySelectorAll("input");
  return Array.from(inputs).map((input) => input.value.trim());
}

                                                                      /*Data Fetching*/
function decodeText(str) {
  return decodeURIComponent(str);
}
function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
                      /*Delay*/
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function responseCodeMessage(code) {
  switch (code) {
    case 1:  return "Not enough questions available. Try again in a moment.";
    case 2:  return "The request had an invalid parameter.";
    case 5:  return "Too many requests. Wait a few seconds and try again.";
    default: return `Unexpected response from the server (code ${code}).`;
  }
}
async function fetchCategories() {
  const response = await fetch(CATEGORY_URL);
  if (!response.ok) {
    throw new Error(`Network error loading categories: ${response.status}`);
  }
  const data = await response.json();
  return shuffle(data.trivia_categories);
}
                                              /*No dupe categories*/
function pickUniqueCategories(pool, count) {
  const chosen = [];
  const usedIds = new Set();
  for (let i = 0; i < pool.length && chosen.length < count; i++) {
    const category = pool[i];
    if (!usedIds.has(category.id)) {
      usedIds.add(category.id);
      chosen.push(category);
    }
  }
  return chosen;
}
function nextUnusedCategory(pool, usedIds) {
  return pool.find((category) => !usedIds.has(category.id)) || null;
}
                                                            /*Category Questions fetch*/
async function fetchCategoryQuestions(categoryId) {
  const url = `${QUESTION_URL}?amount=${ROWS}&type=multiple&category=${categoryId}&encode=url3986`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }
  const data = await response.json();

  if (data.response_code === 1) return []; 
  if (data.response_code !== 0) {
    throw new Error(responseCodeMessage(data.response_code));
  }

  return data.results.map((q) => {
    const correct = decodeText(q.correct_answer);
    const incorrect = q.incorrect_answers.map(decodeText);
    return {
      category: decodeText(q.category),
      difficulty: decodeText(q.difficulty),
      question: decodeText(q.question),
      answer: correct,
      options: shuffle([correct, ...incorrect]),
    };
  });
}
async function fetchColumnTiles(category, columnIndex) {
  showLoadingText(`Loading category ${columnIndex + 1} of ${COLUMNS}: ${category.name}…`);
  const questions = await fetchCategoryQuestions(category.id);
  questions.sort(byDifficulty);
  return questions.map((q, rowIndex) => ({
    ...q,
    value: VALUES[rowIndex],
    answered: false,
    column: columnIndex,
    row: rowIndex,
  }));
}

              /*Clue difficulty sorter*/
function byDifficulty(a, b) {
  const order = { easy: 0, medium: 1, hard: 2 };
  return order[a.difficulty] - order[b.difficulty];
}

                      /*Board fetch*/
async function fetchBoard() {
  const pool = await fetchCategories();
  const usedIds = new Set();

  const categories = pickUniqueCategories(pool, COLUMNS);
  categories.forEach((c) => usedIds.add(c.id));

  const columns = [];

  for (let c = 0; c < COLUMNS; c++) {
    let category = categories[c];
    let tiles = await fetchColumnTiles(category, c);

    let swapAttempts = 0;
    while (tiles.length < ROWS && swapAttempts < pool.length) {
      swapAttempts++;
      const replacement = nextUnusedCategory(pool, usedIds);
      if (!replacement) break; 

      usedIds.add(replacement.id);
      category = replacement;
      showLoadingText(`Swapping in ${category.name}…`);
      await delay(FETCH_DELAY_MS);
      tiles = await fetchColumnTiles(category, c);
    }

    columns.push({ category: category.name, tiles });

    if (c < COLUMNS - 1) {
      await delay(FETCH_DELAY_MS);
    }
  }

  state.totalTiles = columns.reduce((sum, col) => sum + col.tiles.length, 0);

                              /*Daily double tile*/
  const ddColumn = Math.floor(Math.random() * columns.length);
  const ddRow = Math.floor(Math.random() * columns[ddColumn].tiles.length);
  state.dailyDouble = { column: ddColumn, row: ddRow };

  return columns;
}

/*Starting the game*/
async function startGame() {
  const names = readNameInputs();
  state.players = [];
  for (let i = 0; i < state.playerCount; i++) {
    state.players.push({ name: names[i] || `Player ${i + 1}`, score: 0 });
  }
  state.currentPlayer = 0;

  showLoading(true);
  showError(null);
  element.toBoardButton.disabled = true;

  try {
    state.board = await fetchBoard();
    state.answeredCount = 0;
    renderBoard();
    element.totalTiles.textContent = state.totalTiles;
    element.answeredCount.textContent = state.answeredCount;
    updateTurnDisplay();
    renderScoreboard();
    switchToScreen("game");
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
    element.toBoardButton.disabled = false;
  }
}

                                        /*Loading*/
function showLoading(isLoading) {
  element.loadingMessage.hidden = !isLoading;
  if (isLoading) {
    element.loadingText.textContent = "Loading questions…";
  }
}
function showLoadingText(text) {
  element.loadingText.textContent = text;
}

                                /*Error*/
function showError(message) {
  if (message) {
    element.errorText.textContent = message;
    element.errorMessage.hidden = false;
  } else {
    element.errorMessage.hidden = true;
  }
}

                                                            /*Board rendering*/
function renderBoard() {
  element.board.innerHTML = "";

  state.board.forEach((column) => {
    const columnElement = document.createElement("div");
    columnElement.className = "boardColumn";

    const headerElement = document.createElement("div");
    headerElement.className = "categoryHeader";
    headerElement.textContent = column.category;
    columnElement.appendChild(headerElement);

    column.tiles.forEach((tile) => {
      const tileElement = document.createElement("button");
      tileElement.className = "valueTile";
      tileElement.type = "button";
      tileElement.textContent = `$${tile.value}`;
      tileElement.setAttribute(
        "aria-label",
        `${column.category}, ${tile.value} points`
      );
      tileElement.addEventListener("click", () => openClue(tile, tileElement));
      columnElement.appendChild(tileElement);
    });

    element.board.appendChild(columnElement);
  });
}

                      /*Player Turn*/
function currentPlayerName() {
  return state.players[state.currentPlayer].name;
}
function updateTurnDisplay() {
  element.turnLabel.textContent = `${currentPlayerName()}'s turn`;
}

                      /*Player advance*/
function advanceTurn() {
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  updateTurnDisplay();
  renderScoreboard();
}

                                                              /*Scoreboard rendering*/
function renderScoreboard() {
  element.scoreboard.innerHTML = "";

  state.players.forEach((player, i) => {
    const card = document.createElement("div");
    card.className = "scoreCard";
    if (i === state.currentPlayer) card.classList.add("isActive");

    const nameSpan = document.createElement("span");
    nameSpan.className = "scoreCardName";
    nameSpan.textContent = player.name;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "scoreCardScore";
    scoreSpan.textContent = `$${player.score}`;

    card.appendChild(nameSpan);
    card.appendChild(scoreSpan);
    element.scoreboard.appendChild(card);
  });
}

                /*Clue modal flow*/
function isDailyDouble(tile) {
  return state.dailyDouble &&
         tile.column === state.dailyDouble.column &&
         tile.row === state.dailyDouble.row;
}

function openClue(tile, tileEl) {
  if (tile.answered) return; 

  state.activeTile = { tile, tileEl, wager: tile.value };

  element.clueTurn.textContent = `${currentPlayerName()} is answering`;
  element.clueCategory.textContent = state.board[tile.column].category;
  element.clueValue.textContent = `$${tile.value}`;
  element.clueQuestion.textContent = tile.question;
  element.dailyDoubleBanner.hidden = !isDailyDouble(tile);

                      /*Letter choices*/
  element.clueOptions.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  tile.options.forEach((option, i) => {
    const li = document.createElement("li");
    li.textContent = `${letters[i]}. ${option}`;
    element.clueOptions.appendChild(li);
  });

  element.clueAnswerText.textContent = tile.answer;
  element.clueAnswer.hidden = true;
  element.gotItButton.hidden = true;
  element.missedButton.hidden = true;

  if (isDailyDouble(tile)) {
    const score = state.players[state.currentPlayer].score;
    const maxWager = score;
              /*Incase of no money*/
    if (maxWager < 1) {
      state.activeTile.wager = tile.value;
      element.noWagerNote.textContent = `Nothing to wager — playing for $${tile.value}.`;
      element.noWagerNote.hidden = false;

      element.wagerBox.hidden = true;
      element.clueQuestion.hidden = false;
      element.clueOptions.hidden = false;
      element.revealButton.hidden = false;

      element.clueModal.hidden = false;
      element.revealButton.focus();
    } else {
      element.noWagerNote.hidden = true;
      element.wagerMax.textContent = `$${maxWager}`;
      element.wagerInput.max = maxWager;
      element.wagerInput.value = "";
      element.wagerError.hidden = true;

      element.wagerBox.hidden = false;
      element.clueQuestion.hidden = true;
      element.clueOptions.hidden = true;
      element.revealButton.hidden = true;

      element.clueModal.hidden = false;
      element.wagerInput.focus();
    }
  } else {
    element.noWagerNote.hidden = true;
    element.wagerBox.hidden = true;
    element.clueQuestion.hidden = false;
    element.clueOptions.hidden = false;
    element.revealButton.hidden = false;

    element.clueModal.hidden = false;
    element.revealButton.focus(); 
  }
}

                /*Lock in wager */
function lockInWager() {
  const score = state.players[state.currentPlayer].score;
  const maxWager = score;
  const wager = Number(element.wagerInput.value);

  if (!Number.isFinite(wager) || wager < 1) {
    showWagerError("Enter a wager of at least $1.");
    return;
  }
  if (wager > maxWager) {
    showWagerError(`You can't wager more than $${maxWager}.`);
    return;
  }
  if (wager > 500) {
    showWagerError("The maximum wager is $500.");
    return;
  }

  state.activeTile.wager = wager;
  element.wagerError.hidden = true;

  element.wagerBox.hidden = true;
  element.clueQuestion.hidden = false;
  element.clueOptions.hidden = false;
  element.revealButton.hidden = false;
  element.revealButton.focus();
}
function showWagerError(message) {
  element.wagerError.textContent = message;
  element.wagerError.hidden = false;
}
function revealAnswer() {
  element.clueAnswer.hidden = false;
  element.revealButton.hidden = true;
  element.gotItButton.hidden = false;
  element.missedButton.hidden = false;
  element.gotItButton.focus();
}

                        /*Correct answer option*/
function scoreClue(wasCorrect) {
  const { tile, tileEl, wager } = state.activeTile;

  if (wasCorrect) {
    state.players[state.currentPlayer].score += wager;
  } else if (isDailyDouble(tile)) {
    state.players[state.currentPlayer].score -= wager; 
    }

  tile.answered = true;
  tileEl.classList.add("isAnswered");
  tileEl.setAttribute(
    "aria-label",
    `${state.board[tile.column].category}, ${tile.value} points, answered`
  );

  state.answeredCount += 1;
  element.answeredCount.textContent = state.answeredCount;
  renderScoreboard(); 

  closeClue();

  if (state.answeredCount === state.totalTiles) {
    endGame();
  } else {
    advanceTurn();
  }
}

function closeClue() {
  element.clueModal.hidden = true;
  state.activeTile = null;
}

                                                                /*Game ending*/
function endGame() {
  const ranked = [...state.players].sort((a, b) => b.score - a.score);
  const topScore = ranked[0].score;

  const winners = ranked.filter((p) => p.score === topScore);
  if (winners.length > 1) {
    element.winnerText.textContent = `It's a tie at $${topScore}!`;
  } else {
    element.winnerText.textContent = `${ranked[0].name} wins with $${topScore}!`;
  }

  element.resultsList.innerHTML = "";
  ranked.forEach((player) => {
    const li = document.createElement("li");
    if (player.score === topScore) li.classList.add("isWinner");

    const nameSpan = document.createElement("span");
    nameSpan.className = "resultName";
    nameSpan.textContent = player.name;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "resultScore";
    scoreSpan.textContent = `$${player.score}`;

    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    element.resultsList.appendChild(li);
  });

  saveScores(state.players); 

  element.resultsModal.hidden = false;
  element.playAgainButton.focus();
}

                                                                  /*Leaderboard*/
function loadScores() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not read leaderboard:", err);
    return [];
  }
}

function saveScores(players) {
  const scores = loadScores();
  players.forEach((p) => {
    scores.push({ name: p.name, score: p.score, date: Date.now() });
  });

  scores.sort((a, b) => b.score - a.score);
  const trimmed = scores.slice(0, MAX_LEADERBOARD);

  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Could not save leaderboard:", err);
  }

  renderLeaderboard();
}
                      /*Leaderboard rendering*/
function renderLeaderboard() {
  const scores = loadScores();
  element.leaderboardList.innerHTML = "";

  if (scores.length === 0) {
    element.leaderboardEmpty.hidden = false;
    return;
  }
  element.leaderboardEmpty.hidden = true;

  scores.forEach((entry) => {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.className = "playerName";
    nameSpan.textContent = entry.name;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "playerScore";
    scoreSpan.textContent = `$${entry.score}`;

    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    element.leaderboardList.appendChild(li);
  });
}

                                                /*Events*/
function init() {
  element.newGameButton.addEventListener("click", () => {
    selectPlayerCount(state.playerCount); 
    switchToScreen("setup");
  });

  element.countButtons.addEventListener("click", (e) => {
    const btn = e.target.closest(".countButton");
    if (!btn) return;
    selectPlayerCount(Number(btn.dataset.count));
  });

  element.toBoardButton.addEventListener("click", startGame);
  element.retryButton.addEventListener("click", startGame);

  element.revealButton.addEventListener("click", revealAnswer);
  element.wagerButton.addEventListener("click", lockInWager);
  element.gotItButton.addEventListener("click", () => scoreClue(true));
  element.missedButton.addEventListener("click", () => scoreClue(false));

  element.playAgainButton.addEventListener("click", () => {
    element.resultsModal.hidden = true;
    switchToScreen("start");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !element.clueModal.hidden) {
      closeClue();
    }
  });

  selectPlayerCount(1);
  renderLeaderboard();
}

document.addEventListener("DOMContentLoaded", init);