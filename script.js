(() => {
  const STORAGE_KEY = "random-question-board-v1";
  const FREE = "[자유질문]";
  const questions = window.QUESTIONS.slice();

  const $board = document.getElementById("board");
  const $remaining = document.getElementById("remaining");
  const $empty = document.getElementById("empty");
  const $stage = document.getElementById("stage");
  const $big = document.getElementById("big");
  const $question = document.getElementById("question");
  const $back = document.getElementById("back");
  const $hint = document.getElementById("tapHint");

  const signature = JSON.stringify(questions);
  let state = load() || newState();
  let busy = false;
  let canTear = false;

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

    const isFree = state.slots[i] === FREE;
    $question.textContent = isFree ? "" : state.slots[i];
    if (isFree) resetFree();
    $big.className = "big" + (isFree ? " free" : "");
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

    // 커진 뽑기는 직접 눌러야 뜯어진다
    $hint.classList.remove("gone");
    setTimeout(() => {
      $big.classList.add("ready");
      canTear = true;
    }, 600);
  }

  function tear() {
    if (!canTear) return;
    canTear = false;
    $hint.classList.add("gone");
    $big.classList.remove("ready");
    $big.classList.add("shake");
    setTimeout(() => $big.classList.add("tear"), 300);
    setTimeout(() => $big.classList.add("torn"), 700);
    setTimeout(() => {
      $back.hidden = false;
      requestAnimationFrame(() => $back.classList.add("show"));
    }, 1100);
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
  $big.addEventListener("click", tear);
  document.addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("#freePanel") && e.key !== "Escape") return;
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      if (canTear) { if (e.key !== "Escape") { e.preventDefault(); tear(); } }
      else closeStage();
    }
  });

  document.getElementById("reset").addEventListener("click", () => {
    if (busy) return;
    if (state.taken.length && !confirm("뽑기판을 초기화할까요?\n질문 위치가 모두 새로 섞입니다.")) return;
    state = newState();
    save();
    render();
  });

  // ---- 자유질문: 인원수만큼 색 돌림판을 돌려 질문할 사람을 정한다 ----
  const COLORS = [
    ["빨강", "#ef4444"], ["파랑", "#3b82f6"], ["노랑", "#facc15"], ["초록", "#22c55e"],
    ["보라", "#a855f7"], ["주황", "#f97316"], ["분홍", "#ec4899"], ["하늘", "#38bdf8"],
    ["갈색", "#a16207"], ["연두", "#a3e635"], ["남색", "#4338ca"], ["회색", "#6b7280"]
  ];
  const $setup = document.getElementById("freeSetup");
  const $wheelBox = document.getElementById("freeWheel");
  const $people = document.getElementById("people");
  const $wheel = document.getElementById("wheel");
  const $pointer = document.getElementById("pointer");
  const $legend = document.getElementById("legend");
  const $result = document.getElementById("result");
  const SIZE = 250;
  let count = 4, rotation = 0, spinning = false, audio = null;

  function clampPeople() {
    const n = Math.round(Number($people.value)) || 2;
    count = Math.min(COLORS.length, Math.max(2, n));
    $people.value = count;
    return count;
  }

  function resetFree() {
    spinning = false;
    $setup.hidden = false;
    $wheelBox.hidden = true;
  }

  function drawWheel() {
    const dpr = window.devicePixelRatio || 1;
    $wheel.width = SIZE * dpr;
    $wheel.height = SIZE * dpr;
    const c = $wheel.getContext("2d");
    c.scale(dpr, dpr);
    const r = SIZE / 2, seg = (Math.PI * 2) / count;
    c.clearRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < count; i++) {
      const a0 = -Math.PI / 2 + i * seg;
      c.beginPath();
      c.moveTo(r, r);
      c.arc(r, r, r - 3, a0, a0 + seg);
      c.closePath();
      c.fillStyle = COLORS[i][1];
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = "#fff";
      c.stroke();
      c.save();
      c.translate(r, r);
      c.rotate(a0 + seg / 2);
      c.textAlign = "right";
      c.textBaseline = "middle";
      c.font = "700 15px sans-serif";
      c.lineWidth = 3;
      c.strokeStyle = "rgba(0,0,0,.55)";
      c.fillStyle = "#fff";
      c.strokeText(COLORS[i][0], r - 16, 0);
      c.fillText(COLORS[i][0], r - 16, 0);
      c.restore();
    }
    c.beginPath();
    c.arc(r, r, 14, 0, Math.PI * 2);
    c.fillStyle = "#fff";
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = "#222";
    c.stroke();
  }

  function makeWheel() {
    clampPeople();
    rotation = 0;
    $wheel.style.transform = "rotate(0deg)";
    drawWheel();
    $legend.textContent = "";
    for (let i = 0; i < count; i++) {
      const li = document.createElement("li");
      const dot = document.createElement("i");
      dot.style.background = COLORS[i][1];
      li.append(dot, COLORS[i][0]);
      $legend.appendChild(li);
    }
    $result.textContent = "각자 색을 하나씩 정하세요. 정했다면 돌림판을 눌러요!";
    $setup.hidden = true;
    $wheelBox.hidden = false;
  }

  function tick() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 900;
      g.gain.setValueAtTime(.08, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .04);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + .04);
    } catch (e) { /* 소리를 낼 수 없으면 건너뜀 */ }
    $pointer.classList.remove("flick");
    void $pointer.offsetWidth;
    $pointer.classList.add("flick");
  }

  const norm = d => ((d % 360) + 360) % 360;

  function spin() {
    if (spinning) return;
    spinning = true;
    Array.from($legend.children).forEach(li => li.classList.remove("win"));
    $result.textContent = "돌아가는 중...";
    const seg = 360 / count;
    const winner = Math.floor(Math.random() * count);
    const target = (winner + .5 + (Math.random() - .5) * .7) * seg; // 화살표가 가리킬 각도
    const start = rotation;
    const delta = norm(-target - start) + 360 * (5 + Math.floor(Math.random() * 3));
    const dur = 5000, t0 = performance.now();
    let last = Math.floor(norm(-start) / seg);
    (function frame(now) {
      const t = Math.min(1, (now - t0) / dur);
      rotation = start + delta * (1 - Math.pow(1 - t, 4));
      $wheel.style.transform = `rotate(${rotation}deg)`;
      const idx = Math.floor(norm(-rotation) / seg);
      if (idx !== last) { last = idx; tick(); }
      if (t < 1) return requestAnimationFrame(frame);
      spinning = false;
      $result.textContent = "";
      const name = document.createElement("b");
      name.textContent = COLORS[winner][0];
      name.style.color = COLORS[winner][1];
      $result.append(name, " 색 당첨! 이 색을 고른 사람이 질문해요. (다시 돌리려면 돌림판을 누르세요)");
      $legend.children[winner].classList.add("win");
    })(t0);
  }

  document.getElementById("minus").addEventListener("click", () => { $people.value = clampPeople() - 1; clampPeople(); });
  document.getElementById("plus").addEventListener("click", () => { $people.value = clampPeople() + 1; clampPeople(); });
  $people.addEventListener("change", clampPeople);
  $people.addEventListener("keydown", e => { if (e.key === "Enter") makeWheel(); });
  document.getElementById("makeWheel").addEventListener("click", makeWheel);
  document.getElementById("redo").addEventListener("click", () => { if (!spinning) resetFree(); });
  document.getElementById("wheelHit").addEventListener("click", spin);

  render();
})();
