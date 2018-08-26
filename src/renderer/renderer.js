const {app, ipcRenderer} = require('electron');
const log = require('electron-log');

function formatBytes(bytesFirst, bytesSecond, decimals) {
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
  const k = 1024;

  var strFirst;
  var strSecond;
  var strUnit;

  if (bytesSecond == 0) {
    strFirst = '0';
    strSecond = '0';
    strUnit = sizes[0];
  } else {
    const i = Math.floor(Math.log(bytesSecond) / Math.log(k));
    const dm = decimals || 2;

    strFirst  = parseFloat(bytesFirst / Math.pow(k, i)).toFixed(dm);
    strSecond = parseFloat(bytesSecond / Math.pow(k, i)).toFixed(dm);
    strUnit   = sizes[i];

    strFirst = ' '.repeat(strSecond.indexOf(".") - strFirst.indexOf(".")) + strFirst;
    strFirst = strFirst + ' '.repeat(strSecond.length - strFirst.length)
  }


  return `${strFirst} / ${strSecond} ${strUnit}`;
}

let operationInProgress = false;
function setInProgress(state) {
  if (state) {
    document.getElementById("btn-progress").classList.add("is-loading");
    document.getElementById("config-select").setAttribute("disabled", "");
  } else {
    document.getElementById("btn-progress").classList.remove("is-loading");
    document.getElementById("config-select").removeAttribute("disabled");
  }
  operationInProgress = state;
}

function resetUI() {
  document.getElementById("progress-part").value = 0;
  document.getElementById("progress-full").value = 0;
  document.getElementById("progress-full").classList.remove("is-danger", "is-success");
  document.getElementById("progress-part").classList.remove("is-danger", "is-success");
  document.getElementById("progress-full").classList.add("is-primary");
  document.getElementById("progress-part").classList.add("is-primary");

  document.getElementById("lbl-progress-full").classList.remove("error");
  document.getElementById("lbl-progress-part").classList.remove("error");
  document.getElementById("lbl-progress-full").innerHTML = ''
  document.getElementById("lbl-progress-part").innerHTML = ''

  document.getElementById("btn-progress").classList.remove("is-warning");
  document.getElementById("btn-progress").classList.add("is-primary");
}

window.onload = function() {
  document.getElementById('btn-progress').addEventListener('click', (event) => {
    event.preventDefault();
    if (!operationInProgress) {
      document.getElementById("lbl-progress-full").classList.remove("error");
      document.getElementById("btn-progress").classList.remove("is-warning");
      ipcRenderer.send("wizard-next");
    }
  });

  document.getElementById('btn-show-log').addEventListener('click', (event) => {
    event.preventDefault();

    const win = require('electron').remote.getCurrentWindow()
    const cl = document.getElementById("note-content").classList;
    if (cl.contains("open")) {
      cl.remove("open");
      win.setSize(800, 380 + 30);
    } else {
      cl.add("open");
      win.setSize(800, 750);
    }
  });

  document.getElementById('config-select').addEventListener('change', (event) => {
    if (operationInProgress) {
      return;
    }
    const s = event.target;
    const selectedID = s[s.selectedIndex].id;
    const cfgName = selectedID.substring('cfg-'.length);
    ipcRenderer.send("change-cfg", cfgName);
  });
  // document.getElementById("btn-show-log").removeAttribute("tabIndex");
  // document.getElementById("btn-show-log").setAttribute("tabIndex", "-1");
  // document.getElementById('btn-show-log').addEventListener('focus', (event) => {
  //   event.preventDefault();
  //   console.log("ABC");
  //   this.blur();
  // });
}

//////////////////////////////
// Config events
//////////////////////////////

let config;
let allConfigs;

ipcRenderer.on("config", (e, c) => {
  config = c;

  let buttonText;
  if (config.no_downloads) {
    // TODO: add later
    if (config.auto_start && !operationInProgress  && false) {
      buttonText = "Starting...";
    } else {
      buttonText = "Start";
    }
  } else {
    // TODO: add later
    if (config.auto_download && !operationInProgress && false) {
      if (config.auto_start) {
        buttonText = "Updating and Starting...";
      } else {
        buttonText = "Updating...";
      }
    } else {
      if (config.auto_start) {
        buttonText = "Update & Start";
      } else {
        buttonText = "Update";
      }
    }
  }

  resetUI();
  document.getElementById("btn-progress").innerHTML = buttonText;

  // document.getElementById("current_config").innerHTML = `Config: ${config.package.display}`;
});

