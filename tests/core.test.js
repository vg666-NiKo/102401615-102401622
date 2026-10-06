const test = require('node:test');
const assert = require('node:assert/strict');
const { filterItems, homeItems, homeLimit, statusLabel } = require('../js/core.js');
const items = [
  { id: 'older', type: 'lost', createdAt: '2026-09-20T10:00:00+08:00', status: 'active' },
  { id: 'newer', type: 'found', createdAt: '2026-09-22T10:00:00+08:00', status: 'active' },
  { id: 'middle', type: 'lost', createdAt: '2026-09-21T10:00:00+08:00', status: 'completed' }
];
test('全部信息按发布时间倒序展示', () => {
  assert.deepEqual(filterItems(items, 'all').map(x => x.id), ['newer', 'middle', 'older']);
});
test('寻物筛选排除招领信息并保留已找回信息', () => {
  assert.deepEqual(filterItems(items, 'lost').map(x => x.id), ['middle', 'older']);
});
test('招领筛选排除寻物信息', () => {
  assert.deepEqual(filterItems(items, 'found').map(x => x.id), ['newer']);
});
test('空列表及无匹配类型返回空结果', () => {
  assert.deepEqual(filterItems([], 'all'), []);
  assert.deepEqual(filterItems([items[0]], 'found'), []);
});
test('筛选和排序不改变原始列表', () => {
  const snapshot = structuredClone(items);
  filterItems(items, 'all');
  assert.deepEqual(items, snapshot);
});
test('寻物与招领的进行中、完成状态文案分别正确', () => {
  assert.equal(statusLabel({type: 'lost', status: 'active'}), '待寻找');
  assert.equal(statusLabel({type: 'found', status: 'active'}), '待认领');
  assert.equal(statusLabel({type: 'lost', status: 'completed'}), '已找回');
  assert.equal(statusLabel({type: 'found', status: 'completed'}), '已归还');
});
function manyItems(count, type) {
  return Array.from({length: count}, (_, index) => ({
    id: 'item-' + index,
    type: type || 'lost',
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
    status: 'active'
  }));
}
test('首页上限为 30 条，超出时只保留最新 30 条', () => {
  const list = manyItems(35);
  const shown = homeItems(list, 'all');
  assert.equal(homeLimit, 30);
  assert.equal(shown.limit, 30);
  assert.equal(shown.total, 35);
  assert.equal(shown.items.length, 30);
  assert.deepEqual(shown.items.map(x => x.id), list.slice().reverse().slice(0, 30).map(x => x.id));
});
test('首页信息不足 30 条时全部显示', () => {
  const shown = homeItems(manyItems(3), 'all');
  assert.equal(shown.total, 3);
  assert.equal(shown.items.length, 3);
  const empty = homeItems([], 'all');
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.items, []);
});
test('首页数量正好 30 条时不产生截断', () => {
  const shown = homeItems(manyItems(30), 'all');
  assert.equal(shown.total, 30);
  assert.equal(shown.items.length, 30);
});
test('首页类型筛选后同样只保留最新 30 条，并统计筛选后总数', () => {
  const list = manyItems(40, 'lost').concat(manyItems(40, 'found'));
  const shown = homeItems(list, 'found');
  assert.equal(shown.total, 40);
  assert.equal(shown.items.length, 30);
  assert.ok(shown.items.every(x => x.type === 'found'));
});
test('首页截断不改变原始列表', () => {
  const list = manyItems(35);
  const snapshot = structuredClone(list);
  homeItems(list, 'all');
  assert.deepEqual(list, snapshot);
});
