const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function _ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function _read(filePath, isArray = true) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, isArray ? '[]' : '{}', 'utf8');
      return isArray ? [] : {};
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed ?? (isArray ? [] : {});
  } catch { return isArray ? [] : {}; }
}

function _write(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Directories
function userDir(userId) { return _ensureDir(path.join(DATA_DIR, userId)); }
function deviceDir(userId, deviceId) { return _ensureDir(path.join(DATA_DIR, userId, deviceId)); }

// Per-device data: contacts, blacklist, schedules, queue, logs, sent_history, replies, sales
function readDeviceJSON(userId, deviceId, filename) {
  return _read(path.join(deviceDir(userId, deviceId), filename));
}
function readDeviceJSONObject(userId, deviceId, filename) {
  return _read(path.join(deviceDir(userId, deviceId), filename), false);
}
function writeDeviceJSON(userId, deviceId, filename, data) {
  _write(path.join(deviceDir(userId, deviceId), filename), data);
}

// Per-user data: templates (shared across all user's devices), devices.json
function readUserJSON(userId, filename) {
  return _read(path.join(userDir(userId), filename));
}
function writeUserJSON(userId, filename, data) {
  _write(path.join(userDir(userId), filename), data);
}

// Global data: users.json (system-wide)
function readJSON(filename) { return _read(path.join(DATA_DIR, filename)); }
function readJSONObject(filename) { return _read(path.join(DATA_DIR, filename), false); }
function writeJSON(filename, data) { _write(path.join(DATA_DIR, filename), data); }

// Delete device data folder
function deleteDeviceDir(userId, deviceId) {
  const dir = path.join(DATA_DIR, userId, deviceId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = {
  DATA_DIR,
  readDeviceJSON, readDeviceJSONObject, writeDeviceJSON,
  readUserJSON, writeUserJSON,
  readJSON, readJSONObject, writeJSON,
  deleteDeviceDir,
  userDir, deviceDir,
};
