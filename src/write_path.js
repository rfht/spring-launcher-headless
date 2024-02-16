const path = require('path');
const fs = require('fs');
const platformName = process.platform;

function resolveWritePath(title) {
	const argv = require('./launcher_args');
	if (argv.writePath != null) {
		return argv.writePath;
	}

	if (process.env.PORTABLE_EXECUTABLE_DIR != null) {
		return path.join(process.env.PORTABLE_EXECUTABLE_DIR, title);
	}

	const xdgStateHome = process.env.XDG_STATE_HOME || path.join(process.env.HOME, '.local/state');
	return path.join(xdgStateHome, title);
}

module.exports = {
	resolveWritePath: resolveWritePath
};
