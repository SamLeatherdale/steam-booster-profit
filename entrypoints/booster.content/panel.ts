import { formatLike, formatSignedLike } from '../../lib/prices';
import { filterAffordable, sortRows } from '../../lib/rank';
import type { RankedPack, SortKey } from '../../lib/types';

const SIZE_KEY = 'steam-booster-profit-size';

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: 'name', label: 'Name', className: 'name' },
  { key: 'gems', label: 'Gems', className: 'gems' },
  { key: 'buyOrder', label: 'Buy order', className: 'buy' },
  { key: 'receive', label: 'You receive', className: 'receive' },
  { key: 'list', label: 'List price', className: 'list' },
  { key: 'perGem', label: 'Per 1,000 gems', className: 'per' },
  { key: 'versusSack', label: 'Vs selling gems', className: 'versus' },
  { key: 'volume', label: 'Sold 24h', className: 'volume' },
];

export interface PanelController {
  setStatus(status: string): void;
  setRows(rows: RankedPack[]): void;
  setGoo(goo: number): void;
}

export function mountPanel(
  container: HTMLElement,
  host: HTMLElement,
  options: {
    onSelect: (appid: number) => void;
    onClose: () => void;
  },
): PanelController {
  container.style.display = 'block';
  container.style.height = '100%';

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.innerHTML = `
    <header>
      <h1>Profit ranking</h1>
      <p class="meta"></p>
      <p class="status"></p>
      <div class="controls">
        <label><input class="affordable" type="checkbox" checked> Affordable now</label>
        <button class="ghost close" type="button">Close</button>
      </div>
    </header>
    <div class="table-wrap"></div>
    <div class="resize" title="Drag to resize"></div>
  `;
  container.append(panel);
  restoreSize(host);
  const handle = panel.querySelector<HTMLElement>('.resize');
  if (handle) watchResize(host, handle);

  const meta = panel.querySelector('.meta');
  const status = panel.querySelector('.status');
  const tableWrap = panel.querySelector('.table-wrap');
  const affordable = panel.querySelector<HTMLInputElement>('.affordable');
  const close = panel.querySelector<HTMLButtonElement>('.close');
  if (!meta || !status || !tableWrap || !affordable || !close) {
    throw new Error('Booster profit panel failed to render');
  }

  let rows: RankedPack[] = [];
  let goo = 0;
  let sortKey: SortKey = 'perGem';
  let direction: 1 | -1 = -1;

  const render = (): void => {
    meta.textContent = `${goo.toLocaleString('en-AU')} gems`;
    tableWrap.replaceChildren();

    const visible = sortRows(filterAffordable(rows, goo, affordable.checked), sortKey, direction);
    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = affordable.checked
        ? 'No craftable pack costs this many gems or less.'
        : 'No booster packs are available to craft.';
      tableWrap.append(empty);
      return;
    }

    const sample = visible.find((row) => row.listLabel || row.buyOrderLabel)?.listLabel
      ?? visible.find((row) => row.buyOrderLabel)?.buyOrderLabel
      ?? null;
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const column of COLUMNS) {
      const cell = document.createElement('th');
      cell.className = column.className;
      const marker = sortKey === column.key ? (direction < 0 ? ' ↓' : ' ↑') : '';
      cell.textContent = `${column.label}${marker}`;
      cell.addEventListener('click', () => {
        if (sortKey === column.key) direction = direction === 1 ? -1 : 1;
        else {
          sortKey = column.key;
          direction = column.key === 'name' ? 1 : -1;
        }
        render();
      });
      headRow.append(cell);
    }
    const marketHead = document.createElement('th');
    marketHead.className = 'market';
    marketHead.textContent = 'Market';
    headRow.append(marketHead);
    thead.append(headRow);

    const tbody = document.createElement('tbody');
    const selected = selectedAppId();
    for (const row of visible) {
      const tr = document.createElement('tr');
      if (row.unavailable) tr.classList.add('cooldown');
      if (row.appid === selected) tr.classList.add('active');
      tr.title = row.unavailable && row.availableAtTime ? `Available ${row.availableAtTime}` : row.name;
      tr.append(
        textCell(row.name, 'name'),
        textCell(String(row.gems), 'gems'),
        textCell(money(row.buyOrderCents, row.buyOrderLabel, sample), 'buy'),
        textCell(receiveText(row, sample), 'receive'),
        textCell(money(row.listCents, row.listLabel, sample), 'list'),
        textCell(perThousand(row, sample), 'per'),
        comparisonCell(row, sample),
        textCell(row.volume == null ? '—' : row.volume.toLocaleString('en-AU'), 'volume'),
        linkCell(row),
      );
      tr.addEventListener('click', () => options.onSelect(row.appid));
      tbody.append(tr);
    }
    table.append(thead, tbody);
    tableWrap.append(table);
  };

  affordable.addEventListener('change', render);
  close.addEventListener('click', options.onClose);
  window.addEventListener('hashchange', render);

  return {
    setStatus(next: string) {
      status.textContent = next;
    },
    setRows(next: RankedPack[]) {
      rows = next;
      render();
    },
    setGoo(next: number) {
      goo = next;
      render();
    },
  };
}

