// Connection and authentication management

const passwords = require('./passwords.json');

class ConnectionManager {
  constructor() {
    this.connections = new Map(); // ws -> connectionInfo
    this.names = new Set();
    this.authTimeout = 5000;
  }

  addConnection(ws) {
    const connectionInfo = {
      ws,
      authenticated: false,
      teamId: null,
      isSpectator: false,
      name: null,
      authTimer: null,
    };

    this.connections.set(ws, connectionInfo);

    connectionInfo.authTimer = setTimeout(() => {
      if (!connectionInfo.authenticated) {
        this.send(ws, { type: 'AUTH_FAILED', reason: 'Authentication timeout' });
        ws.close();
      }
    }, this.authTimeout);

    return connectionInfo;
  }

  removeConnection(ws) {
    const info = this.connections.get(ws);
    if (info) {
      if (info.authTimer) clearTimeout(info.authTimer);
      if (info.name) this.names.delete(info.name);
      this.connections.delete(ws);
    }
  }

  generateUniqueName(baseName) {
    if (!this.names.has(baseName)) {
      this.names.add(baseName);
      return baseName;
    }

    let counter = 1;
    let uniqueName = `${baseName}(${counter})`;
    while (this.names.has(uniqueName)) {
      counter++;
      uniqueName = `${baseName}(${counter})`;
    }
    this.names.add(uniqueName);
    return uniqueName;
  }

  authenticate(ws, message) {
    const info = this.connections.get(ws);
    if (!info) return { success: false, reason: 'Connection not found' };
    if (info.authenticated) return { success: false, reason: 'Already authenticated' };

    const { password, name, preferredTeam } = message;

    let teamId = null;
    let isSpectator = false;

    if (password === passwords.players) {
      // Player - try preferredTeam first, then fall back to any available
      if (preferredTeam === 0 || preferredTeam === 1) {
        if (!this.isTeamTaken(preferredTeam)) {
          teamId = preferredTeam;
        } else if (!this.isTeamTaken(1 - preferredTeam)) {
          teamId = 1 - preferredTeam;
        } else {
          return { success: false, reason: 'Both teams are already taken' };
        }
      } else {
        if (!this.isTeamTaken(0)) {
          teamId = 0;
        } else if (!this.isTeamTaken(1)) {
          teamId = 1;
        } else {
          return { success: false, reason: 'Both teams are already taken' };
        }
      }
    } else if (password === passwords.spectator) {
      teamId = -1;
      isSpectator = true;
    } else {
      return { success: false, reason: 'Invalid password' };
    }

    if (info.authTimer) {
      clearTimeout(info.authTimer);
      info.authTimer = null;
    }

    const assignedName = this.generateUniqueName(name || `Player${teamId}`);

    info.authenticated = true;
    info.teamId = teamId;
    info.isSpectator = isSpectator;
    info.name = assignedName;

    return { success: true, teamId, assignedName, isSpectator };
  }

  isTeamTaken(teamId) {
    for (const [, info] of this.connections) {
      if (info.authenticated && !info.isSpectator && info.teamId === teamId) {
        return true;
      }
    }
    return false;
  }

  getConnectionInfo(ws) {
    return this.connections.get(ws);
  }

  getPlayers() {
    const players = [];
    for (const [ws, info] of this.connections) {
      if (info.authenticated && !info.isSpectator) {
        players.push({ ws, ...info });
      }
    }
    return players;
  }

  getSpectators() {
    const spectators = [];
    for (const [ws, info] of this.connections) {
      if (info.authenticated && info.isSpectator) {
        spectators.push({ ws, ...info });
      }
    }
    return spectators;
  }

  getPlayerByTeam(teamId) {
    for (const [ws, info] of this.connections) {
      if (info.authenticated && !info.isSpectator && info.teamId === teamId) {
        return { ws, ...info };
      }
    }
    return null;
  }

  bothTeamsConnected() {
    return this.getPlayerByTeam(0) !== null && this.getPlayerByTeam(1) !== null;
  }

  getConnectedClients() {
    const clients = [];
    for (const [, info] of this.connections) {
      if (info.authenticated) {
        clients.push({
          name: info.name,
          type: info.isSpectator ? 'spectator' : 'player',
          team: info.isSpectator ? undefined : info.teamId,
        });
      }
    }
    return clients;
  }

  send(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const [ws, info] of this.connections) {
      if (info.authenticated && ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }

  broadcastToPlayers(message) {
    const data = JSON.stringify(message);
    for (const [ws, info] of this.connections) {
      if (info.authenticated && !info.isSpectator && ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }

  broadcastToSpectators(message) {
    const data = JSON.stringify(message);
    for (const [ws, info] of this.connections) {
      if (info.authenticated && info.isSpectator && ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }
}

module.exports = { ConnectionManager };
