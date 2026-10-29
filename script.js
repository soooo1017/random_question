(() => {
  const STORAGE_KEY = "random-question-board-v1";
  const questions = window.QUESTIONS.slice();

  const $board = document.getElementById("board");
  const $remaining = document.getElementById("remaining");
  const $empty = document.getElementById("empty");
  const $stage = document.getElementById("stage");
  const $big = document.getElementById("big");
  const $question = document.getElementById("question");
  const $back = document.getElementById("back");

  const signature = JSON.stringify(questions);
  let state = load() || newState();
  let busy = false;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // slots[i] = i번째 칸에 숨겨진 질문, taken = 이미 뽑은 칸 번호들
  function newState() {
    return { signature, slots: shuffle(questions), taken: [] };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && s.signature === signature && s.slots.length === questions.length) return s;
    } catch (e) { /* 저장값이 없거나 깨졌으면 새로 시작 */ }
    return null;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
  }

  function render() {
    $board.textContent = "";
    state.slots.forEach((_, i) => {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "ticket" + (state.taken.includes(i) ? " gone" : "");
      t.setAttribute("aria-label", "뽑기 " + (i + 1));
      t.addEventListener("click", () => pick(i, t));
      $board.appendChild(t);
    });
    updateCount();
  }

  function updateCount() {
    const left = state.slots.length - state.taken.length;
    $remaining.textContent = left;
    $empty.hidden = left > 0;
  }

  function pick(i, el) {
    if (busy || state.taken.includes(i)) return;
    busy = true;
    const from = el.getBoundingClientRect();

    state.taken.push(i);
    save();
    el.classList.add("gone");
    updateCount();

    $question.textContent = state.slots[i];
    $big.className = "big";
    $back.classList.remove("show");
    $stage.hidden = false;

    // 작은 뽑기 위치에서 화면 중앙으로 커지는 효과 (FLIP)
    const to = $big.getBoundingClientRect();
    const dx = from.left - to.left, dy = from.top - to.top, s = from.width / to.width;
    $big.style.transition = "none";
    $big.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
    $stage.offsetWidth; // reflow
    requestAnimationFrame(() => {
      $stage.classList.add("open");
      $big.style.transition = "transform .55s cubic-bezier(.2, .8, .3, 1.1)";
      $big.style.transform = "none";
    });

    setTimeout(() => $big.classList.add("shake"), 600);
    setTimeout(() => $big.classList.add("tear"), 900);
    setTimeout(() => $big.classList.add("torn"), 1300);
    setTimeout(() => {
      $back.hidden = false;
      requestAnimationFrame(() => $back.classList.add("show"));
    }, 1700);
  }

  function closeStage() {
    if ($back.hidden) return;
    $stage.classList.remove("open");
    $back.classList.remove("show");
    setTimeout(() => {
      $stage.hidden = true;
      $back.hidden = true;
      busy = false;
    }, 250);
  }

  $back.addEventListener("click", closeStage);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" || e.key === "Enter") closeStage();
  });

  document.getElementById("reset").addEventListener("click", () => {
    if (busy) return;
    if (state.taken.length && !confirm("뽑기판을 초기화할까요?\n질문 위치가 모두 새로 섞입니다.")) return;
    state = newState();
    save();
    render();
  });

  render();
})();
