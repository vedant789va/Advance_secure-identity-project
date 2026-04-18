const state = {
  users: [],
  transactions: [],
  auditChain: []
};

const refs = {
  identityForm: document.getElementById("identityForm"),
  txForm: document.getElementById("txForm"),
  txUser: document.getElementById("txUser"),
  identityResult: document.getElementById("identityResult"),
  txResult: document.getElementById("txResult"),
  statUsers: document.getElementById("statUsers"),
  statTransactions: document.getElementById("statTransactions"),
  statBlocked: document.getElementById("statBlocked"),
  decisionList: document.getElementById("decisionList"),
  auditList: document.getElementById("auditList"),
  riskChart: document.getElementById("riskChart"),
  seedDemo: document.getElementById("seedDemo")
};

function pseudoHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `SID-${Math.abs(hash).toString(16).toUpperCase().padStart(8, "0")}`;
}

function addAudit(eventType, payload) {
  const prev = state.auditChain.length ? state.auditChain[state.auditChain.length - 1].hash : "GENESIS";
  const body = `${eventType}|${JSON.stringify(payload)}|${new Date().toISOString()}|${prev}`;
  const hash = pseudoHash(body);
  state.auditChain.push({ eventType, hash, prev, at: new Date().toLocaleTimeString() });
}

function decisionFromRisk(score) {
  if (score < 35) return { label: "Approved", className: "status-ok" };
  if (score < 65) return { label: "Manual Review", className: "status-review" };
  return { label: "Blocked", className: "status-block" };
}

function computeIdentityTrust({ biometric, deviceId, email }) {
  let trust = biometric;
  if (deviceId.toUpperCase().startsWith("DVC")) trust += 5;
  if (email.endsWith(".edu") || email.endsWith(".org")) trust += 3;
  return Math.max(0, Math.min(100, trust));
}

function computeRisk({ amount, location, destination, user }) {
  let risk = 0;
  if (amount > 10000) risk += 35;
  else if (amount > 5000) risk += 20;
  else if (amount > 2000) risk += 10;

  if (/[0-9]{6,}/.test(destination)) risk += 20;
  if (location.trim().toLowerCase() !== user.lastLocation.trim().toLowerCase()) risk += 15;
  if (user.trustScore < 78) risk += 20;

  risk += Math.floor(Math.random() * 12);
  return Math.max(0, Math.min(100, risk));
}

function refreshUsersDropdown() {
  refs.txUser.innerHTML = "";
  if (!state.users.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No users yet";
    refs.txUser.appendChild(opt);
    return;
  }

  state.users.forEach((user) => {
    const opt = document.createElement("option");
    opt.value = user.id;
    opt.textContent = `${user.name} (${user.identityToken})`;
    refs.txUser.appendChild(opt);
  });
}

function refreshStats() {
  const blocked = state.transactions.filter((t) => t.decision.label === "Blocked").length;
  refs.statUsers.textContent = String(state.users.length);
  refs.statTransactions.textContent = String(state.transactions.length);
  refs.statBlocked.textContent = String(blocked);
}

function refreshDecisionList() {
  refs.decisionList.innerHTML = "";
  const latest = [...state.transactions].reverse().slice(0, 8);
  latest.forEach((tx) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${tx.userName}</strong> sent <strong>INR ${tx.amount}</strong> to ${tx.destination}<br><span class="${tx.decision.className}">${tx.decision.label}</span> | Risk ${tx.riskScore}% | ${tx.time}`;
    refs.decisionList.appendChild(li);
  });
}

function refreshAuditList() {
  refs.auditList.innerHTML = "";
  const latest = [...state.auditChain].reverse().slice(0, 8);
  latest.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.at} | ${item.eventType} | ${item.hash} -> ${item.prev}`;
    refs.auditList.appendChild(li);
  });
}

function drawRiskChart() {
  const ctx = refs.riskChart.getContext("2d");
  const low = state.transactions.filter((t) => t.riskScore < 35).length;
  const medium = state.transactions.filter((t) => t.riskScore >= 35 && t.riskScore < 65).length;
  const high = state.transactions.filter((t) => t.riskScore >= 65).length;
  const values = [low, medium, high];
  const labels = ["Low", "Medium", "High"];
  const colors = ["#16a34a", "#f59e0b", "#dc2626"];

  ctx.clearRect(0, 0, refs.riskChart.width, refs.riskChart.height);

  const total = Math.max(1, values.reduce((a, b) => a + b, 0));
  const barWidth = 90;
  const gap = 35;
  const baseX = 20;
  const maxHeight = 110;

  values.forEach((v, idx) => {
    const h = (v / total) * maxHeight;
    const x = baseX + idx * (barWidth + gap);
    const y = 135 - h;

    ctx.fillStyle = colors[idx];
    ctx.fillRect(x, y, barWidth, h);

    ctx.fillStyle = "#0b1d30";
    ctx.font = "600 14px Space Grotesk";
    ctx.fillText(labels[idx], x + 25, 158);

    ctx.font = "700 16px Space Grotesk";
    ctx.fillText(String(v), x + 38, y - 8);
  });
}