function selectedAppId(): number | null {
  const match = /^#(\d+)$/.exec(location.hash);
  return match?.[1] ? Number(match[1]) : null;
}

function textCell(value: string, className?: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = value;
  return cell;
}

function money(cents: number | null, label: string | null, sample: string | null): string {
  if (label) return label;
  if (cents == null) return '—';
  return formatLike(cents, sample);
}

function receiveText(row: RankedPack, sample: string | null): string {
  if (row.receiveCents == null) return row.missing ? 'No listing' : '—';
  const text = formatLike(row.receiveCents, row.buyOrderLabel ?? row.listLabel ?? sample);
  return row.estimatedReceive ? `${text} est.` : text;
}

function perThousand(row: RankedPack, sample: string | null): string {
  if (row.receiveCents == null || row.gems <= 0) return '—';
  return formatLike(Math.round((row.receiveCents * 1000) / row.gems), sample);
}

function comparisonCell(row: RankedPack, sample: string | null): HTMLTableCellElement {
  const cell = textCell(
    row.versusSackCents == null ? '—' : formatSignedLike(row.versusSackCents, sample),
    'versus',
  );
  if (row.versusSackCents != null) cell.classList.add(row.versusSackCents > 0 ? 'good' : 'bad');
  return cell;
}

function linkCell(row: RankedPack): HTMLTableCellElement {
  const cell = document.createElement('td');
  const link = document.createElement('a');
  link.href = `https://steamcommunity.com/market/listings/753/${encodeURIComponent(row.marketHashName)}`;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = 'Open';
  link.addEventListener('click', (event) => event.stopPropagation());
  cell.className = 'market';
  cell.append(link);
  return cell;
}

function restoreSize(host: HTMLElement): void {
  const raw = sessionStorage.getItem(SIZE_KEY);
  if (!raw) return;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return;
    const size = saved as { width?: unknown; height?: unknown };
    if (typeof size.width === 'number' && size.width >= 640) {
      host.style.setProperty('width', `${size.width}px`, 'important');
    }
    if (typeof size.height === 'number' && size.height >= 320) {
      host.style.setProperty('height', `${size.height}px`, 'important');
    }
  } catch {
    sessionStorage.removeItem(SIZE_KEY);
  }
}

function watchResize(host: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = host.getBoundingClientRect();
    const maxWidth = () => Math.max(640, window.innerWidth - 24);
    const maxHeight = () => Math.max(320, window.innerHeight - 24);

    const move = (ev: PointerEvent): void => {
      const width = clamp(start.width + ev.clientX - startX, 960, maxWidth());
      const height = clamp(start.height + ev.clientY - startY, 520, maxHeight());
      host.style.setProperty('width', `${Math.round(width)}px`, 'important');
      host.style.setProperty('height', `${Math.round(height)}px`, 'important');
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const rect = host.getBoundingClientRect();
      sessionStorage.setItem(
        SIZE_KEY,
        JSON.stringify({ width: Math.round(rect.width), height: Math.round(rect.height) }),
      );
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
