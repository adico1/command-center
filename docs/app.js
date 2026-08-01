const deviceForm = document.getElementById("device-form");
const commandForm = document.getElementById("command-form");
const deviceList = document.getElementById("device-list");
const commandList = document.getElementById("command-list");
const targetSelect = document.getElementById("command-target");

const defaultState = {
  devices: [
    {
      id: crypto.randomUUID(),
      name: "Desk PC",
      role: "worker",
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

function loadState() {
  const stored = localStorage.getItem("command-center-state");
  if (!stored) {
    return defaultState;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return defaultState;
  }
}

function saveState(state) {
  localStorage.setItem("command-center-state", JSON.stringify(state));
}

function getState() {
  return loadState();
}

function renderDevices() {
  const state = getState();
  deviceList.innerHTML = "";

  if (!state.devices.length) {
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
  const state = getState();
  commandList.innerHTML = "";

  if (!state.commands.length) {
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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

renderDevices();
renderCommands();