ipcRenderer.on("all-configs", (e, ac) => {
  allConfigs = ac;

  var cfgSelect = document.getElementById("config-select");

  allConfigs.forEach((cfg) => {
    var cfgElement = document.createElement("option");
    cfgElement.id = `cfg-${cfg.package.id}`;
    cfgElement.appendChild(document.createTextNode(cfg.package.display));

    cfgSelect.appendChild(cfgElement);
  });
});

//////////////////////////////
// Wizard events
//////////////////////////////

let steps;
let currentStep = 0;

ipcRenderer.on("wizard-list", (e, s) => {
  steps = s;
});

ipcRenderer.on("wizard-started", (e) => {
  currentStep = 0;
  setInProgress(true);
});

ipcRenderer.on("wizard-stopped", (e) => {
  setInProgress(false);
});

ipcRenderer.on("wizard-finished", (e) => {
  document.getElementById("btn-progress").innerHTML = "Start";
  document.getElementById("lbl-progress-full").innerHTML = 'Download complete'
  document.getElementById("lbl-progress-part").innerHTML = ''

  document.getElementById("progress-part").value = 100;
  document.getElementById("progress-full").value = 100;

  document.getElementById("progress-part").classList.remove("is-primary", "is-danger");
  document.getElementById("progress-part").classList.add("is-success");

  document.getElementById("progress-full").classList.remove("is-primary", "is-danger");
  document.getElementById("progress-full").classList.add("is-success");
  //document.getElementById("progress-part").value = parseInt(100 * currentStep / steps.length);
});

ipcRenderer.on("wizard-next-step", (e, step) => {
  document.getElementById("lbl-progress-part").innerHTML = '';
  document.getElementById("lbl-progress-full").innerHTML =
    `Step ${currentStep} of ${steps.length} Checking for download: ${step.name} `;
  document.getElementById("progress-full").value = parseInt(100 * currentStep / steps.length);
  currentStep++;
});

//////////////////////////////
// Download events
//////////////////////////////

ipcRenderer.on("dl-started", (e, downloadItem) => {
  document.getElementById("lbl-progress-full").innerHTML =
    `Step ${currentStep} of ${steps.length}: Downloading ${downloadItem} `;
    document.getElementById("progress-part").classList.remove("is-success", "is-danger");
    document.getElementById("progress-part").classList.add("is-primary");
});

ipcRenderer.on("dl-progress", (e, downloadItem, current, total) => {
  document.getElementById("progress-part").value = parseInt(100 * current / total);

  const step = currentStep + current / total - 1;
  document.getElementById("progress-full").value = parseInt(100 * step / steps.length);

  document.getElementById("lbl-progress-part").innerHTML = `${formatBytes(current, total)}`;
});

ipcRenderer.on("dl-finished", (e, downloadItem) => {
  document.getElementById("progress-part").value = 100;
  document.getElementById("progress-part").classList.remove("is-primary", "is-danger");
  document.getElementById("progress-part").classList.add("is-success");
});

ipcRenderer.on("dl-failed", (e, downloadItem, error) => {
  document.getElementById("lbl-progress-full").innerHTML =
    `Step ${currentStep} of ${steps.length}: Downloading ${downloadItem}: FAILED`;
  document.getElementById("error").innerHTML = error;

  document.getElementById("progress-full").classList.remove("is-primary");
  document.getElementById("progress-part").classList.remove("is-primary");

  document.getElementById("progress-full").classList.add("is-danger");
  document.getElementById("progress-part").classList.add("is-danger");
});

//////////////////////////////
// Launch events
//////////////////////////////

ipcRenderer.on("launch-started", (e) => {
  setInProgress(true);
  document.getElementById("lbl-progress-full").innerHTML = `Launching`;
});

ipcRenderer.on("launch-finished", (e) => {
});

ipcRenderer.on("launch-failed", (e, code) => {
  document.getElementById("lbl-progress-full").classList.add("error");
  document.getElementById("lbl-progress-full").innerHTML =
    `Failed to launch: see log`;
  // document.getElementById("progress-full").classList.add("is-danger");
  // document.getElementById("progress-full").value = 100;
  // document.getElementById("progress-part").classList.add("is-danger");
  // document.getElementById("progress-part").value = 100;

  setInProgress(false);
  document.getElementById("btn-progress").classList.add("is-warning");
});

//////////////////////////////
// Log events
//////////////////////////////

const {format} = require('util');
const util = require('util');
ipcRenderer.on("log", (e, msg) => {
  var para = document.createElement("p");
  var text = format.apply(util, msg.data);
  var node = document.createTextNode(`[${msg.date} ${msg.level}] ${text}`);
  para.appendChild(node);
  para.classList.add(msg.level);
  var element = document.getElementById("note-content");
  element.appendChild(para);
});
