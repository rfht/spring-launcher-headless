'use strict';

const { ipcRenderer } = require('electron');
const isDev = !require('@electron/remote').app.isPackaged;

const btnShowDir = document.getElementById('btn-show-dir');
const lblMainTitle = document.getElementById('title');
const footerLinks = document.getElementById('footerLinks');

btnShowDir.addEventListener('click', () => {
	ipcRenderer.send('open-install-dir');
});

function updateLinks(links) {
	footerLinks.replaceChildren(
		...links.map(({url, title}) => {
			const link = document.createElement('a');
			link.href = url;
			link.target = '_blank';
			link.innerText = title;
			return link;
		})
	);
}

function setMainTitle(title) {
	if (isDev) {
		title = `${title} (DEV)`;
	}
	lblMainTitle.innerText = title;
}

module.exports = {
	updateLinks,
	setMainTitle,
};

// Prevent all buttons from staying focused.
for (const btn of document.querySelectorAll('button')) {
	btn.addEventListener('focus', () => btn.blur());
}
