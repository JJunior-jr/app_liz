/**
 * app.js — Lógica principal do App Rotina Bebê 🍼
 * Gerencia navegação de datas, cards e interações com a API.
 */
import { api } from './api.js';

Chart.register(ChartDataLabels);

// ── Estado global ────────────────────────────────────────────────────────────
let currentDate = new Date();
let activeSleepId = null;
let activeBreastId = null;

// ── Utilitário de badge pop (Ant Design Mobile: Badge feedback) ───────────────
function popBadge(el) {
  el.classList.remove('pop');
  void el.offsetWidth; // force reflow
  el.classList.add('pop');
}

// ── Utilitários de data ───────────────────────────────────────────────────────
function toISODate(d) {
  const pad = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function formatDate(d) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(isoStr) {
  if (!isoStr) return '--:--';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function toLocalISOStringWithOffset(d) {
  const tzo = -d.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  const pad = (num) => (num < 10 ? '0' : '') + num;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
    dif + pad(Math.floor(Math.abs(tzo) / 60)) + ':' + pad(Math.abs(tzo) % 60);
}

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ── Interceptador de Registros Retroativos (Drawer) ──────────────────────────
let pendingAction = null;

function isPastDate(d) {
  const today = new Date();
  const compareDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return compareDate < todayDate;
}

function executeOrConfirm(actionFn) {
  if (isPastDate(currentDate)) {
    pendingAction = actionFn;
    document.getElementById('retroactive-drawer-date').textContent = formatDate(currentDate);
    const drawer = document.getElementById('retroactive-drawer');
    drawer.style.display = 'flex';
    setTimeout(() => drawer.classList.add('visible'), 10);
  } else {
    actionFn(null);
  }
}

function setupRetroactiveDrawer() {
  const drawer = document.getElementById('retroactive-drawer');
  const btnCancel = document.getElementById('btn-cancel-retroactive');
  const btnConfirm = document.getElementById('btn-confirm-retroactive');

  const closeDrawer = () => {
    drawer.classList.remove('visible');
    setTimeout(() => drawer.style.display = 'none', 300);
    pendingAction = null;
  };

  btnCancel.addEventListener('click', closeDrawer);
  
  btnConfirm.addEventListener('click', async () => {
    if (pendingAction) {
      const targetDateStr = toISODate(currentDate);
      const originalHtml = btnConfirm.innerHTML;
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = '<span class="spinner"></span>';
      try {
        await pendingAction(targetDateStr);
        closeDrawer();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = originalHtml;
      }
    }
  });
}

// ── Navegação de datas ────────────────────────────────────────────────────────
function updateDateLabel() {
  document.getElementById('current-date-label').textContent = formatDate(currentDate);
}

function navigate(delta) {
  currentDate.setDate(currentDate.getDate() + delta);
  updateDateLabel();
  loadAll();
}

// ── Loader de botão ───────────────────────────────────────────────────────────
async function withLoading(btn, fn) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  try {
    await fn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ── Lógica de Amamentação Ativa (Peito) ──────────────────────────────────────
function updateBreastUI(isActive, side = '') {
  document.getElementById('btn-Breast-left').style.display = isActive ? 'none' : 'flex';
  document.getElementById('btn-Breast-right').style.display = isActive ? 'none' : 'flex';
  
  const indicator = document.getElementById('breast-active-indicator');
  indicator.classList.toggle('visible', isActive);
  indicator.style.display = isActive ? 'flex' : 'none';
  
  if (isActive) {
    const sideText = side === 'left' ? 'Peito Esquerdo' : 'Peito Direito';
    document.getElementById('breast-active-text').textContent = `🤱 Amamentação no ${sideText} em andamento...`;
  }
}

window.finishBreast = async (id) => {
  try {
    const record = await api.feeding.end(id);
    const dur = formatDuration(record.duration_min);
    if (activeBreastId === id) {
      activeBreastId = null;
      updateBreastUI(false);
    }
    toast(`🤱 Amamentação concluída! Duração: ${dur}.`);
    await loadFeeding();
    await updateSummary();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.editBreast = async (id, startIsoStr, endIsoStr) => {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const payload = {};

  const startFormatted = formatTime(startIsoStr);
  const newStartTime = prompt('Alterar horário de INÍCIO da amamentação (HH:MM):', startFormatted);

  if (newStartTime && newStartTime !== startFormatted) {
    if (!regex.test(newStartTime)) return toast('Formato inválido para início!', 'error');
    const updatedStart = new Date(startIsoStr);
    const [h, m] = newStartTime.split(':');
    updatedStart.setHours(parseInt(h), parseInt(m));
    payload.recorded_at = toLocalISOStringWithOffset(updatedStart);
  }

  if (endIsoStr && endIsoStr !== 'null' && endIsoStr !== 'undefined') {
    const endFormatted = formatTime(endIsoStr);
    const newEndTime = prompt('Alterar horário de TÉRMINO da amamentação (HH:MM):', endFormatted);

    if (newEndTime && newEndTime !== endFormatted) {
      if (!regex.test(newEndTime)) return toast('Formato inválido para término!', 'error');
      const updatedEnd = new Date(endIsoStr);
      const [h, m] = newEndTime.split(':');
      updatedEnd.setHours(parseInt(h), parseInt(m));
      payload.end_time = toLocalISOStringWithOffset(updatedEnd);
    }
  }

  if (Object.keys(payload).length === 0) return;

  try {
    await api.feeding.update(id, payload);
    toast('Horários de amamentação atualizados!');
    await loadFeeding();
    await updateSummary();
  } catch (err) {
    toast(err.message, 'error');
  }
};

//  CARD: AMAMENTAÇÃO 🍼
// ════════════════════════════════════════════════════════════════════════════

let selectedMlOffered = null;
let selectedMlConsumed = null;

function setupFeedingCard() {
  // Toggles do form de mamadeira
  document.getElementById('btn-bottle').addEventListener('click', () => {
    const form = document.getElementById('ml-form');
    form.classList.toggle('visible');
  });

  // Chips de ML ofertados
  document.querySelectorAll('#chips-offered .ml-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#chips-offered .ml-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedMlOffered = parseInt(chip.dataset.ml);
      document.getElementById('ml-offered-input').value = selectedMlOffered;
    });
  });

  // Chips de ML consumidos
  document.querySelectorAll('#chips-consumed .ml-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#chips-consumed .ml-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedMlConsumed = parseInt(chip.dataset.ml);
      document.getElementById('ml-consumed-input').value = selectedMlConsumed;
    });
  });

  // Input manual sincroniza chip
  document.getElementById('ml-offered-input').addEventListener('input', e => {
    selectedMlOffered = parseInt(e.target.value) || null;
    syncChips('#chips-offered', selectedMlOffered);
  });

  document.getElementById('ml-consumed-input').addEventListener('input', e => {
    selectedMlConsumed = parseInt(e.target.value) || null;
    syncChips('#chips-consumed', selectedMlConsumed);
  });

  // Confirmar mamadeira
  document.getElementById('btn-bottle-confirm').addEventListener('click', (e) => {
    const mlOffered = parseInt(document.getElementById('ml-offered-input').value);
    const mlConsumed = parseInt(document.getElementById('ml-consumed-input').value) || null;

    if (!mlOffered || mlOffered <= 0) {
      toast('Informe quantos ML foram ofertados!', 'error');
      return;
    }

    executeOrConfirm(async (targetDate) => {
      await withLoading(e.target, async () => {
        await api.feeding.create({ feeding_type: 'bottle', ml_offered: mlOffered, ml_consumed: mlConsumed }, targetDate);
        toast(`✅ Mamadeira ${mlOffered}ml registrada!`);
        resetBottleForm();
        await loadFeeding();
        await updateSummary();
      });
    });
  });

  // Peito esquerdo
  document.getElementById('btn-Breast-left').addEventListener('click', (e) => {
    executeOrConfirm(async (targetDate) => {
      await withLoading(e.target, async () => {
        const record = await api.feeding.start({ breast_side: 'left' }, targetDate);
        activeBreastId = record.id;
        toast('✅ Amamentação iniciada no peito esquerdo! 🤱');
        updateBreastUI(true, 'left');
        await loadFeeding();
        await updateSummary();
      });
    });
  });

  // Peito direito
  document.getElementById('btn-Breast-right').addEventListener('click', (e) => {
    executeOrConfirm(async (targetDate) => {
      await withLoading(e.target, async () => {
        const record = await api.feeding.start({ breast_side: 'right' }, targetDate);
        activeBreastId = record.id;
        toast('✅ Amamentação iniciada no peito direito! 🤱');
        updateBreastUI(true, 'right');
        await loadFeeding();
        await updateSummary();
      });
    });
  });

  // Finalizar amamentação
  document.getElementById('btn-breast-end').addEventListener('click', async (e) => {
    if (!activeBreastId) return;
    await withLoading(e.target, async () => {
      const record = await api.feeding.end(activeBreastId);
      const dur = formatDuration(record.duration_min);
      activeBreastId = null;
      toast(`🤱 Amamentação concluída! Duração: ${dur}.`);
      updateBreastUI(false);
      await loadFeeding();
      await updateSummary();
    });
  });
}

