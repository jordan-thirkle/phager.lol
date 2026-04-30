import fs from 'fs';
import path from 'path';

/**
 * Handles JSON-based file persistence for leaderboards and chat.
 * @class PersistentStore
 * @param {string} dataDir - Directory where data files are stored.
 * @param {string} filename - Target file in dataDir.
 * @param {Array} defaultData - Initial data if file doesn't exist.
 */
export class PersistentStore {
  constructor(dataDir, filename, defaultData = []) {
    this.path = path.join(dataDir, filename);
    this.data = defaultData;
    this.load();
  }

  /**
   * Loads data from disk.
   * @side_effects Mutates this.data.
   */
  load() {
    try {
      if (fs.existsSync(this.path)) {
        this.data = JSON.parse(fs.readFileSync(this.path, 'utf8'));
      }
    } catch (e) {
      console.error(`Failed to load ${this.path}`, e);
    }
  }

  /**
   * Saves data to disk using an atomic rename to prevent corruption.
   * @AI-CONTEXT: Uses .tmp suffix + renameSync to ensure partial writes don't kill the HOF.
   */
  save() {
    try {
      const tempPath = this.path + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data), 'utf8');
      try {
        fs.renameSync(tempPath, this.path);
      } catch (renameErr) {
        if (renameErr.code === 'EPERM') {
          // Fallback for Windows file locking issues (Cursor Vibe Jam 2026 dev environment)
          fs.writeFileSync(this.path, JSON.stringify(this.data), 'utf8');
        } else {
          throw renameErr;
        }
      }
    } catch (e) {
      console.error(`Failed to save ${this.path}`, e);
    }
  }
}
