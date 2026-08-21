import { isConfigured as firebaseConfigured, signIn, signOutUser, watchAuth, pullRemoteState, pushState, watchRemoteState } from "./firebase-sync.js";

(function(){
"use strict";

var APP_VERSION = "1.1.1";
var STORAGE_KEY = "docheck-v1";
var CHECK_PATH = "M5 12.5l4.5 4.5L19 7";
var STAR_PATH = "M12 3.5l2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.9l-4.94 2.6.94-5.5-4-3.9 5.53-.8L12 3.5z";
var FS_STEPS = [13,14,15,16,17];

document.getElementById("appVersion").textContent = APP_VERSION;

/* ---------- 저장소 ---------- */
var memoryStore = null, storageOK = true;
function loadRaw(){
  try { return localStorage.getItem(STORAGE_KEY); }
  catch(e){ storageOK = false; return memoryStore; }
}
function saveRaw(str){
  try { localStorage.setItem(STORAGE_KEY, str); storageOK = true; }
  catch(e){ storageOK = false; memoryStore = str; }
}

/* ---------- 상태 ---------- */
var state = null;
function defaultState(){
  return {
    theme: "auto",
    fontStep: 2,
    hideCompleted: false,
    importantOnly: false,
    activeListId: "l1",
    lists: [{ id:"l1", name:"할 일", items:[] }]
  };
}
function load(){
  var raw = loadRaw();
  if(!raw){ state = defaultState(); return; }
  try {
    var s = JSON.parse(raw);
    if(!s || !Array.isArray(s.lists) || s.lists.length===0) throw 0;
    state = Object.assign(defaultState(), s);
  } catch(e){ state = defaultState(); }
}
function save(){
  saveRaw(JSON.stringify(state));
  var t = new Date();
  var label = "자동 저장됨 " + two(t.getHours()) + ":" + two(t.getMinutes());
  var bar = document.getElementById("saveBar");
  bar.textContent = storageOK ? label : "이 환경에선 저장 불가";
  bar.className = "savebar" + (storageOK ? "" : " warn");
  if(cloudUid) schedulePush();
}
function commit(){ save(); renderAll(); }

/* ---------- 유틸 ---------- */
function uid(){ return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function two(n){ return (n<10?"0":"")+n; }
function todayStr(){ var d = new Date(); return d.getFullYear()+"-"+two(d.getMonth()+1)+"-"+two(d.getDate()); }
function dueClass(due, done){
  if(!due || done) return "";
  var t = todayStr();
  if(due < t) return "overdue";
  if(due === t) return "today";
  return "";
}
function dueLabel(due){
  var t = todayStr();
  if(due === t) return "오늘";
  var p = due.split("-");
  return p[1] + "/" + p[2];
}
function el(tag, cls, text){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(text != null) e.textContent = text;
  return e;
}
function svgIcon(path, extraAttrs){
  var s = document.createElementNS("http://www.w3.org/2000/svg","svg");
  s.setAttribute("viewBox","0 0 24 24");
  var p = document.createElementNS("http://www.w3.org/2000/svg","path");
  p.setAttribute("d", path);
  s.appendChild(p);
  return s;
}
function activeList(){
  for(var i=0;i<state.lists.length;i++) if(state.lists[i].id===state.activeListId) return state.lists[i];
  state.activeListId = state.lists[0].id;
  return state.lists[0];
}
function findItem(itemId){
  for(var i=0;i<state.lists.length;i++){
    var list = state.lists[i];
    for(var j=0;j<list.items.length;j++) if(list.items[j].id===itemId) return { item:list.items[j], list:list };
  }
  return null;
}

/* ---------- 정렬/필터 ---------- */
function visible(items){
  return items.filter(function(it){
    if(state.hideCompleted && it.done) return false;
    if(state.importantOnly && !it.important) return false;
    return true;
  });
}
function sorted(items){
  return items.slice().sort(function(a,b){
    if(a.done !== b.done) return a.done ? 1 : -1;
    if(!a.due && !b.due) return 0;
    if(!a.due) return 1;
    if(!b.due) return -1;
    if(a.due !== b.due) return a.due < b.due ? -1 : 1;
    return 0;
  });
}

/* ---------- 아이템 로우 빌드 (전체/오늘/리스트별 공용) ---------- */
function buildItemRow(item, list, opts){
  opts = opts || {};
  var row = el("div","item-row");
  row.dataset.itemId = item.id;

  var delBg = el("div","item-delete","삭제");
  row.appendChild(delBg);

  var li = el("div","item" + (item.done ? " done" : ""));
  row.appendChild(li);

  var star = el("span","star" + (item.important ? " on" : ""));
  star.appendChild(svgIcon(STAR_PATH));
  star.addEventListener("click", function(ev){ ev.stopPropagation(); item.important = !item.important; commit(); });
  li.appendChild(star);

  var chk = el("span","chk" + (item.done ? " on" : ""));
  chk.appendChild(svgIcon(CHECK_PATH));
  chk.addEventListener("click", function(ev){ ev.stopPropagation(); item.done = !item.done; commit(); });
  li.appendChild(chk);

  var txtwrap = el("div","txtwrap");

  var txt = el("div","txt", item.text);
  txt.addEventListener("click", function(){ startEditText(txt, item); });
  txtwrap.appendChild(txt);

  if(item.memo){
    var memo = el("div","memo", item.memo);
    memo.addEventListener("click", function(ev){ ev.stopPropagation(); startEditMemo(memo, item); });
    txtwrap.appendChild(memo);
  } else if(!opts.crossList){
    var addMemo = el("div","memo", "+ 메모");
    addMemo.style.opacity = ".6";
    addMemo.addEventListener("click", function(ev){ ev.stopPropagation(); startEditMemo(addMemo, item); });
    txtwrap.appendChild(addMemo);
  }

  {
    var subCount = (item.subtasks||[]).length;
    if(subCount > 0 || !opts.crossList){
      var doneSub = (item.subtasks||[]).filter(function(s){return s.done;}).length;
      var subrow = el("div","subrow" + (item._subOpen ? " open" : ""));
      var chev = svgIcon("M18 15l-6-6-6 6");
      subrow.appendChild(chev);
      subrow.appendChild(document.createTextNode(subCount ? ("하위 " + doneSub + "/" + subCount) : "하위 항목"));
      subrow.addEventListener("click", function(ev){
        ev.stopPropagation();
        item._subOpen = !item._subOpen;
        renderAll();
      });
      txtwrap.appendChild(subrow);

      if(item._subOpen){
        var subList = el("div","sub-list open");
        (item.subtasks||[]).forEach(function(st){
          var si = el("div","sub-item" + (st.done ? " done" : ""));
          var sc = el("span","chk" + (st.done ? " on" : ""));
          sc.appendChild(svgIcon(CHECK_PATH));
          sc.addEventListener("click", function(ev){ ev.stopPropagation(); st.done = !st.done; commit(); });
          si.appendChild(sc);
          var stx = el("span","subtxt", st.text);
          stx.addEventListener("click", function(ev){ ev.stopPropagation(); startEditSubtext(stx, st); });
          si.appendChild(stx);
          subList.appendChild(si);
        });
        var subadd = el("div","subadd");
        subadd.appendChild(el("span","plus","＋"));
        subadd.appendChild(document.createTextNode("하위 항목 추가"));
        subadd.addEventListener("click", function(ev){
          ev.stopPropagation();
          var inp = el("input","subadd-input");
          inp.placeholder = "하위 항목 입력 후 Enter";
          subadd.replaceWith(inp);
          inp.focus();
          var settled = false;
          function done(commitIt){
            if(settled) return; settled = true;
            var v = inp.value.trim();
            if(commitIt && v){
              item.subtasks = item.subtasks || [];
              item.subtasks.push({ id:uid(), text:v, done:false });
            }
            commit();
          }
          inp.addEventListener("keydown", function(ev2){ if(ev2.key==="Enter") done(true); if(ev2.key==="Escape") done(false); });
          inp.addEventListener("blur", function(){ done(true); });
        });
        subList.appendChild(subadd);
        txtwrap.appendChild(subList);
      }
    }
  }

  li.appendChild(txtwrap);

  if(opts.crossList){
    li.appendChild(el("span","listpill", list.name));
  }

  if(item.due){
    var badge = el("span","due " + dueClass(item.due, item.done), dueLabel(item.due));
    badge.addEventListener("click", function(ev){ ev.stopPropagation(); openItemDatePop(badge, item); });
    li.appendChild(badge);
  } else if(!opts.crossList){
    var addDue = el("span","due", "날짜");
    addDue.addEventListener("click", function(ev){ ev.stopPropagation(); openItemDatePop(addDue, item); });
    li.appendChild(addDue);
  }

  wireSwipeDelete(li, delBg, item, list);

  return row;
}

/* ---------- 텍스트/메모/서브텍스트 편집 ---------- */
function startEditText(txtEl, item){
  var inp = el("input","edit-input");
  inp.value = item.text;
  txtEl.replaceWith(inp);
  inp.focus(); inp.select();
  var settled1 = false;
  function done(commitIt){
    if(settled1) return; settled1 = true;
    var v = inp.value.trim();
    if(commitIt && v) item.text = v;
    commit();
  }
  inp.addEventListener("keydown", function(ev){ if(ev.key==="Enter") done(true); if(ev.key==="Escape") done(false); });
  inp.addEventListener("blur", function(){ done(true); });
  inp.addEventListener("click", function(ev){ ev.stopPropagation(); });
}
function startEditMemo(memoEl, item){
  var inp = el("input","memo-input");
  inp.placeholder = "메모";
  inp.value = item.memo || "";
  memoEl.replaceWith(inp);
  inp.focus();
  var settled2 = false;
  function done(commitIt){
    if(settled2) return; settled2 = true;
    var v = inp.value.trim();
    if(commitIt) item.memo = v || null;
    commit();
  }
  inp.addEventListener("keydown", function(ev){ if(ev.key==="Enter") done(true); if(ev.key==="Escape") done(false); });
  inp.addEventListener("blur", function(){ done(true); });
  inp.addEventListener("click", function(ev){ ev.stopPropagation(); });
}
function startEditSubtext(txtEl, st){
  var inp = el("input","edit-input");
  inp.value = st.text;
  txtEl.replaceWith(inp);
  inp.focus(); inp.select();
  var settled3 = false;
  function done(commitIt){
    if(settled3) return; settled3 = true;
    var v = inp.value.trim();
    if(commitIt && v) st.text = v;
    commit();
  }
  inp.addEventListener("keydown", function(ev){ if(ev.key==="Enter") done(true); if(ev.key==="Escape") done(false); });
  inp.addEventListener("blur", function(){ done(true); });
  inp.addEventListener("click", function(ev){ ev.stopPropagation(); });
}

/* ---------- 스와이프 삭제 ---------- */
var swipeState = null;
function wireSwipeDelete(li, delBg, item, list){
  li.addEventListener("pointerdown", function(ev){
    if(ev.target.closest(".star,.chk,.due,.subrow,.sub-list,.edit-input,.memo,.memo-input")) return;
    swipeState = { id: ev.pointerId, startX: ev.clientX, startY: ev.clientY, dx:0, li:li, delBg:delBg, item:item, list:list, decided:false, horizontal:false };
  });
  li.addEventListener("pointermove", function(ev){
    if(!swipeState || swipeState.id !== ev.pointerId) return;
    var dx = ev.clientX - swipeState.startX;
    var dy = ev.clientY - swipeState.startY;
    if(!swipeState.decided){
      if(Math.abs(dx) > 8 || Math.abs(dy) > 8){
        swipeState.decided = true;
        swipeState.horizontal = Math.abs(dx) > Math.abs(dy);
        if(swipeState.horizontal){ li.classList.add("dragging-swipe"); try{ li.setPointerCapture(ev.pointerId); }catch(e){} }
      } else return;
    }
    if(!swipeState.horizontal) return;
    ev.preventDefault();
    var clamped = Math.min(0, Math.max(dx, -110));
    swipeState.dx = clamped;
    li.style.transform = "translateX(" + clamped + "px)";
  });
  function end(ev){
    if(!swipeState || swipeState.id !== ev.pointerId) return;
    var s = swipeState; swipeState = null;
    if(!s.horizontal){ return; }
    li.classList.remove("dragging-swipe");
    li.classList.add("settling");
    if(s.dx < -60){
      li.style.transform = "translateX(-100%)";
      setTimeout(function(){ deleteItemWithUndo(s.item, s.list); }, 180);
    } else {
      li.style.transform = "translateX(0)";
    }
  }
  li.addEventListener("pointerup", end);
  li.addEventListener("pointercancel", end);
  delBg.addEventListener("click", function(){ deleteItemWithUndo(item, list); });
}

/* ---------- 삭제 + 실행취소 ---------- */
var undoTimer = null, lastDeleted = null;
function deleteItemWithUndo(item, list){
  var idx = list.items.indexOf(item);
  if(idx === -1) return;
  list.items.splice(idx,1);
  lastDeleted = { item:item, list:list, idx:idx };
  save(); renderAll();
  showSnackbar("항목을 삭제했어요", function(){
    if(lastDeleted){
      lastDeleted.list.items.splice(Math.min(lastDeleted.idx, lastDeleted.list.items.length), 0, lastDeleted.item);
      lastDeleted = null;
      commit();
    }
  });
}
function showSnackbar(text, onUndo){
  var bar = document.getElementById("snackbar");
  document.getElementById("snackbarText").textContent = text;
  bar.classList.add("show");
  clearTimeout(undoTimer);
  var undoBtn = document.getElementById("snackbarUndo");
  var handler = function(){ onUndo(); hideSnackbar(); };
  undoBtn.onclick = handler;
  undoTimer = setTimeout(hideSnackbar, 4000);
}
function hideSnackbar(){ document.getElementById("snackbar").classList.remove("show"); clearTimeout(undoTimer); }

/* ---------- 날짜 팝오버 (기존 항목·새 항목 입력창 공용) ---------- */
function openDatePop(anchor, getValue, setValue){
  var pop = document.getElementById("datePop");
  var input = document.getElementById("datePopInput");
  input.value = getValue() || "";
  var r = anchor.getBoundingClientRect();
  pop.style.top = (r.bottom + 6) + "px";
  var left = r.right - 190;
  pop.style.left = Math.max(10, left) + "px";
  pop.classList.add("open");
  input.focus();
  function apply(v){ setValue(v || null); pop.classList.remove("open"); }
  document.getElementById("datePopApply").onclick = function(){ apply(input.value); };
  document.getElementById("datePopClear").onclick = function(){ apply(null); };
  input.onkeydown = function(ev){ if(ev.key==="Enter") apply(input.value); };
}
function openItemDatePop(anchor, item){
  openDatePop(anchor, function(){ return item.due; }, function(v){ item.due = v; commit(); });
}
document.addEventListener("click", function(ev){
  var pop = document.getElementById("datePop");
  if(pop.classList.contains("open") && !ev.target.closest("#datePop") && !ev.target.closest(".due")){
    pop.classList.remove("open");
  }
});

/* ---------- 빈 상태(체크박스 아이콘 + 제목 + 설명) ---------- */
function buildEmpty(title, subtitle){
  var svgNS = "http://www.w3.org/2000/svg";
  var em = el("div","empty");
  var svg = document.createElementNS(svgNS,"svg");
  svg.setAttribute("viewBox","0 0 24 24");
  var rect = document.createElementNS(svgNS,"rect");
  rect.setAttribute("x","4"); rect.setAttribute("y","4"); rect.setAttribute("width","16"); rect.setAttribute("height","16"); rect.setAttribute("rx","5");
  rect.setAttribute("fill","none"); rect.setAttribute("stroke","currentColor"); rect.setAttribute("stroke-width","1.6");
  var path = document.createElementNS(svgNS,"path");
  path.setAttribute("d","M8 12.5l2.5 2.5L16 9");
  path.setAttribute("fill","none"); path.setAttribute("stroke","currentColor");
  path.setAttribute("stroke-width","2"); path.setAttribute("stroke-linecap","round"); path.setAttribute("stroke-linejoin","round");
  svg.appendChild(rect); svg.appendChild(path);
  em.appendChild(svg);
  em.appendChild(el("div","t1", title));
  if(subtitle) em.appendChild(el("div","t2", subtitle));
  return em;
}

/* ---------- 렌더: 전체 ---------- */
function renderAllTab(){
  var host = document.getElementById("allList");
  host.innerHTML = "";
  var any = false;
  state.lists.forEach(function(list){
    var items = sorted(visible(list.items));
    if(items.length === 0) return;
    any = true;
    var overdue = items.some(function(it){ return !it.done && it.due && it.due < todayStr(); });
    host.appendChild(el("div","grouplabel" + (overdue ? " warn" : ""), list.name));
    items.forEach(function(item){ host.appendChild(buildItemRow(item, list, { crossList:true })); });
  });
  if(!any){
    host.appendChild(buildEmpty("표시할 항목이 없어요", "필터를 확인하거나 리스트별 탭에서 항목을 추가해 보세요."));
  }
  document.getElementById("hideDoneBtnAll").classList.toggle("on", state.hideCompleted);
  document.getElementById("importantBtnAll").classList.toggle("on", state.importantOnly);
}

/* ---------- 렌더: 오늘 ---------- */
function renderTodayTab(){
  var host = document.getElementById("todayList");
  host.innerHTML = "";
  var t = todayStr();
  var all = [];
  state.lists.forEach(function(list){
    list.items.forEach(function(item){ if(item.due && item.due <= t) all.push({item:item, list:list}); });
  });
  var totalDue = all.length;
  var doneDue = all.filter(function(p){ return p.item.done; }).length;
  document.getElementById("todayGaugeFill").style.width = totalDue ? (doneDue/totalDue*100)+"%" : "0%";
  document.getElementById("todayGaugeNum").textContent = doneDue + "/" + totalDue;

  var filteredPairs = all.filter(function(p){
    if(state.hideCompleted && p.item.done) return false;
    if(state.importantOnly && !p.item.important) return false;
    return true;
  });
  var overdue = filteredPairs.filter(function(p){ return p.item.due < t; });
  var todays = filteredPairs.filter(function(p){ return p.item.due === t; });
  [overdue, todays].forEach(function(group){ group.sort(function(a,b){ if(a.item.done!==b.item.done) return a.item.done?1:-1; return 0; }); });

  if(overdue.length){
    host.appendChild(el("div","grouplabel warn", "기한 지남 · " + overdue.length));
    overdue.forEach(function(p){ host.appendChild(buildItemRow(p.item, p.list, { crossList:true })); });
  }
  if(todays.length){
    host.appendChild(el("div","grouplabel now", "오늘 · " + todays.length));
    todays.forEach(function(p){ host.appendChild(buildItemRow(p.item, p.list, { crossList:true })); });
  }
  if(!overdue.length && !todays.length){
    host.appendChild(totalDue
      ? buildEmpty("필터에 걸리는 항목이 없어요")
      : buildEmpty("오늘 마감인 항목이 없어요", "여유로운 하루예요."));
  }
  document.getElementById("hideDoneBtnToday").classList.toggle("on", state.hideCompleted);
  document.getElementById("importantBtnToday").classList.toggle("on", state.importantOnly);
  document.getElementById("todayAddHint").textContent = activeList().name + "에 추가돼요 · 마감일은 오늘로 자동 설정";
}

/* ---------- 렌더: 리스트별 ---------- */
function renderListsTab(){
  var list = activeList();
  document.getElementById("listTitle").textContent = list.name;

  var tabsHost = document.getElementById("tabs");
  tabsHost.innerHTML = "";
  state.lists.forEach(function(l){
    var b = el("button", l.id===list.id ? "on" : "", l.name);
    b.addEventListener("click", function(){ state.activeListId = l.id; renderAll(); });
    tabsHost.appendChild(b);
  });
  var addBtn = el("button","add","＋");
  addBtn.addEventListener("click", startNewListInput);
  tabsHost.appendChild(addBtn);

  var total = list.items.length;
  var done = list.items.filter(function(it){ return it.done; }).length;
  document.getElementById("listGaugeFill").style.width = total ? (done/total*100)+"%" : "0%";
  document.getElementById("listGaugeNum").textContent = done + "/" + total;

  var host = document.getElementById("listItems");
  host.innerHTML = "";
  var items = sorted(visible(list.items));
  if(items.length === 0){
    host.appendChild(list.items.length
      ? buildEmpty("필터에 걸리는 항목이 없어요")
      : buildEmpty("아직 항목이 없어요", "위 입력창에 첫 할 일을 추가해 보세요."));
  } else {
    items.forEach(function(item){ host.appendChild(buildItemRow(item, list, { crossList:false })); });
  }
  document.getElementById("hideDoneBtnList").classList.toggle("on", state.hideCompleted);
  document.getElementById("importantBtnList").classList.toggle("on", state.importantOnly);
}

function startNewListInput(){
  var tabsHost = document.getElementById("tabs");
  var addBtn = tabsHost.querySelector(".add");
  var wrap = el("span","tab-input");
  var inp = document.createElement("input");
  inp.placeholder = "새 리스트 이름";
  wrap.appendChild(inp);
  addBtn.replaceWith(wrap);
  inp.focus();
  var settled4 = false;
  function done(commitIt){
    if(settled4) return; settled4 = true;
    var v = inp.value.trim();
    if(commitIt && v){
      var l = { id:uid(), name:v, items:[] };
      state.lists.push(l);
      state.activeListId = l.id;
    }
    commit();
  }
  inp.addEventListener("keydown", function(ev){ if(ev.key==="Enter") done(true); if(ev.key==="Escape") done(false); });
  inp.addEventListener("blur", function(){ done(true); });
}

/* ---------- 전체 렌더 ---------- */
function renderAll(){
  renderAllTab();
  renderTodayTab();
  renderListsTab();
}

/* ---------- 상단바 ---------- */
function renderHeader(){
  var d = new Date();
  var days = ["일","월","화","수","목","금","토"];
  document.getElementById("dateLabel").textContent = (d.getMonth()+1)+"."+d.getDate()+" "+days[d.getDay()];
}

/* ---------- 테마 ---------- */
function applyTheme(){
  var mode = state.theme;
  if(mode === "auto"){
    mode = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  document.body.setAttribute("data-theme", mode);
}
document.getElementById("themeBtn").addEventListener("click", function(){
  var cur = document.body.getAttribute("data-theme");
  state.theme = (cur === "dark") ? "light" : "dark";
  applyTheme(); save();
});

/* ---------- 세그먼트 탭 (스와이프로도 전환되는 캐러셀) ---------- */
var PANEL_ORDER = ["today","lists","all"];
var panelIndex = 0;
var track = document.getElementById("panelsTrack");
var viewport = document.getElementById("panelsViewport");
function goToPanel(idx, animate){
  idx = Math.max(0, Math.min(PANEL_ORDER.length - 1, idx));
  panelIndex = idx;
  track.style.transition = animate ? "transform .32s cubic-bezier(.23,1,.32,1)" : "none";
  track.style.transform = "translateX(-" + (idx * 100) + "%)";
  var name = PANEL_ORDER[idx];
  document.querySelectorAll("#seg button").forEach(function(b){ b.classList.toggle("on", b.dataset.tab === name); });
  document.getElementById("tabs").style.display = (name === "lists") ? "flex" : "none";
}
document.getElementById("seg").addEventListener("click", function(ev){
  var btn = ev.target.closest("button"); if(!btn) return;
  goToPanel(PANEL_ORDER.indexOf(btn.dataset.tab), true);
});

/* 다른 패널(화면 밖) 안의 input에 focus()가 걸리면 브라우저가 임의로
   panelsViewport를 스크롤시켜 그 input을 보여주려 하면서 캐러셀 위치가 어긋나는
   경우가 있다. overflow:clip으로 대부분 막히지만, 혹시 몰라 즉시 되돌리는 안전장치. */
viewport.addEventListener("scroll", function(){ if(viewport.scrollLeft !== 0) viewport.scrollLeft = 0; });

var panelSwipe = null;
viewport.addEventListener("pointerdown", function(ev){
  if(ev.target.closest(".item, .menu, .datepop, .popover")) return;
  panelSwipe = { id: ev.pointerId, startX: ev.clientX, startY: ev.clientY, decided:false, horizontal:false, startIdx:panelIndex };
});
viewport.addEventListener("pointermove", function(ev){
  if(!panelSwipe || panelSwipe.id !== ev.pointerId) return;
  var dx = ev.clientX - panelSwipe.startX, dy = ev.clientY - panelSwipe.startY;
  if(!panelSwipe.decided){
    if(Math.abs(dx) > 8 || Math.abs(dy) > 8){
      panelSwipe.decided = true;
      panelSwipe.horizontal = Math.abs(dx) > Math.abs(dy);
      if(panelSwipe.horizontal){ try{ viewport.setPointerCapture(ev.pointerId); }catch(e){} }
    } else return;
  }
  if(!panelSwipe.horizontal) return;
  ev.preventDefault();
  var vw = viewport.getBoundingClientRect().width;
  var basePct = -panelSwipe.startIdx * 100;
  var dragPct = (dx / vw) * 100;
  var min = -(PANEL_ORDER.length - 1) * 100 - 18, max = 18;
  var pct = Math.max(min, Math.min(max, basePct + dragPct));
  track.style.transition = "none";
  track.style.transform = "translateX(" + pct + "%)";
});
function panelSwipeEnd(ev){
  if(!panelSwipe || panelSwipe.id !== ev.pointerId) return;
  var s = panelSwipe; panelSwipe = null;
  if(!s.horizontal) return;
  var dx = ev.clientX - s.startX;
  var vw = viewport.getBoundingClientRect().width;
  var threshold = vw * 0.18;
  var next = s.startIdx;
  if(dx < -threshold) next = s.startIdx + 1;
  else if(dx > threshold) next = s.startIdx - 1;
  goToPanel(next, true);
}
viewport.addEventListener("pointerup", panelSwipeEnd);
viewport.addEventListener("pointercancel", panelSwipeEnd);
goToPanel(0, false);

/* ---------- 필터 토글 ---------- */
["hideDoneBtnAll","hideDoneBtnToday","hideDoneBtnList"].forEach(function(id){
  document.getElementById(id).addEventListener("click", function(){ state.hideCompleted = !state.hideCompleted; commit(); });
});
["importantBtnAll","importantBtnToday","importantBtnList"].forEach(function(id){
  document.getElementById(id).addEventListener("click", function(){ state.importantOnly = !state.importantOnly; commit(); });
});

/* ---------- 항목 추가 (리스트별) ---------- */
var newItemImportant = false;
var newItemDueValue = null;
document.getElementById("newItemStar").addEventListener("click", function(){
  newItemImportant = !newItemImportant;
  this.classList.toggle("on", newItemImportant);
});
function renderNewItemDueBadge(){
  var badge = document.getElementById("newItemDueBadge");
  if(newItemDueValue){
    badge.textContent = dueLabel(newItemDueValue);
    badge.className = "due " + dueClass(newItemDueValue, false);
  } else {
    badge.textContent = "날짜";
    badge.className = "due";
  }
}
document.getElementById("newItemDueBadge").addEventListener("click", function(ev){
  ev.stopPropagation();
  openDatePop(this, function(){ return newItemDueValue; }, function(v){ newItemDueValue = v; renderNewItemDueBadge(); });
});
function addItem(){
  var t = document.getElementById("newItemText");
  var v = t.value.trim();
  if(!v){ t.focus(); return; }
  activeList().items.push({ id:uid(), text:v, done:false, important:newItemImportant, due:newItemDueValue, memo:null, subtasks:[] });
  t.value = "";
  newItemImportant = false;
  newItemDueValue = null;
  document.getElementById("newItemStar").classList.remove("on");
  renderNewItemDueBadge();
  commit();
  document.getElementById("newItemText").focus();
}
document.getElementById("addItemBtn").addEventListener("click", addItem);
document.getElementById("newItemText").addEventListener("keydown", function(ev){ if(ev.key==="Enter") addItem(); });

/* ---------- 항목 추가 (오늘). 활성 리스트(리스트별 탭에서 마지막으로 본 리스트)에 마감일을 오늘로 넣어 추가한다. ---------- */
var todayItemImportant = false;
document.getElementById("todayItemStar").addEventListener("click", function(){
  todayItemImportant = !todayItemImportant;
  this.classList.toggle("on", todayItemImportant);
});
function addTodayItem(){
  var t = document.getElementById("todayItemText");
  var v = t.value.trim();
  if(!v){ t.focus(); return; }
  activeList().items.push({ id:uid(), text:v, done:false, important:todayItemImportant, due:todayStr(), memo:null, subtasks:[] });
  t.value = "";
  todayItemImportant = false;
  document.getElementById("todayItemStar").classList.remove("on");
  commit();
  document.getElementById("todayItemText").focus();
}
document.getElementById("todayAddItemBtn").addEventListener("click", addTodayItem);
document.getElementById("todayItemText").addEventListener("keydown", function(ev){ if(ev.key==="Enter") addTodayItem(); });

document.getElementById("listTitle").addEventListener("click", function(){ renameListPrompt(); });
function renameListPrompt(){
  var span = document.getElementById("listTitle");
  var list = activeList();
  var inp = el("input","edit-input");
  inp.style.fontSize = "1rem"; inp.style.fontWeight = "700";
  inp.value = list.name;
  span.replaceWith(inp);
  inp.focus(); inp.select();
  var settled5 = false;
  function done(commitIt){
    if(settled5) return; settled5 = true;
    var v = inp.value.trim();
    if(commitIt && v) list.name = v;
    commit();
  }
  inp.addEventListener("keydown", function(ev){ if(ev.key==="Enter") done(true); if(ev.key==="Escape") done(false); });
  inp.addEventListener("blur", function(){ done(true); });
}

/* ---------- 오버플로 메뉴 ---------- */
var moreBtn = document.getElementById("moreBtn"), menu = document.getElementById("menu");
moreBtn.addEventListener("click", function(ev){
  ev.stopPropagation();
  if(menu.classList.contains("open")){ menu.classList.remove("open"); return; }
  var r = moreBtn.getBoundingClientRect();
  menu.style.top = (r.bottom + 6) + "px";
  menu.style.left = Math.max(10, r.right - 180) + "px";
  menu.classList.add("open");
});
document.addEventListener("click", function(){ menu.classList.remove("open"); });
document.getElementById("menuRename").addEventListener("click", function(){ menu.classList.remove("open"); renameListPrompt(); });
document.getElementById("menuUncheckAll").addEventListener("click", function(){
  menu.classList.remove("open");
  activeList().items.forEach(function(it){ it.done = false; });
  commit();
});
document.getElementById("menuClearDone").addEventListener("click", function(){
  menu.classList.remove("open");
  var list = activeList();
  list.items = list.items.filter(function(it){ return !it.done; });
  commit();
});
document.getElementById("menuDeleteList").addEventListener("click", function(){
  menu.classList.remove("open");
  var i = state.lists.indexOf(activeList());
  state.lists.splice(i,1);
  if(state.lists.length===0) state.lists.push({ id:uid(), name:"새 리스트", items:[] });
  state.activeListId = state.lists[Math.max(0,i-1)].id;
  commit();
});

/* ---------- 글자 크기 ---------- */
document.getElementById("fsSlider").addEventListener("input", function(ev){
  state.fontStep = +ev.target.value;
  document.documentElement.style.fontSize = FS_STEPS[state.fontStep] + "px";
  save();
});

/* ---------- 클라우드 팝오버 ---------- */
var cloudBtn = document.getElementById("cloudBtn"), popLayer = document.getElementById("popoverLayer");
cloudBtn.addEventListener("click", function(ev){ ev.stopPropagation(); popLayer.classList.add("open"); });
popLayer.addEventListener("click", function(ev){ if(ev.target === popLayer) popLayer.classList.remove("open"); });

/* ---------- 로컬 백업 ---------- */
document.getElementById("exportBtn").addEventListener("click", function(){
  var blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "todays-check-backup-" + todayStr() + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
});
document.getElementById("importBtn").addEventListener("click", function(){ document.getElementById("importFile").click(); });
document.getElementById("importFile").addEventListener("change", function(ev){
  var f = ev.target.files[0]; if(!f) return;
  var r = new FileReader();
  r.onload = function(){
    try {
      var s = JSON.parse(r.result);
      if(!s || !Array.isArray(s.lists)) throw 0;
      state = Object.assign(defaultState(), s);
      applyTheme();
      document.documentElement.style.fontSize = FS_STEPS[state.fontStep||2] + "px";
      document.getElementById("fsSlider").value = state.fontStep||2;
      commit();
    } catch(e){ alert("가져올 수 없는 파일입니다. 이 앱에서 내보낸 백업 JSON 파일을 선택해 주세요."); }
    ev.target.value = "";
  };
  r.readAsText(f);
});

/* ---------- Firebase 동기화 ---------- */
var cloudUid = null, pushTimer = null, unsubRemote = null;
function schedulePush(){
  clearTimeout(pushTimer);
  pushTimer = setTimeout(function(){ pushState(cloudUid, state); }, 1200);
}
function setSyncUiSignedOut(){
  document.getElementById("syncTitle").textContent = "동기화 꺼짐";
  document.getElementById("syncDesc").textContent = "Google 계정으로 로그인하면 휴대폰·데스크탑에서 같은 리스트를 볼 수 있어요.";
  document.getElementById("googleSyncBtn").hidden = false;
  document.getElementById("syncedInfo").hidden = true;
}
function setSyncUiSignedIn(user){
  document.getElementById("syncTitle").textContent = "동기화 켜짐";
  document.getElementById("syncDesc").textContent = "이 기기에서 바뀐 내용이 자동으로 저장돼요.";
  document.getElementById("googleSyncBtn").hidden = true;
  document.getElementById("syncedInfo").hidden = false;
  document.getElementById("syncAvatar").textContent = (user.displayName||user.email||"?").slice(0,1);
  document.getElementById("syncEmail").textContent = user.displayName || user.email || "";
  document.getElementById("syncStatus").textContent = "동기화됨";
}
document.getElementById("googleSyncBtn").addEventListener("click", function(){
  if(!firebaseConfigured){
    var label = document.getElementById("googleSyncBtnLabel");
    var original = label.textContent;
    label.textContent = "아직 준비 중이에요";
    setTimeout(function(){ label.textContent = original; }, 1600);
    return;
  }
  signIn().catch(function(){
    var label = document.getElementById("googleSyncBtnLabel");
    var original = label.textContent;
    label.textContent = "로그인에 실패했어요";
    setTimeout(function(){ label.textContent = original; }, 1600);
  });
});
if(firebaseConfigured){
  watchAuth(function(user){
    if(user){
      cloudUid = user.uid;
      setSyncUiSignedIn(user);
      pullRemoteState(user.uid).then(function(remote){
        if(remote && Array.isArray(remote.lists)){
          state = Object.assign(defaultState(), remote);
          applyTheme();
          renderAll();
        } else {
          pushState(user.uid, state);
        }
      });
      if(unsubRemote) unsubRemote();
      watchRemoteState(user.uid, function(data){
        if(data && data.state && JSON.stringify(data.state) !== JSON.stringify(state)){
          state = Object.assign(defaultState(), data.state);
          applyTheme();
          renderAll();
        }
      }).then(function(u){ unsubRemote = u; });
    } else {
      cloudUid = null;
      setSyncUiSignedOut();
    }
  });
} else {
  setSyncUiSignedOut();
}

/* ---------- 날짜 자동 갱신 ----------
   앱을 켜둔 채 자정을 넘기면(또는 노트북이 잠들었다 깨어나면), 헤더 날짜와
   "오늘" 탭의 기한 지남/오늘 분류·게이지가 그 순간 자동으로 다시 계산된다.
   재렌더 없이는 날짜가 바뀌어도 화면이 그대로 멈춰 있기 때문에 필요하다. */
var lastKnownDate = null;
function checkDateRollover(){
  var t = todayStr();
  if(lastKnownDate !== null && t !== lastKnownDate){
    renderHeader();
    renderAll();
  }
  lastKnownDate = t;
}
function scheduleMidnightTick(){
  var now = new Date();
  var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 3);
  setTimeout(function(){ checkDateRollover(); scheduleMidnightTick(); }, next - now);
}
document.addEventListener("visibilitychange", function(){ if(!document.hidden) checkDateRollover(); });

/* ---------- 시작 ---------- */
load();
applyTheme();
document.documentElement.style.fontSize = FS_STEPS[state.fontStep||2] + "px";
document.getElementById("fsSlider").value = state.fontStep||2;
renderHeader();
renderAll();
save();
lastKnownDate = todayStr();
scheduleMidnightTick();

})();