function syncChips(selector, value) {
  document.querySelectorAll(`${selector} .ml-chip`).forEach(c => {
    c.classList.toggle('selected', parseInt(c.dataset.ml) === value);
  });
}

function resetBottleForm() {
  document.getElementById('ml-offered-input').value = '';
  document.getElementById('ml-consumed-input').value = '';
  document.querySelectorAll('.ml-chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('ml-form').classList.remove('visible');
  selectedMlOffered = null;
  selectedMlConsumed = null;
}

async function loadFeeding() {
  const dateStr = toISODate(currentDate);
  const records = await api.feeding.list(dateStr);
  const list = document.getElementById('feeding-list');
  const badge = document.getElementById('feeding-badge');

  badge.textContent = records.length;
  popBadge(badge);

  if (records.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhum registro hoje 🍼</p>';
    return;
  }

  list.innerHTML = records.map(r => {
    let icon, detail;
    if (r.feeding_type === 'bottle') {
      icon = '🍼';
      const consumed = r.ml_consumed != null ? `/${r.ml_consumed}ml` : '';
      let percentStr = '';
      if (r.ml_consumed != null && r.ml_offered > 0) {
          const pct = Math.round((r.ml_consumed / r.ml_offered) * 100);
          percentStr = ` (${pct}%)`;
      }
      detail = `Mamadeira ${r.ml_offered}ml${consumed}${percentStr}`;
    } else {
      const sideMap = { left: 'Peito Esquerdo', right: 'Peito Direito' };
      icon = '🤱';
      const sideName = sideMap[r.breast_side] || 'Peito';
      if (r.end_time == null) {
        detail = `${sideName} ⏳ em andamento`;
      } else {
        detail = `${sideName} (${formatDuration(r.duration_min)})`;
      }
    }
    const off = r.ml_offered != null ? r.ml_offered : 'null';
    const cons = r.ml_consumed != null ? r.ml_consumed : 'null';

    // Botão de finalizar na própria lista se for peito ativo
    let finishBtn = '';
    if (r.feeding_type !== 'bottle' && r.end_time == null) {
      finishBtn = `<button class="record-edit-btn" onclick="finishBreast(${r.id})" title="Finalizar" style="color: var(--mint-700); font-weight: bold; opacity: 1; margin-left: 6px;">✔️ Concluir</button>`;
    }

    // Botão de editar horários: peito usa editBreast se concluído, mamadeira usa editFeeding
    let editBtn = '';
    if (r.feeding_type === 'bottle') {
      editBtn = `<button class="record-edit-btn" onclick="editFeeding(${r.id}, '${r.recorded_at}', ${off}, ${cons})" title="Editar">✏️</button>`;
    } else if (r.end_time != null) {
      editBtn = `<button class="record-edit-btn" onclick="editBreast(${r.id}, '${r.recorded_at}', '${r.end_time}')" title="Editar horários">✏️</button>`;
    }

    return `
      <div class="record-item" id="feed-${r.id}">
        <span class="record-icon">${icon}</span>
        <div class="record-info">
          <div class="record-time">
            ${formatTime(r.recorded_at)} 
            ${editBtn}
            ${finishBtn}
          </div>
          <div class="record-detail">${detail}</div>
        </div>
        <button class="record-delete" onclick="deleteFeed(${r.id})" title="Remover">✕</button>
      </div>
    `;
  }).join('');
}

window.editFeeding = (id, currentIsoStr, mlOffered, mlConsumed) => {
  const currentFormatted = formatTime(currentIsoStr);
  document.getElementById('edit-feed-time').value = currentFormatted;
  
  const bottleFields = document.getElementById('edit-feed-bottle-fields');
  if (mlOffered !== null) {
      bottleFields.style.display = 'block';
      document.getElementById('edit-feed-offered').value = mlOffered;
      document.getElementById('edit-feed-consumed').value = mlConsumed || '';
  } else {
      bottleFields.style.display = 'none';
  }
  
  const modal = document.getElementById('edit-feeding-modal');
  modal.style.display = 'flex';
  
  document.getElementById('btn-cancel-edit-feed').onclick = () => {
      modal.style.display = 'none';
  };
  
  document.getElementById('btn-save-edit-feed').onclick = async () => {
      const newTime = document.getElementById('edit-feed-time').value;
      if (!newTime) return toast('Preencha o horário!', 'error');
      
      const payload = {};
      if (newTime !== currentFormatted) {
          const updatedDateTime = new Date(currentIsoStr);
          const [hours, minutes] = newTime.split(':');
          updatedDateTime.setHours(parseInt(hours), parseInt(minutes));
          payload.recorded_at = toLocalISOStringWithOffset(updatedDateTime);
      }
      
      if (mlOffered !== null) {
          payload.ml_offered = parseInt(document.getElementById('edit-feed-offered').value) || 0;
          payload.ml_consumed = parseInt(document.getElementById('edit-feed-consumed').value) || 0;
      }
      
      try {
          await api.feeding.update(id, payload);
          toast('Registro atualizado com sucesso!');
          modal.style.display = 'none';
          await loadFeeding();
          await updateSummary();
      } catch (err) {
          toast(err.message, 'error');
      }
  };
};

window.deleteFeed = async (id) => {
  if (!confirm('Remover este registro?')) return;
  await api.feeding.delete(id);
  toast('Registro removido', 'success');
  await loadFeeding();
  await updateSummary();
};

// ════════════════════════════════════════════════════════════════════════════
//  CARD: TROCA DE FRALDA 👶
// ════════════════════════════════════════════════════════════════════════════

function setupDiaperCard() {
  document.getElementById('btn-diaper-pee').addEventListener('click', (e) => {
    executeOrConfirm(async (targetDate) => {
      await withLoading(e.target, async () => {
        await api.diaper.create({ has_pee: true, has_poop: false }, targetDate);
        toast('✅ Xixi registrado! 💧');
        await loadDiapers();
        await updateSummary();
      });
    });
  });

  document.getElementById('btn-diaper-poop').addEventListener('click', (e) => {
    executeOrConfirm(async (targetDate) => {
      await withLoading(e.target, async () => {
        await api.diaper.create({ has_pee: false, has_poop: true }, targetDate);
        toast('✅ Cocô registrado! 💩');
        await loadDiapers();
        await updateSummary();
      });
    });
  });

  document.getElementById('btn-diaper-both').addEventListener('click', (e) => {
    executeOrConfirm(async (targetDate) => {
      await withLoading(e.target, async () => {
        await api.diaper.create({ has_pee: true, has_poop: true }, targetDate);
        toast('✅ Xixi + Cocô registrado!');
        await loadDiapers();
        await updateSummary();
      });
    });
  });
}

async function loadDiapers() {
  const dateStr = toISODate(currentDate);
  const records = await api.diaper.list(dateStr);
  const list = document.getElementById('diaper-list');
  const badge = document.getElementById('diaper-badge');

  badge.textContent = records.length;
  popBadge(badge);

  if (records.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhuma troca hoje 👶</p>';
    return;
  }

  list.innerHTML = records.map(r => {
    let icon = r.has_poop ? '💩' : '💧';
    let detail = [];
    if (r.has_pee) detail.push('Xixi 💧');
    if (r.has_poop) detail.push('Cocô 💩');
    return `
      <div class="record-item" id="diaper-${r.id}">
        <span class="record-icon">${icon}</span>
        <div class="record-info">
          <div class="record-time">
            ${formatTime(r.recorded_at)}
            <button class="record-edit-btn" onclick="editDiaper(${r.id}, '${r.recorded_at}')" title="Editar horário">✏️</button>
          </div>
          <div class="record-detail">${detail.join(' + ')}</div>
        </div>
        <button class="record-delete" onclick="deleteDiaper(${r.id})" title="Remover">✕</button>
      </div>
    `;
  }).join('');
}

window.editDiaper = async (id, currentIsoStr) => {
  const currentFormatted = formatTime(currentIsoStr);
  const newTime = prompt('Alterar horário (formato HH:MM):', currentFormatted);
  if (!newTime || newTime === currentFormatted) return;

  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!regex.test(newTime)) return toast('Formato inválido! Use HH:MM', 'error');

  const updatedDateTime = new Date(currentIsoStr);
  const [hours, minutes] = newTime.split(':');
  updatedDateTime.setHours(parseInt(hours), parseInt(minutes));

  try {
    await api.diaper.update(id, { recorded_at: toLocalISOStringWithOffset(updatedDateTime) });
    toast('Horário da troca atualizado!');
    await loadDiapers();
    await updateSummary();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.deleteDiaper = async (id) => {
  if (!confirm('Remover esta troca?')) return;
  await api.diaper.delete(id);
  toast('Troca removida', 'success');
  await loadDiapers();
  await updateSummary();
};

// ════════════════════════════════════════════════════════════════════════════
//  CARD: SONO 😴
// ════════════════════════════════════════════════════════════════════════════

function setupSleepCard() {
  document.getElementById('btn-sleep-start').addEventListener('click', (e) => {
    executeOrConfirm(async (targetDate) => {
      await withLoading(e.target, async () => {
        const record = await api.sleep.start(targetDate);
        activeSleepId = record.id;
        toast('😴 Hora de nanar! Soninho iniciado.');
        updateSleepUI(true);
        await loadSleeps();
        await updateSummary();
      });
    });
  });

  document.getElementById('btn-sleep-end').addEventListener('click', async (e) => {
    if (!activeSleepId) return;
    await withLoading(e.target, async () => {
      const record = await api.sleep.end(activeSleepId);
      const dur = formatDuration(record.duration_min);
      activeSleepId = null;
      toast(`☀️ Acordou! Dormiu ${dur}.`);
      updateSleepUI(false);
      await loadSleeps();
    });
  });
}

function updateSleepUI(isActive) {
  document.getElementById('btn-sleep-start').style.display = isActive ? 'none' : 'flex';
  document.getElementById('btn-sleep-end').style.display = isActive ? 'flex' : 'none';
  const indicator = document.getElementById('sleep-active-indicator');
  indicator.classList.toggle('visible', isActive);
}

async function loadSleeps() {
  const dateStr = toISODate(currentDate);
  const records = await api.sleep.list(dateStr);
  const list = document.getElementById('sleep-list');
  const badge = document.getElementById('sleep-badge');

  badge.textContent = records.length;
  popBadge(badge);

  if (records.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhum sono registrado 😴</p>';
    return;
  }

  list.innerHTML = records.map(r => {
    const start = formatTime(r.start_time);
    const end = r.end_time ? formatTime(r.end_time) : '...';
    const dur = r.duration_min != null ? formatDuration(r.duration_min) : '⏳ em andamento';
    const icon = r.is_active ? '🌙' : '☀️';
    return `
      <div class="record-item" id="sleep-${r.id}">
        <span class="record-icon">${icon}</span>
        <div class="record-info">
          <div class="record-time">
            ${start} → ${end}
            <button class="record-edit-btn" onclick="editSleep(${r.id}, '${r.start_time}', ${r.end_time ? `'${r.end_time}'` : 'null'})" title="Editar horários">✏️</button>
          </div>
          <div class="record-detail">${dur}</div>
        </div>
        <button class="record-delete" onclick="deleteSleep(${r.id})" title="Remover">✕</button>
      </div>
    `;
  }).join('');
}

window.editSleep = async (id, startIsoStr, endIsoStr) => {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const payload = {};

  // 1. Edição do Horário de Início
  const startFormatted = formatTime(startIsoStr);
  const newStartTime = prompt('Alterar horário de INÍCIO (HH:MM):', startFormatted);

  if (newStartTime && newStartTime !== startFormatted) {
    if (!regex.test(newStartTime)) return toast('Formato inválido para início!', 'error');
    const updatedStart = new Date(startIsoStr);
    const [h, m] = newStartTime.split(':');
    updatedStart.setHours(parseInt(h), parseInt(m));
    payload.start_time = toLocalISOStringWithOffset(updatedStart);
  }

  // 2. Edição do Horário de Fim (Se houver)
  if (endIsoStr) {
    const endFormatted = formatTime(endIsoStr);
    const newEndTime = prompt('Alterar horário de TÉRMINO (HH:MM):', endFormatted);

    if (newEndTime && newEndTime !== endFormatted) {
      if (!regex.test(newEndTime)) return toast('Formato inválido para término!', 'error');
      const updatedEnd = new Date(endIsoStr);
      const [h, m] = newEndTime.split(':');
      updatedEnd.setHours(parseInt(h), parseInt(m));
      payload.end_time = toLocalISOStringWithOffset(updatedEnd);
    }
  }

  if (Object.keys(payload).length === 0) return;

  try {
    await api.sleep.update(id, payload);
    toast('Horários do sono atualizados!');
    await loadSleeps();
    await updateSummary();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.deleteSleep = async (id) => {
  if (!confirm('Remover este sono?')) return;
  await api.sleep.delete(id);
  if (activeSleepId === id) {
    activeSleepId = null;
    updateSleepUI(false);
  }
  toast('Sono removido', 'success');
  await loadSleeps();
  await updateSummary();
};

// ════════════════════════════════════════════════════════════════════════════
//  CARD: BANHO 🛁
// ════════════════════════════════════════════════════════════════════════════

function setupBathCard() {
  document.getElementById('btn-bath').addEventListener('click', (e) => {
    executeOrConfirm(async (targetDate) => {
      await withLoading(e.target, async () => {
        await api.bath.create(targetDate);
        toast('🛁 Banho registrado!');
        await loadBaths();
        await updateSummary();
      });
    });
  });
}

async function loadBaths() {
  const dateStr = toISODate(currentDate);
  const records = await api.bath.list(dateStr);
  const list = document.getElementById('bath-list');
  const badge = document.getElementById('bath-badge');

  badge.textContent = records.length;
  popBadge(badge);

  if (records.length === 0) {
    list.innerHTML = '<p class="empty-state">Nenhum banho hoje 🛁</p>';
    return;
  }

  list.innerHTML = records.map(r => `
    <div class="record-item" id="bath-${r.id}">
      <span class="record-icon">🛁</span>
      <div class="record-info">
        <div class="record-time">
          ${formatTime(r.recorded_at)}
          <button class="record-edit-btn" onclick="editBath(${r.id}, '${r.recorded_at}')" title="Editar horário">✏️</button>
        </div>
        <div class="record-detail">Banho registrado</div>
      </div>
      <button class="record-delete" onclick="deleteBath(${r.id})" title="Remover">✕</button>
    </div>
  `).join('');
}

window.editBath = async (id, currentIsoStr) => {
  const currentFormatted = formatTime(currentIsoStr);
  const newTime = prompt('Alterar horário do banho (formato HH:MM):', currentFormatted);
  if (!newTime || newTime === currentFormatted) return;

  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!regex.test(newTime)) return toast('Formato inválido! Use HH:MM', 'error');

  const updatedDateTime = new Date(currentIsoStr);
  const [hours, minutes] = newTime.split(':');
  updatedDateTime.setHours(parseInt(hours), parseInt(minutes));

  try {
    await api.bath.update(id, { recorded_at: toLocalISOStringWithOffset(updatedDateTime) });
    toast('Horário do banho atualizado!');
    await loadBaths();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.deleteBath = async (id) => {
  if (!confirm('Remover este banho?')) return;
  await api.bath.delete(id);
  toast('Banho removido', 'success');
  await loadBaths();
};

// ════════════════════════════════════════════════════════════════════════════
//  RESUMO DO DIA
// ════════════════════════════════════════════════════════════════════════════

async function updateSummary() {
  try {
    const s = await api.summary(toISODate(currentDate));
    document.getElementById('sum-ml-offered').textContent = `${s.total_ml_offered}ml`;
    document.getElementById('sum-ml-consumed').textContent = `${s.total_ml_consumed}ml`;
    
    let percentStr = '0%';
    if (s.total_ml_offered > 0) {
      percentStr = Math.round((s.total_ml_consumed / s.total_ml_offered) * 100) + '%';
    }
    document.getElementById('sum-ml-percent').textContent = percentStr;
    
    const bottleFeedings = s.feedings.filter(f => f.feeding_type === 'bottle' && f.ml_offered > 0);
    if (bottleFeedings.length > 0) {
      const avg = bottleFeedings.reduce((acc, f) => acc + (f.ml_consumed || 0) / f.ml_offered, 0) / bottleFeedings.length;
      document.getElementById('sum-ml-avg-percent').textContent = Math.round(avg * 100) + '%';
      document.getElementById('sum-ml-avg-percent-box').style.display = 'block';
    } else {
      document.getElementById('sum-ml-avg-percent-box').style.display = 'none';
    }

    document.getElementById('sum-breast').textContent = s.total_breast_feedings;
    document.getElementById('sum-diapers').textContent = s.total_diaper_changes;
    document.getElementById('sum-sleep').textContent = formatDuration(s.total_sleep_min);
    document.getElementById('sum-awake-total').textContent = formatDuration(s.total_awake_min);
    
    const awakeBox = document.getElementById('summary-awake-current-box');
    if (s.current_awake_time_min != null && s.current_awake_time_min > 0) {
      awakeBox.style.display = 'block';
      document.getElementById('sum-awake-current').textContent = formatDuration(s.current_awake_time_min);
    } else {
      awakeBox.style.display = 'none';
    }
    
    const fastingBox = document.getElementById('summary-fasting-current-box');
    if (s.current_fasting_time_min != null && s.current_fasting_time_min > 0) {
      fastingBox.style.display = 'block';
      document.getElementById('sum-fasting-current').textContent = formatDuration(s.current_fasting_time_min);
    } else {
      fastingBox.style.display = 'none';
    }
  } catch {
    // silencia erros de summary (não crítico)
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  LOAD ALL
// ════════════════════════════════════════════════════════════════════════════

async function loadAll() {
  await Promise.all([
    loadFeeding(),
    loadDiapers(),
    loadSleeps(),
    loadBaths(),
    updateSummary(),
  ]);

  // Verifica sono ativo
  const active = await api.sleep.active();
  if (active && active.id) {
    activeSleepId = active.id;
    updateSleepUI(true);
  } else {
    activeSleepId = null;
    updateSleepUI(false);
  }

  // Verifica peito ativo
  const activeBreast = await api.feeding.active();
  if (activeBreast && activeBreast.id) {
    activeBreastId = activeBreast.id;
    updateBreastUI(true, activeBreast.breast_side);
  } else {
    activeBreastId = null;
    updateBreastUI(false);
  }
}

function setupToggleButtons() {
  document.querySelectorAll('.toggle-records-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = btn.getAttribute('data-target');
      const targetList = document.getElementById(targetId);
      if (targetList.style.display === 'none') {
        targetList.style.display = 'flex';
        btn.textContent = '▼';
        btn.style.opacity = '1';
      } else {
        targetList.style.display = 'none';
        btn.textContent = '◀';
        btn.style.opacity = '0.5';
      }
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  RELATÓRIOS 📊
// ════════════════════════════════════════════════════════════════════════════

let rawReports = [];

async function loadReports() {
  const tbody = document.getElementById('reports-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Carregando relatórios...</td></tr>';
  try {
    rawReports = await api.reports.history();
    renderReports();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Erro: ${err.message}</td></tr>`;
  }
}

let sleepChartInstance = null;
let milkChartInstance = null;

function renderCharts(data) {
  const ctxSleep = document.getElementById('sleepChart');
  const ctxMilk = document.getElementById('milkChart');
  if (!ctxSleep || !ctxMilk) return;

  if (sleepChartInstance) sleepChartInstance.destroy();
  if (milkChartInstance) milkChartInstance.destroy();

  const chartData = [...data].reverse();
  const labels = chartData.map(d => d.label);

  sleepChartInstance = new Chart(ctxSleep, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Horas Acordado',
          data: chartData.map(d => parseFloat((d.total_awake_min / 60).toFixed(1))),
          backgroundColor: '#fbcfe8'
        },
        {
          label: 'Horas de Sono',
          data: chartData.map(d => parseFloat((d.total_sleep_min / 60).toFixed(1))),
          backgroundColor: '#a78bfa'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      },
      plugins: {
        datalabels: {
          color: '#333',
          font: { weight: 'bold' },
          formatter: (value) => value > 0 ? value + 'h' : ''
        }
      }
    }
  });

  milkChartInstance = new Chart(ctxMilk, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Consumido (ml)',
          data: chartData.map(d => d.total_ml_consumed),
          backgroundColor: '#db2777'
        },
        {
          label: 'Não consumido (ml)',
          data: chartData.map(d => {
            const diff = d.total_ml_offered - d.total_ml_consumed;
            return diff > 0 ? diff : 0;
          }),
          backgroundColor: '#e5e7eb'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      },
      plugins: {
        datalabels: {
          color: (context) => context.datasetIndex === 1 ? '#666' : '#fff',
          font: { weight: 'bold', size: 11 },
          formatter: (value, context) => {
            if (value <= 0) return '';
            const consumed = context.chart.data.datasets[0].data[context.dataIndex];
            const notConsumed = context.chart.data.datasets[1].data[context.dataIndex];
            const offered = consumed + notConsumed;
            if (context.datasetIndex === 0) { 
              const pct = offered > 0 ? Math.round((consumed / offered) * 100) : 0;
              return `${consumed}ml (${pct}%)`;
            } else {
              return `${value}ml`;
            }
          }
        }
      }
    }
  });
}

function renderReports() {
  const tablePeriod = document.getElementById('report-period').value;
  const chartPeriod = document.getElementById('chart-period').value;
  const tbody = document.getElementById('reports-tbody');

  if (rawReports.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="empty-state">Nenhum registro encontrado.</td></tr>';
    return;
  }

  let aggregated = rawReports.map(r => ({
    label: new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    ...r
  }));

  let chartAggregated = [...aggregated];
  if (chartPeriod === '7') chartAggregated = chartAggregated.slice(0, 7);
  else if (chartPeriod === '15') chartAggregated = chartAggregated.slice(0, 15);
  else if (chartPeriod === '30') chartAggregated = chartAggregated.slice(0, 30);

  let tableAggregated = [...aggregated];
  if (tablePeriod === '7') tableAggregated = tableAggregated.slice(0, 7);
  else if (tablePeriod === '30') tableAggregated = tableAggregated.slice(0, 30);

  renderCharts(chartAggregated);

  tbody.innerHTML = tableAggregated.map(r => {
    let diff = '0%';
    let pct = 0;
    if (r.total_ml_offered > 0) {
      pct = Math.round((r.total_ml_consumed / r.total_ml_offered) * 100);
      diff = pct + '%';
    }
    
    const alertStyle = (r.total_ml_offered > 0 && pct < 70) ? 'color: #dc2626; font-weight: bold; background: #fef2f2;' : '';

    return `
    <tr>
      <td>${r.label}</td>
      <td>${formatDuration(r.total_awake_min)}</td>
      <td>${formatDuration(r.total_sleep_min)}</td>
      <td>${formatDuration(r.avg_sleep_min)}</td>
      <td>${r.feedings_count}</td>
      <td>${r.total_breast_feedings}</td>
      <td>${r.total_ml_offered}</td>
      <td style="${alertStyle}">${r.total_ml_consumed}</td>
      <td style="${alertStyle}">${diff}</td>
      <td>${formatDuration(r.max_fasting_min)}</td>
      <td>${r.total_diaper_changes}</td>
      <td>${r.total_baths}</td>
    </tr>
  `}).join('');
}

// ════════════════════════════════════════════════════════════════════════════
//  TABS E NAVEGAÇÃO
// ════════════════════════════════════════════════════════════════════════════

function setupTabs() {
  const tabDaily = document.getElementById('tab-daily');
  const tabReports = document.getElementById('tab-reports');
  const viewDaily = document.getElementById('view-daily');
  const viewReports = document.getElementById('view-reports');

  tabDaily.addEventListener('click', () => {
    tabDaily.classList.add('active');
    tabDaily.setAttribute('aria-selected', 'true');
    tabReports.classList.remove('active');
    tabReports.setAttribute('aria-selected', 'false');
    viewDaily.classList.add('active');
    viewReports.classList.remove('active');
    document.querySelector('.app-header').style.display = 'block';
  });

  tabReports.addEventListener('click', () => {
    tabReports.classList.add('active');
    tabReports.setAttribute('aria-selected', 'true');
    tabDaily.classList.remove('active');
    tabDaily.setAttribute('aria-selected', 'false');
    viewReports.classList.add('active');
    viewDaily.classList.remove('active');
    document.querySelector('.app-header').style.display = 'none';
    loadReports();
  });

  document.getElementById('report-period').addEventListener('change', renderReports);
  document.getElementById('chart-period').addEventListener('change', renderReports);
}


// ════════════════════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  updateDateLabel();
  setupTabs();
  setupToggleButtons();
  setupRetroactiveDrawer();

  // Navegação de datas
  document.getElementById('btn-prev-day').addEventListener('click', () => navigate(-1));
  document.getElementById('btn-next-day').addEventListener('click', () => navigate(1));

  // Date picker nativo via click no label
  const picker = document.getElementById('date-picker-input');
  document.getElementById('current-date-label').addEventListener('click', () => {
    picker.value = toISODate(currentDate);
    picker.showPicker?.();
    picker.click();
  });
  picker.addEventListener('change', (e) => {
    if (e.target.value) {
      currentDate = new Date(e.target.value + 'T12:00:00');
      updateDateLabel();
      loadAll();
    }
  });

  // Setup dos cards
  setupFeedingCard();
  setupDiaperCard();
  setupSleepCard();
  setupBathCard();

  // Carrega dados do dia
  await loadAll();
});