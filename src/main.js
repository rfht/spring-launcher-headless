'use strict';

// Enable happy eyeballs for IPv6/IPv4 dual stack.
const net = require('node:net');
net.setDefaultAutoSelectFamily(true);

const { config } = require('./launcher_config');
//require('./worker/window');
const { wizard } = require('./launcher_wizard');
// Setup downloader bindings
require('./launcher_downloader');
const { generateAndBroadcastWizard } = require('./launcher_wizard_util');
// TODO: Despite not using it in this file, we have to require spring_api here
require('./spring_api');
const { launcher } = require('./engine_launcher');
const { writePath } = require('./spring_platform');
const file_opener = require('./file_opener');

launcher.on('stdout', (text) => {
	console.log("%s", text);
});

launcher.on('stderr', (text) => {
	console.log("%s", text);
});

launcher.on('finished', (code) => {
	console.log("Spring finished with code: %s", code);
	process.exit(0);
});

launcher.on('failed', (error) => {
	console.log("%s", error);
});

function maybeSetConfig(cfgName) {
	if (!config.setConfig(cfgName)) {
		return false;
	}

	settings.setSync('config', cfgName);
	generateAndBroadcastWizard();

	return true;
}

ipcMain.on('change-cfg', (_, cfgName) => {
	settings.setSync('checkForUpdates', undefined);
	if (maybeSetConfig(cfgName)) {
		wizard.setEnabled(true);
	}
});

ipcMain.on('log-upload-ask', () => {
	//log_uploader.upload_ask();
});

ipcMain.on('open-install-dir', () => {
	if (file_opener.open(writePath)) {
		console.log("User opened install directory: %s", writePath);
	} else {
		console.log("Failed to open install directory: %s", writePath);
	}
});

ipcMain.on('wizard-next', () => {
	wizard.nextStep(true);
});

ipcMain.on('wizard-check-for-updates', (_, checkForUpdates) => {
	if (checkForUpdates === settings.getSync('checkForUpdates')) {
		return;
	}
	//log.info('wizard-check-for-updates', checkForUpdates);
	console.log("wizard-check-for-updates");
	settings.setSync('checkForUpdates', checkForUpdates);
	generateAndBroadcastWizard();
});
