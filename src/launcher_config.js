'use strict';

const argv = require('./launcher_args');
const { resolveWritePath } = require('./write_path');
const path = require('path');
const fs = require('fs');
const stableStringify = require('json-stable-stringify');

const defaultSetup = {
	'package': {
		// Possible values are 'darwin', 'linux', 'win32'
		'platform': 'all',
		'portable': false,
		'display': 'Spring Launcher'
	},

	'isolation': true,
	'auto_download': false,
	'auto_start': false,
	'no_downloads': false,
	'no_start_script': false,
	'load_dev_exts': false,
	// It can be a single string or array of destinations to try in
	// sequence for reliability in case first one fails. Can be set globally.
	'log_upload_url': null,
	'config_url': null,
	'silent': true,
	// String with HTML code (USE WITH CAUTION!) to attach to the error field.
	// Can be set globally.
	'error_suffix': null,
	'disable_win_ascii_install_path_check': false,

	// Orderer list of links to put in the footer of the launcher, e.g.
	//[{ "title": "Google", "url": "https://google.com" }]
	'links': undefined,

	// Controls whatever the launcher update dialog is shown when new version
	// of launcher is available or the update is just started right away.
	'disable_launcher_update_dialog': false,

	// Default values for environment variables to be set for all the executed
	// child processes like pr-downloader.
	'env_variables': {},

	'downloads': {
		'games': [],
		'maps': [],
		'engines': [],
		'resources': [],
	},

	'launch': {
		'start_args': [],
		'game': undefined,
		'map': undefined,
		'engine': undefined,
		'map_options': undefined,
		'mod_options': undefined,
		'game_options': undefined,
		// Key value settings to set in springsettings.cfg. It *overrides*
		// the existing values, including user specified ones. For setting
		// defaults for options, there is a top level default_springsettings
		// property.
		'springsettings': {}
	}
};

function canUse(config) {
	if (config.package.platform != 'all') {
		if (config.package.platform != process.platform) {
			return false;
		}
	}
	if (config.package.portable && !process.env.PORTABLE_EXECUTABLE_DIR) {
		return false;
	}
	if (process.env.PORTABLE_EXECUTABLE_DIR && !config.package.portable) {
		return false;
	}
	return true;
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target, ...sources) {
	if (sources.length === 0) {
		return target;
	}
	const source = sources.shift();

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!target[key]) {
					Object.assign(target, { [key]: {} });
				}
				mergeDeep(target[key], source[key]);
			} else {
				Object.assign(target, { [key]: source[key] });
			}
		}
	}

	return mergeDeep(target, ...sources);
}

function loadConfig() {
	// 1. argv.config should override any existing setting
	if (argv.config) {
		return require(argv.config);
	}

	// 2. Load config file that comes with the application
	const conf = require('./config.json');

	// 3. If there's a config.json file use that instead
	//    but if that fails to parse just ignore it and use the application one
	try {
		const writePath = resolveWritePath(conf.title);
		const configFile = path.join(writePath, 'config.json');
		if (!fs.existsSync(configFile)) {
			return conf;
		}

		console.log(`Loading Config file: ${configFile}`);
		return JSON.parse(fs.readFileSync(configFile));
	} catch (err) {
		// TODO: Perhaps too early to log at this point? We'll use console instead
		console.error('Cannot load local config.json. Falling back to default one.');
		console.error(err);
		return conf;
	}
}

function applyDefaults(conf) {
	for (let i = 0; i < conf.setups.length; i++) {
		const defaultSetupCopy = JSON.parse(JSON.stringify(defaultSetup));
		const setup = mergeDeep(defaultSetupCopy, conf.setups[i]);
		setup.title = conf.title;
		// Properties that need to be accesible from rendering process.
		if (!setup.error_suffix) setup.error_suffix = conf.error_suffix;
		if (!setup.links) setup.links = conf.links;
		conf.setups[i] = setup;
	}
	return conf;
}

let configs = [];
let availableConfigs = [];
let currentConfig = null;
let configFile = null;
let originalEnv = { ...process.env };

function setCurrentConfig(setup) {
	process.env = { ...originalEnv };
	if (setup) {
		for (const key in setup.env_variables) {
			if (!(key in process.env)) {
				process.env[key] = setup.env_variables[key];
			}
		}
	}
	currentConfig = setup;
}

function reloadConfig(conf) {
	configFile = conf;
	configs = [];
	availableConfigs = [];
	currentConfig = null;
	setCurrentConfig(null);

	conf.setups.forEach((setup) => {
		configs.push(setup);

		if (canUse(setup)) {
			availableConfigs.push(setup);
			if (!currentConfig) {
				setCurrentConfig(setup);
			}
		}
	});

	return conf;
}

reloadConfig(applyDefaults(loadConfig()));

/**
 * Deep compare of two objects for equality with support for ingoring properties.
 *
 * @param a - first object
 * @param b - second object
 * @param ignoreProp - optional list of properties to ignore when comparing
 * @returns boolean
 */
function objEqual(a, b, ignoreProp = []) {
	if (a === b) {
		return true;
	}
	if (!a || !b) {
		return false;
	}
	a = JSON.parse(JSON.stringify(a));
	b = JSON.parse(JSON.stringify(b));
	for (const prop of ignoreProp) {
		a[prop] = null;
		b[prop] = null;
	}
	return stableStringify(a) == stableStringify(b);
}

function validateNewConfig(newFile) {
	if (!isObject(newFile)) {
		throw Error('Config must be object');
	}
	if (newFile.title !== configFile.title) {
		throw Error('New config title must be identical to the old one');
	}
	if (!Array.isArray(newFile.setups) || !newFile.setups.some(canUse)) {
		throw Error('New config file must have at least 1 usable setup');
	}
}

function hotReloadSafe(newFile) {
	if (objEqual(newFile, configFile)) {
		return 'identical';
	}

	if (!objEqual(newFile, configFile, ['setups'])) {
		return 'reload';
	}

	for (const setup of newFile.setups) {
		if (setup.package.id == currentConfig.package.id &&
			objEqual(setup, currentConfig)) {
			return 'same-setup';
		}
	}

	return 'reload';
}

const proxy = new Proxy({
	setConfig: function (id) {
		var found = false;
		availableConfigs.forEach((cfg) => {
			if (cfg.package.id == id) {
				setCurrentConfig(cfg);
				found = true;
			}
		});
		if (!found) {
			console.log("No config with ID: %s - ignoring", id);
			return false;
		} else {
			return true;
		}
	},
	getAvailableConfigs: function () {
		return availableConfigs;
	},
	getConfigObj: function () {
		return currentConfig;
	}
}, {
	get: function (target, name) {
		if (target[name] != undefined) {
			return target[name];
		} /* else if (currentConfig[name] != undefined) {
			return currentConfig[name];
		} */
		return configFile[name];
	},
	set: function (_, name, value) {
		currentConfig[name] = value;
		// Just in case setCurrentConfig does something with the property that
		// is being set.
		setCurrentConfig(currentConfig); return true;
	}
});

module.exports = {
	config: proxy,
	applyDefaults: applyDefaults,
	hotReloadSafe: hotReloadSafe,
	reloadConfig: reloadConfig,
	validateNewConfig: validateNewConfig
};