function refreshUI() {
  refreshUsersDropdown();
  refreshStats();
  refreshDecisionList();
  refreshAuditList();
  drawRiskChart();
}

refs.identityForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const deviceId = document.getElementById("deviceId").value.trim();
  const biometric = Number(document.getElementById("biometric").value);

  const trustScore = computeIdentityTrust({ biometric, deviceId, email });
  const identityToken = pseudoHash(`${name}|${email}|${deviceId}|${Date.now()}`);
  const id = `U-${Date.now()}`;

  const user = {
    id,
    name,
    email,
    deviceId,
    biometric,
    trustScore,
    identityToken,
    lastLocation: "bengaluru"
  };

  state.users.push(user);
  addAudit("IDENTITY_CREATED", { id, identityToken, trustScore });

  refs.identityResult.innerHTML = `
    <strong>Identity created successfully.</strong><br>
    Token: <code>${identityToken}</code><br>
    Adaptive Trust Score: <strong>${trustScore}/100</strong>
  `;

  refs.identityForm.reset();
  document.getElementById("biometric").value = 89;
  refreshUI();
});

refs.txForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.users.length) {
    refs.txResult.textContent = "Create at least one user before processing transactions.";
    return;
  }

  const userId = refs.txUser.value;
  const user = state.users.find((u) => u.id === userId) || state.users[0];
  const amount = Number(document.getElementById("txAmount").value);
  const destination = document.getElementById("txDestination").value.trim();
  const location = document.getElementById("txLocation").value.trim();

  const riskScore = computeRisk({ amount, location, destination, user });
  const decision = decisionFromRisk(riskScore);

  const tx = {
    id: `TX-${Date.now()}`,
    userId,
    userName: user.name,
    amount,
    destination,
    location,
    riskScore,
    decision,
    time: new Date().toLocaleTimeString()
  };

  state.transactions.push(tx);
  addAudit("TRANSACTION_PROCESSED", {
    txId: tx.id,
    user: tx.userName,
    amount: tx.amount,
    riskScore,
    decision: decision.label
  });

  user.lastLocation = location;

  refs.txResult.innerHTML = `
    Risk Score: <strong>${riskScore}%</strong><br>
    Decision: <span class="${decision.className}">${decision.label}</span><br>
    Confidence Engine: ${Math.max(55, 100 - riskScore)}%
  `;

  refs.txForm.reset();
  document.getElementById("txAmount").value = 1500;
  refreshUI();
});

refs.seedDemo.addEventListener("click", () => {
  const demoUsers = [
    { name: "Aarav Rao", email: "aarav@campus.edu", deviceId: "DVC-1199", biometric: 93 },
    { name: "Nisha Mehta", email: "nisha@secure.org", deviceId: "DVC-8081", biometric: 87 }
  ];

  demoUsers.forEach((entry) => {
    const trustScore = computeIdentityTrust(entry);
    const identityToken = pseudoHash(`${entry.name}|${entry.email}|${entry.deviceId}|${Math.random()}`);
    const user = {
      id: `U-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...entry,
      trustScore,
      identityToken,
      lastLocation: "bengaluru"
    };
    state.users.push(user);
    addAudit("IDENTITY_CREATED", { id: user.id, identityToken, trustScore });
  });

  const demoTx = [
    { amount: 1200, destination: "BookStore-A1", location: "Bengaluru" },
    { amount: 7800, destination: "Merchant-782992", location: "Mumbai" },
    { amount: 3200, destination: "Cafe-Line", location: "Bengaluru" }
  ];

  demoTx.forEach((tx, i) => {
    const user = state.users[i % state.users.length];
    const riskScore = computeRisk({ ...tx, user });
    const decision = decisionFromRisk(riskScore);
    const record = {
      id: `TX-${Date.now()}-${i}`,
      userId: user.id,
      userName: user.name,
      ...tx,
      riskScore,
      decision,
      time: new Date().toLocaleTimeString()
    };
    state.transactions.push(record);
    addAudit("TRANSACTION_PROCESSED", {
      txId: record.id,
      user: record.userName,
      amount: record.amount,
      riskScore,
      decision: decision.label
    });
  });

  refs.identityResult.innerHTML = "Demo users added. Identity engine is active.";
  refs.txResult.innerHTML = "Demo transactions processed. Risk chart updated.";
  refreshUI();
});

refreshUI();
