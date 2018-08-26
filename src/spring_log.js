const { app } = require('electron');
const util = require('util');
const { format } = util;

const log = require('electron-log');

const { gui } = require('./launcher_gui.js');

let mainWindow;

log.transports.file.level = 'info';
var logBuffer = [];
var ready = false;

log.transports.console = (msg) => {
  var text = format.apply(util, msg.data);
  console.log(text);
  if (ready) {
    mainWindow.send("log", msg)
  } else {
    logBuffer.push(msg);
  }
}

app.on('ready', () => {
  mainWindow = gui.getMainWindow();

  setTimeout(() => {
    logBuffer.forEach((msg) => {
      mainWindow.send("log", msg)
    });
    logBuffer = [];
    ready = true;
  }, 1000);
})

module.exports = {
  log: log
}
