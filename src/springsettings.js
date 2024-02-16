'use strict';

const { EventEmitter } = require('events');
const fs = require('fs');
const { renameSyncWithRetry } = require('./fs_utils');
const os = require('os');

const { writePath } = require('./spring_platform');
const { config } = require('./launcher_config');

class Springsettings extends EventEmitter {

	// Returns instance of Map, each config line in it's own entry.
	// Map preserves insertion order, so it can be iterated in the same order as
	// in the file, and it also contains comments, under unique
	// Symbol('comment') keys.
	#readSettings(springsettingsPath) {
		let fileContent = '';
		try {
			fileContent = fs.readFileSync(springsettingsPath).toString();
		} catch (err) {
			// ignore errors
		}
		const lines = fileContent.split(/\r?\n/g);
		if (lines[lines.length - 1] === '') {
			lines.pop();
		}
		const settings = new Map();
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.trim() === '' || line.trim()[0] === '#') {
				settings.set(Symbol('comment'), line);
				continue;
			}
			const keyvalue = line.split(/=/, 2);
			if (keyvalue.length != 2) {
				throw new Error(
					`Error loading ${springsettingsPath}: Cannot parse line ` +
					`${i+1} ("${line}"): it's not a comment or option assignment`);
			}
			settings.set(keyvalue[0].trim(), keyvalue[1].trim());
		}
		return settings;
	}

	#writeSettings(settings, springsettingsPath) {
		const result = [];
		for (const [key, value] of settings) {
			if (typeof key === 'symbol' && key.description === 'comment') {
				result.push(value);
			} else if (typeof key === 'string') {
				result.push(`${key} = ${value}`);
			} else {
				throw new Error(`internal error: unexpected key in map: ${key}`);
			}
		}
		const springsettingsPathTmp = springsettingsPath + '.tmp';
		fs.writeFileSync(springsettingsPathTmp, result.join(os.EOL) + os.EOL);
		renameSyncWithRetry(springsettingsPathTmp, springsettingsPath);
	}

	#applyDefaults(settings, defaults) {
		for (const key in defaults) {
			if (!settings.has(key)) {
				settings.set(key, defaults[key]);
			}
		}
	}

	#applyOverrides(settings, overrides) {
		for (const key in overrides) {
			if (overrides[key] === null) {
				settings.delete(key);
			} else {
				settings.set(key, overrides[key]);
			}
		}
	}

	#settingsEqual(settingsA, settingsB) {
		const a = Array.from(settingsA.entries());
		const b = Array.from(settingsB.entries());
		if (a.length != b.length) {
			return false;
		}
		for (let i = 0; i < a.length; ++i) {
			const [aKey, aVal] = a[i];
			const [bKey, bVal] = b[i];
			switch (typeof aKey) {
				case 'symbol':
					if (typeof bKey !== 'symbol' || aKey.description !== bKey.description) {
						return false;
					}
					break;
				case 'string':
					if (typeof bKey !== 'string' || aKey !== bKey) {
						return false;
					}
					break;
				default:
					throw new Error(`internal error: unexpected key type in map: ${aKey}`);
			}
			if (aVal !== bVal) {
				return false;
			}
		}
		return true;
	}

	applyDefaultsAndOverrides(overrides) {
		const defaults = config.default_springsettings || {};
		const springsettingsPath = `${writePath}/springsettings.cfg`;
		const backupSettingsPath = `${writePath}/springsettings-backup.cfg`;

		// As of 2022-12-30 there are issues with reliability of operations
		// on settings file in engine, so this code is a workaround to silently
		// keep backup of setting and apply it once detected that main file is
		// corrupted.
		let backupSettings = null;
		try {
			backupSettings = this.#readSettings(backupSettingsPath);
		} catch (err) {
			console.log("Failed to read backup settings file: %s, falling back to empty config.", err);
			backupSettings = new Map();
		}
		let settings = null;
		try {
			settings = this.#readSettings(springsettingsPath);
		} catch (err) {
			console.log("Failed to read setting file: %s, will use backup config.", err);
			settings = backupSettings;
		}
		// We verify and write before applying overrides because often engine
		// and launcher are fighting over certain settings values, e.g. engine
		// by default removes settings that are set to default values, and we
		// want to reduce number of writes to the backup settings file.
		if (!this.#settingsEqual(settings, backupSettings)) {
			console.log("Writing backup settings to %s", backupSettingsPath);
			this.#writeSettings(settings, backupSettingsPath);
		}

		this.#applyDefaults(settings, defaults);
		this.#applyOverrides(settings, overrides);
		this.#writeSettings(settings, springsettingsPath);
	}
}

exports.springsettings = new Springsettings();
