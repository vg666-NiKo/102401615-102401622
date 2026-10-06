/* 无 DOM 的业务规则，可在 Node.js 测试中复用。 */
(function (root) {
  'use strict';
  const categories = ['证件', '电子用品', '生活用品', '书籍文具', '其他'];
  function filterItems(items, type) {
    return items.filter(function (item) {
      return type === 'all' || item.type === type;
    }).sort(function (a, b) {
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }
  /* 首页只展示最新的若干条，避免信息堆积后列表过长。 */
  const homeLimit = 30;
  function homeItems(items, type) {
    const sorted = filterItems(items, type);
    return { items: sorted.slice(0, homeLimit), total: sorted.length, limit: homeLimit };
  }
  function statusLabel(item) {
    if (item.status === 'completed') return item.type === 'lost' ? '已找回' : '已归还';
    return item.type === 'lost' ? '待寻找' : '待认领';
  }
  function normalizeInput(input) {
    const result = {};
    ['type', 'title', 'category', 'place', 'eventTime', 'description', 'contact'].forEach(function (key) {
      result[key] = typeof input[key] === 'string' ? input[key].trim() : '';
    });
    return result;
  }
  function validLocalTime(text) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return false;
    const d = new Date(text);
    if (!Number.isFinite(d.getTime())) return false;
    return formatLocalTime(d).replace(' ', 'T') === text;
  }
  function formatLocalTime(date) {
    const pad = n => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }
  function validatePost(input) {
    const data = normalizeInput(input);
    const errors = {};
    if (!['lost', 'found'].includes(data.type)) errors.type = '请选择寻物或招领。';
    if (!categories.includes(data.category)) errors.category = '请选择有效的物品类别。';
    [['title', '物品名称', 40], ['place', '地点', 80], ['contact', '联系方式', 100]].forEach(function (field) {
      if (!data[field[0]]) errors[field[0]] = '请填写' + field[1] + '。';
      else if (data[field[0]].length > field[2]) errors[field[0]] = field[1] + '不能超过 ' + field[2] + ' 字。';
    });
    if (data.description.length > 500) errors.description = '详细描述不能超过 500 字。';
    if (data.eventTime && !validLocalTime(data.eventTime)) errors.eventTime = '请填写有效的日期与时间。';
    return { data: data, errors: errors, valid: Object.keys(errors).length === 0 };
  }
  function createPost(input, id, now) {
    const checked = validatePost(input);
    if (!checked.valid) throw new Error(Object.values(checked.errors)[0]);
    if (!id || typeof id !== 'string') throw new Error('无法生成信息编号。');
    const d = new Date(now);
    if (!Number.isFinite(d.getTime())) throw new Error('发布时间无效。');
    return Object.assign({}, checked.data, {
      id: id, createdAt: d.toISOString(), eventTime: checked.data.eventTime.replace('T', ' ') || formatLocalTime(d),
      owner: '我', isMine: true, status: 'active', image: ''
    });
  }
  function searchItems(items, options) {
    const opts = options || {};
    const type = opts.type || 'all';
    const category = opts.category || 'all';
    const words = String(opts.keyword || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return filterItems(items, type).filter(function (item) {
      if (category !== 'all' && item.category !== category) return false;
      if (opts.activeOnly && item.status !== 'active') return false;
      const haystack = [item.title, item.place, item.category, item.description].join(' ').toLocaleLowerCase();
      return words.every(word => haystack.includes(word));
    });
  }
  function findItem(items, id) {
    return items.find(item => item.id === id) || null;
  }
  function myItems(items, status) {
    return filterItems(items, 'all').filter(item => item.isMine && (!status || status === 'all' || item.status === status));
  }
  function mySummary(items) {
    const mine = myItems(items, 'all');
    return { total: mine.length,
      lostActive: mine.filter(item => item.type === 'lost' && item.status === 'active').length,
      foundActive: mine.filter(item => item.type === 'found' && item.status === 'active').length,
      completed: mine.filter(item => item.status === 'completed').length };
  }
  function changeStatus(items, id, status) {
    const item = findItem(items, id);
    if (!item) throw new Error('这条信息已不存在。');
    if (!item.isMine) throw new Error('只能修改自己的发布。');
    if (!['active', 'completed'].includes(status)) throw new Error('状态无效。');
    return items.map(current => current.id === id ? Object.assign({}, current, {status}) : current);
  }
  function editableItem(items, id) {
    const item = findItem(items, id);
    if (!item) throw new Error('这条信息已不存在。');
    if (!item.isMine) throw new Error('只能管理自己的发布。');
    return item;
  }
  function editPost(items, id, input) {
    const original = editableItem(items, id);
    const checked = validatePost(input);
    if (!checked.valid) throw new Error(Object.values(checked.errors)[0]);
    const updated = Object.assign({}, original, checked.data, {
      eventTime: checked.data.eventTime.replace('T', ' ') || original.eventTime
    });
    return items.map(item => item.id === id ? updated : item);
  }
  function deletePost(items, id) {
    editableItem(items, id);
    return items.filter(item => item.id !== id);
  }
  const api = { categories, homeLimit, homeItems, filterItems, statusLabel, normalizeInput, validatePost, createPost, searchItems, findItem, myItems, mySummary, changeStatus, editPost, deletePost };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LostFoundCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
