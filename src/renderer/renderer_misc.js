'use strict';

const { ipcRenderer } = require('electron');
const isDev = !require('@electron/remote').app.isPackaged;

const btnShowDir = document.getElementById('btn-show-dir');
const lblMainTitle = document.getElementById('title');

btnShowDir.addEventListener('click', () => {
	ipcRenderer.send('open-install-dir');
});

module.exports = {
	setMainTitle: (title) => {
		if (isDev) {
			title = `${title} (DEV)`;
		}
		lblMainTitle.innerHTML = title;
	}
};

// Prevent all buttons from staying focused.
for (const btn of document.querySelectorAll('button')) {
	btn.addEventListener('focus', () => btn.blur());
}
