import { badgeRequestKey, stepBadgeIndex, type BadgeLevel, type BadgeRequest } from './badges';
import { badgeIsOwned, type BadgeProgress } from './badge-progress';

export const BADGE_STYLE = `
.steam-booster-badge-slot {
  position: relative;
  z-index: 3;
  clear: both;
  width: 100%;
}
.steam-booster-badge-panel {
  box-sizing: border-box;
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.35);
  color: #c6d4df;
  font-size: 12px;
  line-height: 1.3;
}
.steam-booster-badge-panel[hidden],
.steam-booster-badge-status[hidden] {
  display: none !important;
}
.steam-booster-badge-status {
  margin: 0;
}
.steam-booster-badge-levels {
  display: flex;
  flex-wrap: wrap;
  column-gap: 16px;
  row-gap: 8px;
}
.steam-booster-badge-level {
  width: 64px;
  margin: 0;
  min-width: 0;
  text-align: center;
}
.steam-booster-badge-level img {
  display: block;
  width: 64px;
  height: 64px;
  object-fit: contain;
  margin: 0 auto 4px;
  background: #1b1b1b;
}
.steam-booster-badge-level.owned img {
  outline: 2px solid #8bc53f;
  outline-offset: 1px;
}
.steam-booster-badge-level.foil img {
  box-shadow: inset 0 0 0 1px rgba(255, 215, 120, 0.75);
}
.steam-booster-badge-level-label,
.steam-booster-badge-name {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.steam-booster-badge-name {
  color: #8f98a0;
}
button.steam-booster-badge-level {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 64px;
  min-width: 0;
  max-width: 64px;
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: zoom-in;
}
button.steam-booster-badge-level:focus-visible {
  outline: 1px solid #67c1f5;
  outline-offset: 2px;
}
.gamecard_details .badge_current,
.gamecard_badge_progress {
  cursor: pointer;
}
.gamecard_badge_progress .badge_empty_circle {
  overflow: hidden;
}
.steam-booster-badge-row .badge_current {
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.35);
  box-shadow: inset 0 0 0 1px #2d2b2b;
}
.steam-booster-badge-row .badge_current.steam-booster-badge-hot {
  background: rgba(103, 193, 245, 0.1);
  box-shadow: inset 0 0 0 1px rgba(103, 193, 245, 0.75);
}
.steam-booster-next-badge {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.6;
  border-radius: 50%;
  pointer-events: none;
}
.steam-booster-badge-modal[hidden] {
  display: none !important;
}
.steam-booster-badge-modal {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.steam-booster-badge-modal-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  padding: 0;
  background: rgba(0, 0, 0, 0.72);
  cursor: pointer;
}
.steam-booster-badge-modal-card {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: min(520px, 100%);
  padding: 16px;
  background: #1b2838;
  border: 1px solid #2a475e;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  color: #c6d4df;
  font-family: "Motiva Sans", Arial, Helvetica, sans-serif;
}
.steam-booster-badge-modal-close {
  position: absolute;
  top: 8px;
  right: 8px;
}
.steam-booster-badge-modal-nav,
.steam-booster-badge-modal-close {
  appearance: none;
  border: 1px solid #2a475e;
  background: #16202d;
  color: #c6d4df;
  font: inherit;
  font-size: 13px;
  padding: 8px 10px;
  cursor: pointer;
}
.steam-booster-badge-modal-nav:focus-visible,
.steam-booster-badge-modal-close:focus-visible,
.steam-booster-badge-modal-image:focus-visible {
  outline: 1px solid #67c1f5;
  outline-offset: 2px;
}
.steam-booster-badge-modal-figure {
  margin: 0;
  min-width: 0;
  text-align: center;
}
.steam-booster-badge-modal-image {
  display: block;
  width: min(280px, 60vw);
  height: min(280px, 60vw);
  margin: 28px auto 12px;
  padding: 0;
  border: 0;
  appearance: none;
  background: #1b1b1b;
  cursor: pointer;
}
.steam-booster-badge-modal-image.owned {
  outline: 3px solid #8bc53f;
  outline-offset: 2px;
}
.steam-booster-badge-modal-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.steam-booster-badge-modal-image.foil {
  box-shadow: inset 0 0 0 1px rgba(255, 215, 120, 0.75);
}
.steam-booster-badge-modal-label,
.steam-booster-badge-modal-count {
  display: block;
  color: #8f98a0;
  font-size: 12px;
}
.steam-booster-badge-modal-name {
  display: block;
  margin: 4px 0;
  color: #fff;
  font-size: 20px;
  line-height: 1.3;
  white-space: normal;
  overflow: visible;
  overflow-wrap: anywhere;
}
`;

