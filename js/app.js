(function () {
  'use strict';
  const core = window.LostFoundCore;
  let browserStorage;
  try { browserStorage = window.localStorage; } catch (_) { browserStorage = null; }
  const store = window.LostFoundStorage.createStore(browserStorage);
  const loaded = store.load(window.LostFoundDemo);
  let items = loaded.items;
  if (loaded.warning) {
    const warning = document.getElementById('storage-warning');
    warning.textContent = loaded.warning;
    warning.hidden = false;
    document.getElementById('publish-submit').disabled = true;
  }
  const icons = { '证件': '🪪', '电子用品': '🎧', '生活用品': '☂️', '书籍文具': '📚', '其他': '📦' };
  let homeFilter = 'all';
  let detailFrom = 'home';
  let editingId = null;
  let publishDraft = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function createCard(item, from) {
    const card = element('a', 'item-card');
    card.href = '#detail-' + encodeURIComponent(item.id);
    card.setAttribute('aria-label', '查看' + item.title + '的详情，' + core.statusLabel(item));
    card.addEventListener('click', function (event) {
      event.preventDefault();
      detailFrom = from || 'home';
      detailPage.render(item.id);
      navigate('detail');
    });
    const info = element('div', 'item-info');
    const badges = element('div', 'badges');
    badges.append(element('span', 'badge ' + item.type, item.type === 'lost' ? '寻物' : '招领'));
    badges.append(element('span', 'badge ' + (item.status === 'completed' ? 'done' : 'status'), core.statusLabel(item)));
    info.append(badges, element('h3', 'item-title', item.title),
      element('p', 'item-meta', item.place + ' · ' + item.eventTime),
      element('p', 'item-owner', (item.type === 'lost' ? '失主：' : '拾得者：') + item.owner));
    const thumb = element('div', 'item-thumb ' + item.type, icons[item.category] || '📦');
    thumb.setAttribute('aria-hidden', 'true');
    window.LostFoundImages.renderPhoto(thumb,item.image,item.title + '照片');
    card.append(info, thumb);
    return card;
  }
  function renderHome() {
    const shown = core.homeItems(items, homeFilter);
    const list = document.getElementById('home-list');
    list.replaceChildren();
    const clipped = shown.total > shown.limit;
    document.getElementById('result-count').textContent = clipped
      ? '共 ' + shown.total + ' 条，显示最新 ' + shown.items.length + ' 条'
      : '共 ' + shown.total + ' 条';
    const hint = document.getElementById('home-limit-hint');
    hint.textContent = clipped
      ? '首页只显示最新 ' + shown.limit + ' 条，其余 ' + (shown.total - shown.items.length) + ' 条请用「搜索」查找。'
      : '';
    hint.hidden = !clipped;
    if (!shown.items.length) list.append(element('p', 'empty-state', '暂无相关信息'));
    else shown.items.forEach(function (item) { list.append(createCard(item)); });
  }
  function navigate(page) {
    if (!['home', 'search', 'publish', 'mine', 'detail'].includes(page)) return;
    if (editingId && page !== 'publish') {
      if (!window.confirm('离开将放弃本次编辑，确认离开？')) return;
      finishEditing();
    }
    document.querySelectorAll('.page').forEach(function (section) { section.hidden = section.id !== page + '-page'; });
    document.querySelectorAll('.nav-item').forEach(function (button) {
      const active = button.dataset.page === (page === 'detail' ? detailFrom : page);
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.getElementById('feedback').hidden = true;
    if (page === 'home') renderHome();
    if (page === 'search') searchPage.render();
    if (page === 'mine') minePage.render();
    document.getElementById('main-content').focus({ preventScroll: true });
  }
  function saveItems(nextItems) {
    const result = store.save(nextItems);
    if (result.ok) items = nextItems;
    return result;
  }
  const minePage = window.LostFoundMyPosts.create({ core, getItems: () => items, createCard, element, saveItems, writable: loaded.writable, startEditing });
  const searchPage = window.LostFoundSearch.create({ core, getItems: () => items, createCard, element });
  const detailPage = window.LostFoundDetail.create({ core, getItems: () => items, icons, element, createCard, getDetailFrom: () => detailFrom });
  document.getElementById('detail-back').addEventListener('click', function () { navigate(detailFrom); });
  document.querySelectorAll('[data-page]').forEach(function (button) {
    button.addEventListener('click', function () { navigate(button.dataset.page); });
  });
  document.querySelectorAll('[data-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      homeFilter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(function (filter) {
        const active = filter === button;
        filter.classList.toggle('active', active);
        filter.setAttribute('aria-pressed', String(active));
      });
      renderHome();
    });
  });
  const form = document.getElementById('publish-form');
  function showErrors(errors) {
    ['title', 'place', 'eventTime', 'description', 'contact'].forEach(function (key) {
      const field = document.getElementById('f-' + key);
      const message = document.getElementById('error-' + key);
      message.textContent = errors[key] || '';
      message.hidden = !errors[key];
      field.setAttribute('aria-invalid', String(Boolean(errors[key])));
      if (errors[key]) field.setAttribute('aria-describedby', message.id);
      else field.removeAttribute('aria-describedby');
    });
  }
  const imageSelection = window.LostFoundImages.createSelection(window.LostFoundImages.compressFile, function (state) {
    const preview = document.getElementById('image-preview');
    preview.replaceChildren();
    preview.hidden = !state.image;
    if (state.image) window.LostFoundImages.renderPhoto(preview,state.image,'待保存的物品照片');
    document.getElementById('image-remove').hidden = !state.image && !state.busy;
    document.getElementById('image-feedback').textContent = state.busy ? '正在处理照片，请稍候…' : (state.error ? state.error + ' 原照片保持不变。' : (state.image ? '照片已准备好，点击发布或保存修改后生效。' : ''));
    document.getElementById('publish-submit').disabled = !loaded.writable || state.busy;
  });
  document.getElementById('f-image').addEventListener('change',function (event) {
    const file = event.target.files[0];
    if (file) imageSelection.select(file);
    event.target.value = '';
  });
  document.getElementById('image-remove').addEventListener('click',function () { imageSelection.set(''); });
  function formValues() { return Object.assign(Object.fromEntries(new FormData(form)),{image: imageSelection.getState().image}); }
  function fillForm(values) {
    imageSelection.set(values.image || '');
    document.getElementById('f-image').value = '';
    ['type', 'title', 'category', 'place', 'eventTime', 'description', 'contact'].forEach(function (key) {
      form.elements.namedItem(key).value = values[key] || '';
    });
  }
  function editLabels(active) {
    document.getElementById('publish-title').textContent = active ? '编辑我的发布' : '发布信息';
    document.getElementById('publish-submit').textContent = active ? '保存修改' : '发布信息';
    document.getElementById('event-time-hint').textContent = active ? '不填则保留原来的丢失／捡到时间。' : '不填则使用发布时刻。';
    document.getElementById('edit-cancel').hidden = !active;
    showErrors({});
    document.getElementById('publish-error').hidden = true;
  }
  function finishEditing() {
    editingId = null;
    if (publishDraft) fillForm(publishDraft);
    publishDraft = null;
    editLabels(false);
  }
  function startEditing(id) {
    const item = core.findItem(items, id);
    if (!loaded.writable || !item || !item.isMine) return;
    publishDraft = formValues();
    editingId = id;
    fillForm(Object.assign({}, item, {eventTime: item.eventTime.replace(' ', 'T')}));
    editLabels(true);
    navigate('publish');
    document.getElementById('f-title').focus();
  }
  document.getElementById('edit-cancel').addEventListener('click', function () {
    if (!window.confirm('确认放弃本次编辑？原信息不会改变。')) return;
    finishEditing();
    navigate('mine');
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (imageSelection.getState().busy) return;
    const input = formValues();
    const checked = core.validatePost(input);
    showErrors(checked.errors);
    const failure = document.getElementById('publish-error');
    failure.hidden = true;
    if (!checked.valid) {
      failure.textContent = (editingId ? '修改未完成：' : '发布未完成：') + Object.values(checked.errors)[0];
      failure.hidden = false;
      const first = form.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    const submit = document.getElementById('publish-submit');
    submit.disabled = true;
    try {
      const wasEditing = Boolean(editingId);
      if (wasEditing) {
        const result = saveItems(window.LostFoundImages.applyImage(core.editPost(items, editingId, checked.data),editingId,input.image));
        if (!result.ok) throw new Error(result.error);
        finishEditing();
        navigate('mine');
        const feedback = document.getElementById('mine-feedback');
        feedback.className = 'notice success-notice';
        feedback.textContent = '修改已保存，发布编号和完成状态保持不变。';
        feedback.hidden = false;
        return;
      }
      let id;
      do {
        id = window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : 'post-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      } while (items.some(item => item.id === id));
      const post = core.createPost(checked.data, id, new Date());
      const nextItems = window.LostFoundImages.applyImage([post].concat(items),post.id,input.image);
      const result = saveItems(nextItems);
      if (!result.ok) throw new Error(result.error);
      form.reset();
      imageSelection.set('');
      homeFilter = 'all';
      document.querySelectorAll('[data-filter]').forEach(function (button) {
        const active = button.dataset.filter === 'all';
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      navigate('home');
      const feedback = document.getElementById('feedback');
      feedback.textContent = '发布成功！信息已保存在当前浏览器，并展示在首页。';
      feedback.hidden = false;
    } catch (error) {
      failure.textContent = error.message || '发布失败，请稍后重试。';
      failure.hidden = false;
    } finally {
      submit.disabled = !loaded.writable || imageSelection.getState().busy;
    }
  });
  renderHome();
})();
