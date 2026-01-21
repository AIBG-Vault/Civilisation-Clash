/**
 * UI Panel controls and management
 */
const Panels = {
  // Panel references
  elements: {
    player0: null,
    player1: null,
    turn: null,
    controls: null,
    replay: null,
    manual: null,
    inspector: null,
    terminal: null,
  },

  // Modal references
  modals: {
    settings: null,
    replays: null,
    build: null,
  },

  // State
  terminalOpen: false,
  inspectorOpen: false,
  manualPanelOpen: false,
  selectedUnitType: null,

  /**
   * Initialize all panel references
   */
  init() {
    // Get panel elements
    this.elements.player0 = document.getElementById('panel-player0');
    this.elements.player1 = document.getElementById('panel-player1');
    this.elements.turn = document.getElementById('panel-turn');
    this.elements.controls = document.getElementById('panel-controls');
    this.elements.replay = document.getElementById('panel-replay');
    this.elements.manual = document.getElementById('panel-manual');
    this.elements.inspector = document.getElementById('panel-inspector');
    this.elements.terminal = document.getElementById('terminal');

    // Get modal elements
    this.modals.settings = document.getElementById('modal-settings');
    this.modals.replays = document.getElementById('modal-replays');
    this.modals.build = document.getElementById('modal-build');

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Set up event listeners
    this.setupEventListeners();

    // Set up unit card selection
    this.setupUnitCards();
  },

  /**
   * Set up event listeners for panels
   */
  setupEventListeners() {
    // Listen for tile selection events from renderer
    window.addEventListener('tile-selected', (e) => {
      this.showInspector(e.detail);
    });

    window.addEventListener('tile-deselected', () => {
      this.hideInspector();
    });

    // Close modals when clicking overlay
    Object.values(this.modals).forEach((modal) => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.add('hidden');
          }
        });
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });
  },

  /**
   * Set up unit card selection in build modal
   */
  setupUnitCards() {
    const unitCards = document.querySelectorAll('.unit-card');
    unitCards.forEach((card) => {
      card.addEventListener('click', () => {
        // Remove selection from all cards
        unitCards.forEach((c) => c.classList.remove('selected'));
        // Select clicked card
        card.classList.add('selected');
        this.selectedUnitType = card.dataset.unit;
      });
    });
  },

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboard(e) {
    // Escape to close modals/inspector/cancel interaction
    if (e.key === 'Escape') {
      this.closeAllModals();
      this.hideInspector();
      if (this.terminalOpen) {
        this.toggleTerminal();
      }
      // Cancel any interaction mode
      if (typeof App !== 'undefined') {
        App.cancelInteractionMode();
      }
    }

    // T for terminal
    if (e.key === 't' && !e.ctrlKey && !e.metaKey && !this.isInputFocused()) {
      this.toggleTerminal();
    }

    // Space for zoom to fit
    if (e.key === ' ' && !this.isInputFocused()) {
      e.preventDefault();
      if (typeof Renderer !== 'undefined') {
        Renderer.zoomToFit();
      }
    }

    // B for build (when playing)
    if (e.key === 'b' && !e.ctrlKey && !e.metaKey && !this.isInputFocused()) {
      if (typeof App !== 'undefined' && !App.isSpectator) {
        toggleModal('modal-build');
      }
    }

    // E for expand (when playing)
    if (e.key === 'e' && !e.ctrlKey && !e.metaKey && !this.isInputFocused()) {
      if (typeof App !== 'undefined' && !App.isSpectator) {
        App.startExpandMode();
      }
    }

    // C for build city (when playing)
    if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !this.isInputFocused()) {
      if (typeof App !== 'undefined' && !App.isSpectator) {
        App.startCityMode();
      }
    }
  },

  /**
   * Check if an input element is focused
   */
  isInputFocused() {
    const active = document.activeElement;
    return (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')
    );
  },

  /**
   * Toggle panel minimized state
   */
  togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const isMinimized = panel.getAttribute('data-minimized') === 'true';
    panel.setAttribute('data-minimized', !isMinimized);

    // Update icon
    const icon = panel.querySelector('[data-lucide]');
    if (icon && typeof lucide !== 'undefined') {
      icon.setAttribute('data-lucide', isMinimized ? 'minus' : 'plus');
      lucide.createIcons();
    }
  },

  /**
   * Toggle modal visibility
   */
  toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const isHidden = modal.classList.contains('hidden');

    // Close all modals first
    this.closeAllModals();

    // Toggle this modal
    if (isHidden) {
      modal.classList.remove('hidden');
    }
  },

  /**
   * Close all modals
   */
  closeAllModals() {
    Object.values(this.modals).forEach((modal) => {
      if (modal) {
        modal.classList.add('hidden');
      }
    });
  },

  /**
   * Toggle terminal visibility
   */
  toggleTerminal() {
    this.terminalOpen = !this.terminalOpen;

    if (this.elements.terminal) {
      this.elements.terminal.classList.toggle('hidden', !this.terminalOpen);
    }

    // Update button state
    const btn = document.getElementById('btn-terminal');
    if (btn) {
      btn.classList.toggle('active', this.terminalOpen);
    }
  },

  /**
   * Show inspector panel with tile/unit details
   */
  showInspector(details) {
    const inspector = this.elements.inspector;
    if (!inspector) return;

    // Update position
    document.getElementById('inspect-pos').textContent = `(${details.x}, ${details.y})`;

    // Update terrain
    const terrain = details.tile ? details.tile.type : 'Unknown';
    document.getElementById('inspect-terrain').textContent =
      terrain.charAt(0).toUpperCase() + terrain.slice(1).toLowerCase();

    // Update owner
    const ownerEl = document.getElementById('inspect-owner');
    if (details.tile && details.tile.owner !== null) {
      ownerEl.textContent = details.tile.owner === 0 ? 'Blue' : 'Red';
      ownerEl.className = details.tile.owner === 0 ? 'text-team0' : 'text-team1';
    } else {
      ownerEl.textContent = 'Neutral';
      ownerEl.className = '';
    }

    // Update income (spec: Field=0.5 GOLD/turn, Cities=5 GOLD/turn)
    const incomeMap = {
      FIELD: '+0.5/turn',
      MOUNTAIN: 'None',
      WATER: 'None',
      MONUMENT: 'Special',
    };
    document.getElementById('inspect-income').textContent = incomeMap[details.tile?.type] || 'None';

    // Update unit section
    const unitSection = document.getElementById('inspect-unit');
    if (details.unit) {
      unitSection.style.display = 'block';
      document.getElementById('inspect-unit-type').textContent =
        details.unit.type.charAt(0).toUpperCase() + details.unit.type.slice(1).toLowerCase();

      const maxHp = { SOLDIER: 3, ARCHER: 2, RAIDER: 1 }[details.unit.type] || 3;
      const hpPercent = (details.unit.hp / maxHp) * 100;
      document.getElementById('inspect-unit-hp-bar').style.width = hpPercent + '%';
      document.getElementById('inspect-unit-hp').textContent = `${details.unit.hp}/${maxHp}`;

      // Update HP bar color
      const hpBar = document.getElementById('inspect-unit-hp-bar');
      hpBar.classList.remove('low', 'critical');
      if (hpPercent <= 33) {
        hpBar.classList.add('critical');
      } else if (hpPercent <= 66) {
        hpBar.classList.add('low');
      }

      // Handle both canMove (legacy) and can_move_next_turn (spec)
      const canMove = details.unit.can_move_next_turn ?? details.unit.canMove;
      document.getElementById('inspect-unit-move').textContent = canMove !== false ? 'Yes' : 'No';
    } else {
      unitSection.style.display = 'none';
    }

    // Show inspector with animation
    inspector.classList.remove('hidden');
    inspector.classList.add('visible');
    this.inspectorOpen = true;
  },

  /**
   * Hide inspector panel
   */
  hideInspector() {
    const inspector = this.elements.inspector;
    if (!inspector) return;

    inspector.classList.remove('visible');
    inspector.classList.add('hidden');
    this.inspectorOpen = false;
  },

  /**
   * Close inspector (called from button)
   */
  closeInspector() {
    this.hideInspector();

    // Deselect tile in renderer
    if (typeof Renderer !== 'undefined') {
      Renderer.selectedTile = null;
      Renderer.selectedUnit = null;
    }
  },

  /**
   * Toggle theme (light/dark)
   */
  toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update Lucide icons (for sun/moon toggle)
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * Update player stats panel
   */
  updatePlayerStats(playerId, stats) {
    const prefix = `p${playerId}`;

    if (stats.gold !== undefined) {
      const el = document.getElementById(`${prefix}-gold`);
      if (el) el.textContent = stats.gold;
    }

    if (stats.income !== undefined) {
      const el = document.getElementById(`${prefix}-income`);
      if (el) el.textContent = `+${stats.income}`;
    }

    if (stats.score !== undefined) {
      const el = document.getElementById(`${prefix}-score`);
      if (el) el.textContent = stats.score;
    }

    if (stats.cities !== undefined) {
      const el = document.getElementById(`${prefix}-cities`);
      if (el) el.textContent = stats.cities;
    }

    if (stats.units !== undefined) {
      const el = document.getElementById(`${prefix}-units`);
      if (el) el.textContent = stats.units;
    }

    if (stats.tiles !== undefined) {
      const el = document.getElementById(`${prefix}-tiles`);
      if (el) el.textContent = stats.tiles;
    }
  },

  /**
   * Update turn info panel
   */
  updateTurnInfo(turnInfo) {
    if (turnInfo.current !== undefined) {
      const el = document.getElementById('turn-current');
      if (el) el.textContent = turnInfo.current;
    }

    if (turnInfo.max !== undefined) {
      const el = document.getElementById('turn-max');
      if (el) el.textContent = turnInfo.max;
    }

    if (turnInfo.monumentOwner !== undefined) {
      const el = document.getElementById('monument-owner');
      if (el) {
        if (turnInfo.monumentOwner === null) {
          el.textContent = 'Contested';
          el.className = 'text-slate-500';
        } else {
          // Use provided name or fall back to Player 1/2
          el.textContent = turnInfo.monumentOwnerName || `Player ${turnInfo.monumentOwner + 1}`;
          el.className =
            turnInfo.monumentOwner === 0 ? 'text-team0 font-semibold' : 'text-team1 font-semibold';
        }
      }
    }
  },

  /**
   * Update timer display
   */
  updateTimer(timeMs) {
    const el = document.getElementById('timer');
    if (!el) return;

    const totalSeconds = Math.ceil(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    el.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Add warning/critical classes
    el.classList.remove('timer-warning', 'timer-critical');
    if (totalSeconds <= 5) {
      el.classList.add('timer-critical');
    } else if (totalSeconds <= 10) {
      el.classList.add('timer-warning');
    }
  },

  /**
   * Update connection status
   */
  updateConnectionStatus(status) {
    // status can be: 'connected', 'connecting', 'disconnected', 'reconnecting'
    const connected = status === 'connected';
    const mainDot = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-text');

    if (mainDot) {
      mainDot.classList.toggle('connected', connected);
      mainDot.classList.toggle('connecting', status === 'connecting' || status === 'reconnecting');
    }

    if (statusText) {
      const textMap = {
        connected: 'Live',
        connecting: 'Connecting...',
        reconnecting: 'Reconnecting...',
        disconnected: 'Disconnected',
      };
      statusText.textContent = textMap[status] || 'Disconnected';
    }
  },

  /**
   * Update player info (name and connection status)
   */
  updatePlayerInfo(playerId, info) {
    const nameEl = document.getElementById(`p${playerId}-name`);
    const dotEl = document.getElementById(`p${playerId}-connection-dot`);

    if (nameEl && info.name !== undefined) {
      nameEl.textContent = info.name || 'Waiting...';
    }

    if (dotEl && info.connected !== undefined) {
      dotEl.classList.toggle('connected', info.connected);
    }
  },

  /**
   * Update queued actions count
   */
  updateQueuedCount(count) {
    const el = document.getElementById('queued-count');
    if (el) el.textContent = count;
  },

  /**
   * Add message to terminal
   */
  addTerminalMessage(message, type = 'info') {
    const content = document.getElementById('terminal-content');
    if (!content) return;

    const colorMap = {
      info: 'text-slate-400',
      success: 'text-green-500',
      warning: 'text-yellow-500',
      error: 'text-red-500',
      action: 'text-blue-500',
    };

    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const div = document.createElement('div');
    div.className = colorMap[type] || 'text-slate-400';
    div.textContent = `[${timestamp}] ${message}`;

    content.appendChild(div);
    content.scrollTop = content.scrollHeight;

    // Limit terminal history
    while (content.children.length > 100) {
      content.removeChild(content.firstChild);
    }
  },

  /**
   * Update build modal city dropdown
   */
  updateBuildCities(cities, teamId) {
    const select = document.getElementById('build-city');
    if (!select) return;

    select.innerHTML = '';
    cities
      .filter((c) => c.owner === teamId)
      .forEach((city, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent =
          index === 0 ? `Capital (${city.x}, ${city.y})` : `City (${city.x}, ${city.y})`;
        select.appendChild(option);
      });
  },

  /**
   * Toggle manual play panel
   */
  toggleManualPanel() {
    this.manualPanelOpen = !this.manualPanelOpen;

    if (this.elements.manual) {
      this.elements.manual.classList.toggle('open', this.manualPanelOpen);
    }
  },

  /**
   * Show manual play connected state
   */
  showManualConnected(teamId) {
    const connectSection = document.getElementById('manual-connect');
    const actionsSection = document.getElementById('manual-actions');
    const teamName = document.getElementById('manual-team-name');

    if (connectSection) connectSection.classList.add('hidden');
    if (actionsSection) actionsSection.classList.remove('hidden');

    if (teamName) {
      teamName.textContent = teamId === 0 ? 'Blue' : 'Red';
      teamName.className = teamId === 0 ? 'font-semibold text-team0' : 'font-semibold text-team1';
    }

    // Open the panel
    this.manualPanelOpen = true;
    if (this.elements.manual) {
      this.elements.manual.classList.add('open');
    }
  },

  /**
   * Show manual play disconnected state
   */
  showManualDisconnected() {
    const connectSection = document.getElementById('manual-connect');
    const actionsSection = document.getElementById('manual-actions');

    if (connectSection) connectSection.classList.remove('hidden');
    if (actionsSection) actionsSection.classList.add('hidden');
  },

  /**
   * Update action queue display
   */
  updateActionQueue(actions) {
    const container = document.getElementById('action-queue');
    if (!container) return;

    if (actions.length === 0) {
      container.innerHTML = '<div class="text-slate-400 italic">No actions queued</div>';
    } else {
      container.innerHTML = actions
        .map(
          (action, i) => `
        <div class="action-queue-item">
          <span class="action-type">${action.action}</span>
          <span class="action-details text-slate-500">${this.formatActionDetails(action)}</span>
          <span class="action-remove" onclick="App.removeAction(${i})">
            <i data-lucide="x" class="w-3 h-3"></i>
          </span>
        </div>
      `
        )
        .join('');

      // Re-render lucide icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }

    this.updateQueuedCount(actions.length);
  },

  /**
   * Format action details for display
   */
  formatActionDetails(action) {
    switch (action.action) {
      case 'MOVE':
        return `(${action.from_x},${action.from_y}) → (${action.to_x},${action.to_y})`;
      case 'BUILD_UNIT':
        return `${action.unit_type} at (${action.city_x},${action.city_y})`;
      case 'BUILD_CITY':
        return `at (${action.x},${action.y})`;
      case 'EXPAND_TERRITORY':
        return `to (${action.x},${action.y})`;
      default:
        return '';
    }
  },

  /**
   * Apply saved theme on load
   */
  applySavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  },
};

// Global functions for onclick handlers in HTML
function togglePanel(panelId) {
  Panels.togglePanel(panelId);
}

function toggleModal(modalId) {
  Panels.toggleModal(modalId);
}

function toggleTerminal() {
  Panels.toggleTerminal();
}

function toggleTheme() {
  Panels.toggleTheme();
}

function closeInspector() {
  Panels.closeInspector();
}

function toggleManualPanel() {
  Panels.toggleManualPanel();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Panels;
}