export interface BadgePresenter {
  toggle(slot: HTMLElement, request: BadgeRequest, loadProgress: () => Promise<BadgeProgress | null>): boolean;
  isOpen(slot: HTMLElement): boolean;
  close(): void;
  handleKey(event: KeyboardEvent): void;
  syncConnection(): void;
  destroy(): void;
}

export function createBadgePresenter(loadLevels: (request: BadgeRequest) => Promise<BadgeLevel[]>): BadgePresenter {
  let panel: HTMLDivElement | null = null;
  let status: HTMLParagraphElement | null = null;
  let list: HTMLDivElement | null = null;
  let token = 0;
  let progress: BadgeProgress | null = null;
  let badgeModal: BadgeModal | null = null;

  function ensurePanel(): { panel: HTMLDivElement; status: HTMLParagraphElement; list: HTMLDivElement } {
    if (panel?.isConnected && status && list) return { panel, status, list };
    panel = document.createElement('div');
    panel.className = 'steam-booster-badge-panel';
    panel.hidden = true;
    status = document.createElement('p');
    status.className = 'steam-booster-badge-status';
    status.hidden = true;
    list = document.createElement('div');
    list.className = 'steam-booster-badge-levels';
    panel.append(status, list);
    return { panel, status, list };
  }

  function close(): void {
    token += 1;
    if (panel) panel.hidden = true;
    closeBadgeModal();
  }

  function toggle(slot: HTMLElement, request: BadgeRequest, loadProgress: () => Promise<BadgeProgress | null>): boolean {
    const view = ensurePanel();
    const key = badgeRequestKey(request);
    if (slot.contains(view.panel) && !view.panel.hidden && view.panel.dataset.key === key) {
      close();
      return false;
    }
    token += 1;
    const current = token;
    view.panel.dataset.key = key;
    view.panel.hidden = false;
    slot.append(view.panel);
    showStatus(view.status, view.list, 'Loading badge levels…');
    const progressPromise = loadProgress().catch(() => null);
    void loadLevels(request)
      .then(async (loaded) => {
        if (current !== token || !view.panel.isConnected) return;
        progress = null;
        if (loaded.length === 0) {
          showStatus(view.status, view.list, 'SteamCardExchange has no badge images for this card.');
          return;
        }
        renderLevels(view.status, view.list, loaded, null);
        progress = await progressPromise;
        if (current !== token || !view.panel.isConnected) return;
        applyOwned(view.list, loaded, progress);
      })
      .catch((error: unknown) => {
        if (current !== token || !view.panel.isConnected) return;
        showStatus(view.status, view.list, error instanceof Error ? error.message : 'Could not load badge levels.');
      });
    return true;
  }

  function applyOwned(levelList: HTMLElement, loaded: BadgeLevel[], ownedProgress: BadgeProgress | null): void {
    for (const node of levelList.querySelectorAll('button.steam-booster-badge-level')) {
      if (!(node instanceof HTMLButtonElement)) continue;
      const index = Number(node.dataset.index);
      const level = loaded[index];
      if (!level) continue;
      const owned = badgeIsOwned(level, ownedProgress);
      node.classList.toggle('owned', owned);
      const base = node.dataset.label ?? level.name;
      node.setAttribute('aria-label', owned ? `${base}. Owned. Show larger` : `${base}. Show larger`);
    }
    if (badgeModal && !badgeModal.root.hidden) showBadge(badgeModal.index);
  }

  function showStatus(statusNode: HTMLElement, levelList: HTMLElement, message: string): void {
    levelList.replaceChildren();
    statusNode.hidden = false;
    statusNode.textContent = message;
  }

  function renderLevels(
    statusNode: HTMLElement,
    levelList: HTMLElement,
    loaded: BadgeLevel[],
    ownedProgress: BadgeProgress | null,
  ): void {
    statusNode.hidden = true;
    statusNode.textContent = '';
    levelList.replaceChildren(
      ...loaded.map((level, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = level.foil ? 'steam-booster-badge-level foil' : 'steam-booster-badge-level';
        item.dataset.index = String(index);
        const label = level.foil ? 'Foil' : `Level ${level.level}`;
        item.dataset.label = `${label}, ${level.name}`;
        const owned = badgeIsOwned(level, ownedProgress);
        item.classList.toggle('owned', owned);
        item.setAttribute('aria-label', owned ? `${item.dataset.label}. Owned. Show larger` : `${item.dataset.label}. Show larger`);
        item.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openBadgeModal(loaded, index, levelList);
        });
        const image = document.createElement('img');
        image.src = level.imageUrl;
        image.alt = '';
        const levelLabel = document.createElement('span');
        levelLabel.className = 'steam-booster-badge-level-label';
        levelLabel.textContent = label;
        const name = document.createElement('span');
        name.className = 'steam-booster-badge-name';
        name.textContent = level.name;
        item.append(image, levelLabel, name);
        return item;
      }),
    );
  }

  function openBadgeModal(loaded: BadgeLevel[], index: number, source: HTMLElement): void {
    const modal = ensureBadgeModal();
    modal.levels = loaded;
    modal.source = source;
    modal.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.root.hidden = false;
    showBadge(index);
    modal.card.focus();
  }

  function ensureBadgeModal(): BadgeModal {
    if (badgeModal) return badgeModal;
    const root = document.createElement('div');
    root.className = 'steam-booster-badge-modal';
    root.hidden = true;

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'steam-booster-badge-modal-backdrop';
    backdrop.setAttribute('aria-label', 'Close badge preview');
    backdrop.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeBadgeModal();
    });

    const card = document.createElement('div');
    card.className = 'steam-booster-badge-modal-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.tabIndex = -1;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'steam-booster-badge-modal-close';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeBadgeModal();
    });

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'steam-booster-badge-modal-nav';
    previous.textContent = 'Previous';
    previous.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveBadgeModal(-1);
    });

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'steam-booster-badge-modal-nav';
    next.textContent = 'Next';
    next.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveBadgeModal(1);
    });

    const figure = document.createElement('figure');
    figure.className = 'steam-booster-badge-modal-figure';
    const imageButton = document.createElement('button');
    imageButton.type = 'button';
    imageButton.className = 'steam-booster-badge-modal-image';
    imageButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveBadgeModal(1);
    });
    const image = document.createElement('img');
    image.alt = '';
    imageButton.append(image);
    const label = document.createElement('span');
    label.id = 'steam-booster-badge-modal-level';
    label.className = 'steam-booster-badge-modal-label';
    const name = document.createElement('span');
    name.id = 'steam-booster-badge-modal-name';
    name.className = 'steam-booster-badge-modal-name';
    const count = document.createElement('span');
    count.className = 'steam-booster-badge-modal-count';
    figure.append(imageButton, label, name, count);
    card.setAttribute('aria-labelledby', name.id);
    card.setAttribute('aria-describedby', label.id);
    card.append(closeButton, previous, figure, next);
    root.append(backdrop, card);
    document.body.append(root);

    badgeModal = {
      root,
      card,
      imageButton,
      image,
      label,
      name,
      count,
      levels: [],
      index: 0,
      source: root,
      returnFocus: null,
    };
    return badgeModal;
  }

  function showBadge(index: number): void {
    if (!badgeModal || badgeModal.levels.length === 0) return;
    const level = badgeModal.levels[index];
    if (!level) return;
    badgeModal.index = index;
    badgeModal.image.src = level.imageUrl;
    badgeModal.image.alt = level.foil ? `${level.name} foil badge` : `${level.name} badge`;
    badgeModal.imageButton.classList.toggle('foil', level.foil);
    badgeModal.imageButton.classList.toggle('owned', badgeIsOwned(level, progress));
    badgeModal.imageButton.setAttribute('aria-label', `Next badge. Current badge: ${level.name}`);
    badgeModal.label.textContent = level.foil ? 'Foil' : `Level ${level.level}`;
    badgeModal.name.textContent = level.name;
    badgeModal.count.textContent = `${index + 1} of ${badgeModal.levels.length}`;
  }

  function moveBadgeModal(direction: -1 | 1): void {
    if (!badgeModal || badgeModal.root.hidden) return;
    showBadge(stepBadgeIndex(badgeModal.index, badgeModal.levels.length, direction));
  }

  function closeBadgeModal(): void {
    if (!badgeModal || badgeModal.root.hidden) return;
    badgeModal.root.hidden = true;
    badgeModal.levels = [];
    const focus = badgeModal.returnFocus;
    badgeModal.returnFocus = null;
    if (focus?.isConnected) focus.focus();
  }

  return {
    toggle,
    isOpen(slot) {
      return panel != null && slot.contains(panel) && !panel.hidden;
    },
    close,
    handleKey(event) {
      if (!badgeModal || badgeModal.root.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeBadgeModal();
        return;
      }
      const direction =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (!direction) return;
      event.preventDefault();
      event.stopPropagation();
      moveBadgeModal(direction);
    },
    syncConnection() {
      if (badgeModal && !badgeModal.source.isConnected) closeBadgeModal();
      if (panel && !panel.hidden && !panel.isConnected) panel.hidden = true;
    },
    destroy() {
      token += 1;
      panel?.remove();
      panel = null;
      badgeModal?.root.remove();
      badgeModal = null;
    },
  };
}

interface BadgeModal {
  root: HTMLDivElement;
  card: HTMLDivElement;
  imageButton: HTMLButtonElement;
  image: HTMLImageElement;
  label: HTMLSpanElement;
  name: HTMLSpanElement;
  count: HTMLSpanElement;
  levels: BadgeLevel[];
  index: number;
  source: HTMLElement;
  returnFocus: HTMLElement | null;
}
