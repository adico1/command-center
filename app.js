const deviceForm = document.getElementById("device-form");
const commandForm = document.getElementById("command-form");
const deviceList = document.getElementById("device-list");
const commandList = document.getElementById("command-list");
const targetSelect = document.getElementById("command-target");
const askerForm = document.getElementById("asker-form");
const deviceBadge = document.getElementById("device-badge");
const installButton = document.getElementById("install-button");
const pairDeviceInput = document.getElementById("pair-device-id");
const qrCodeContainer = document.getElementById("qr-code");

function createDefaultState() {
  return {
    devices: [
      {
        id: crypto.randomUUID(),
        name: "Desk PC",
        role: "worker",
        capabilities: ["reboot", "report", "sync"],
      },
      {
        id: crypto.randomUUID(),
        name: "Server Relay",
        role: "relay",
        capabilities: ["reboot", "report", "sync"],
      },
      {
        id: crypto.randomUUID(),
        name: "Phone Alpha",
        role: "asker",
        capabilities: [],
      },
    ],
    commands: [
      {
        id: crypto.randomUUID(),
        target: "Desk PC",
        text: "report",
        token: "demo",
        status: "completed",
        note: "System snapshot delivered.",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function loadState() {
  const stored = localStorage.getItem("command-center-state");
  if (!stored) {
    const initialState = createDefaultState();
    saveState(initialState);
    return initialState;
  }

  try {
    return JSON.parse(stored);
  } catch {
    const initialState = createDefaultState();
    saveState(initialState);
    return initialState;
  }
}

function saveState(state) {
  localStorage.setItem("command-center-state", JSON.stringify(state));
}

function getState() {
  return loadState();
}

function getDeviceIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("device") || "phone-asker";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function interpretAction(text) {
  const normalized = String(text || "").toLowerCase();

  if (/reboot|restart/.test(normalized)) {
    return { action: "reboot", note: "Reboot requested by phone." };
  }

  if (/report|status|health/.test(normalized)) {
    return { action: "report", note: "Status report requested by phone." };
  }

  if (/sync|backup|copy/.test(normalized)) {
    return { action: "sync", note: "Synchronization requested by phone." };
  }

  return { action: "unknown", note: "Request recognized but no action matched." };
}

function routePhoneRequest(state, senderDeviceId, text) {
  const action = interpretAction(text);
  const relayDevice = state.devices.find((device) => device.role === "relay") || state.devices[0];
  const workerDevice = state.devices.find((device) => device.role === "worker") || state.devices[0];

  const request = {
    id: crypto.randomUUID(),
    target: relayDevice ? relayDevice.name : "Server Relay",
    text,
    token: `from:${senderDeviceId}`,
    status: "queued",
    note: `Phone request routed to ${workerDevice ? workerDevice.name : "Desk PC"}.`,
    createdAt: new Date().toISOString(),
    route: { from: senderDeviceId, action: action.action },
  };

  const workerCommand = {
    id: crypto.randomUUID(),
    target: workerDevice ? workerDevice.name : "Desk PC",
    text: `${action.action}: ${text}`,
    token: `relay:${request.id}`,
    status: "queued",
    note: `Forwarded by ${request.target} to ${workerDevice ? workerDevice.name : "Desk PC"}.`,
    createdAt: new Date().toISOString(),
    route: { from: senderDeviceId, action: action.action },
  };

  state.commands.push(request, workerCommand);
  return { request, workerCommand, action };
}

function renderDevices() {
  if (!deviceList) {
    return;
  }

  const state = getState();
  deviceList.innerHTML = "";

  if (!state.devices || !state.devices.length) {
    deviceList.innerHTML = '<li>No devices registered yet.</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.devices.forEach((device) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <div class="meta">
        <strong>${escapeHtml(device.name)}</strong>
        <span class="badge">${escapeHtml(device.role)}</span>
      </div>
      <div>${escapeHtml(device.capabilities.join(", ") || "No capabilities")}</div>
    `;
    fragment.appendChild(item);
  });

  deviceList.appendChild(fragment);
  populateTargets(state.devices);
}

function populateTargets(devices) {
  if (!targetSelect) {
    return;
  }

  targetSelect.innerHTML = "";
  devices.forEach((device) => {
    if (device.role === "worker") {
      const option = document.createElement("option");
      option.value = device.name;
      option.textContent = device.name;
      targetSelect.appendChild(option);
    }
  });
}

function renderCommands() {
  if (!commandList) {
    return;
  }

  const state = getState();
  commandList.innerHTML = "";

  if (!state.commands || !state.commands.length) {
    commandList.innerHTML = '<li>No commands yet.</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.commands.slice().reverse().forEach((command) => {
    const item = document.createElement("li");
    const statusClass = command.status === "completed"
      ? ""
      : command.status === "declined"
        ? "fail"
        : "warn";
    item.innerHTML = `
      <div class="meta">
        <strong>${escapeHtml(command.target)}</strong>
        <span class="badge ${statusClass}">${escapeHtml(command.status)}</span>
      </div>
      <div>${escapeHtml(command.text)} · ${escapeHtml(command.token || "—")}</div>
      <div>${escapeHtml(command.note)}</div>
    `;
    fragment.appendChild(item);
  });

  commandList.appendChild(fragment);
}

function installAppPrompt() {
  if (!installButton) {
    return;
  }

  installButton.addEventListener("click", () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.deferredPrompt = event;
    installButton.style.display = "inline-block";
  });
}

function setupAskerExperience() {
  if (!askerForm || !deviceBadge) {
    return;
  }

  const deviceId = getDeviceIdFromUrl();
  deviceBadge.textContent = `Device: ${escapeHtml(deviceId)}`;

  askerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const state = getState();
    const formData = new FormData(askerForm);
    const text = String(formData.get("text") || "").trim();

    if (!text) {
      return;
    }

    const routed = routePhoneRequest(state, deviceId, text);
    saveState(state);
    renderCommands();
    askerForm.reset();

    window.setTimeout(() => {
      const latestState = getState();
      const latestRequest = latestState.commands.find((item) => item.id === routed.request.id);
      const latestWorkerCommand = latestState.commands.find((item) => item.id === routed.workerCommand.id);

      if (latestRequest) {
        latestRequest.status = "completed";
        latestRequest.note = `${routed.action.note} Action: ${routed.action.action}`;
      }

      if (latestWorkerCommand) {
        latestWorkerCommand.status = "completed";
        latestWorkerCommand.note = `Executed on ${latestWorkerCommand.target}: ${routed.action.action}`;
      }

      saveState(latestState);
      renderCommands();
    }, 1000);
  });
}

function updatePairingQr() {
  if (!pairDeviceInput || !qrCodeContainer || !window.QRCode) {
    return;
  }

  const deviceId = (pairDeviceInput.value || "desk-pc").trim() || "desk-pc";
  const url = new URL("asker.html", window.location.href);
  url.searchParams.set("device", deviceId);

  qrCodeContainer.innerHTML = "";
  const canvas = document.createElement("canvas");
  qrCodeContainer.appendChild(canvas);

  window.QRCode.toCanvas(canvas, url.toString(), { width: 220, margin: 1 }, (error) => {
    if (error) {
      qrCodeContainer.innerHTML = `<p class="hint">QR unavailable: ${escapeHtml(error.message || "unknown")}</p>`;
    }
  });
}

if (deviceForm) {
  deviceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const state = getState();
    const formData = new FormData(deviceForm);
    const name = String(formData.get("name") || "").trim();
    const role = String(formData.get("role") || "asker");
    const capabilities = String(formData.get("capabilities") || "")
      .split(",")
      .map((cap) => cap.trim())
      .filter(Boolean);

    if (!name) {
      return;
    }

    state.devices.push({
      id: crypto.randomUUID(),
      name,
      role,
      capabilities,
    });

    saveState(state);
    deviceForm.reset();
    renderDevices();
    renderCommands();
  });
}

if (commandForm) {
  commandForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const state = getState();
    const formData = new FormData(commandForm);
    const targetName = String(formData.get("target") || "").trim();
    const text = String(formData.get("text") || "").trim();
    const token = String(formData.get("token") || "").trim();

    if (!targetName || !text) {
      return;
    }

    const targetDevice = state.devices.find((device) => device.name === targetName);
    if (!targetDevice || targetDevice.role !== "worker") {
      return;
    }

    const commandText = text.toLowerCase();
    const capabilityList = targetDevice.capabilities.map((cap) => cap.toLowerCase());
    const isSupported = capabilityList.some((cap) => commandText.includes(cap));

    const queuedCommand = {
      id: crypto.randomUUID(),
      target: targetDevice.name,
      text,
      token,
      status: "queued",
      note: "Waiting for contract review.",
      createdAt: new Date().toISOString(),
    };

    state.commands.push(queuedCommand);
    saveState(state);
    renderCommands();

    window.setTimeout(() => {
      const latestState = getState();
      const latestCommand = latestState.commands.find((item) => item.id === queuedCommand.id);
      if (!latestCommand) {
        return;
      }

      if (isSupported && token) {
        latestCommand.status = "completed";
        latestCommand.note = `Accepted and executed on ${targetDevice.name}.`;
      } else {
        latestCommand.status = "declined";
        latestCommand.note = `Contract rejected: ${text} is not in the approved capability set.`;
      }

      saveState(latestState);
      renderCommands();
    }, 900);
  });
}

if (pairDeviceInput) {
  pairDeviceInput.addEventListener("input", updatePairingQr);
}

function init() {
  renderDevices();
  renderCommands();
  installAppPrompt();
  setupAskerExperience();
  updatePairingQr();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createDefaultState,
    loadState,
    saveState,
    getDeviceIdFromUrl,
    escapeHtml,
    interpretAction,
    routePhoneRequest,
    renderDevices,
    renderCommands,
    setupAskerExperience,
    updatePairingQr,
    init,
  };
} else {
  init();
}
