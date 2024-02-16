'use strict';

//const shell = require('electron').shell;
// https://stackoverflow.com/questions/8500326/how-to-use-nodejs-to-open-default-browser-and-navigate-to-a-specific-url
const open = require('open');

module.exports.open = async (path) => {
	await open(path);
	/*
	if (path.match(/^https?:\/\/.*$/) ||
		path.match(/^file:\/\/\/.*$/)) {
		await shell.openExternal(path);
	} else {
		await shell.openPath(path);
	}
	*/
};
