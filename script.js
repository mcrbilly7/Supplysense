// script.js
// Shared frontend logic for SupplySense AI

document.addEventListener("DOMContentLoaded", () => {
  highlightActiveNavLink();
  setupSideNavToggle();
  setupScannerPage();
});

/**
 * Highlight current nav link based on URL
 */
function highlightActiveNavLink() {
  const path = window.location.pathname;
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && path.endsWith(href)) {
      link.classList.add("nav-link-active");
    }
  });
}

/**
 * Mobile/side nav toggle
 */
function setupSideNavToggle() {
  const toggle = document.getElementById("side-nav-toggle");
  const menu = document.getElementById("side-nav-menu");

  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.contains("side-nav-open");
    if (isOpen) {
      menu.classList.remove("side-nav-open");
    } else {
      menu.classList.add("side-nav-open");
    }
  });
}

/**
 * Scanner page logic – calls /api/scan and renders the Trust Score results
 */
function setupScannerPage() {
  const urlInput = document.getElementById("scan-url-input");
  const scanButton = document.getElementById("scan-submit");
  const errorEl = document.getElementById("scan-error");
  const statusEl = document.getElementById("scan-status");
  const resultsContainer = document.getElementById("scan-results-container");

  if (!urlInput || !scanButton) {
    // Not on scanner.html
    return;
  }

  scanButton.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    clearScanMessages(errorEl, statusEl);

    if (!url) {
      showError(errorEl, "Please paste a supplier or product URL.");
      return;
    }

    statusEl.style.display = "block";
    statusEl.textContent = "Analyzing supplier…";

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Scan failed. Please try again.");
      }

      const data = await response.json();
      statusEl.style.display = "none";

      renderScanResults(data, resultsContainer);
    } catch (err) {
      console.error("Scan error:", err);
      statusEl.style.display = "none";
      showError(errorEl, err.message || "Unable to scan this supplier right now.");
    }
  });
}

function clearScanMessages(errorEl, statusEl) {
  if (errorEl) {
    errorEl.style.display = "none";
    errorEl.textContent = "";
  }
  if (statusEl) {
    statusEl.style.display = "none";
    statusEl.textContent = "";
  }
}

function showError(errorEl, message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = "block";
}

/**
 * Fill in all the metrics and lists from /api/scan response
 */
function renderScanResults(data, container) {
  if (!container || !data || !data.scoring) return;

  const { url, platform, scoring, alternatives } = data;

  // Show container
  container.style.display = "grid";

  // Basic fields
  const urlEl = document.getElementById("scan-results-url");
  const platformEl = document.getElementById("scan-results-platform");
  const scoreEl = document.getElementById("scan-results-score");
  const labelEl = document.getElementById("scan-results-label");

  if (urlEl) urlEl.textContent = url || "";
  if (platformEl) platformEl.textContent = platform ? `Platform: ${platform}` : "Platform: Unknown";
  if (scoreEl) scoreEl.textContent = scoring.overall ?? "--";
  if (labelEl) labelEl.textContent = scoring.riskLabel ?? "–";

  // Metric fields
  const shipEl = document.getElementById("scan-metric-shipping");
  const qualEl = document.getElementById("scan-metric-quality");
  const commEl = document.getElementById("scan-metric-communication");
  const stabEl = document.getElementById("scan-metric-stability");

  if (shipEl) shipEl.textContent = scoring.shipping ?? "--";
  if (qualEl) qualEl.textContent = scoring.quality ?? "--";
  if (commEl) commEl.textContent = scoring.communication ?? "--";
  if (stabEl) stabEl.textContent = scoring.stability ?? "--";

  // Summary text
  const summaryEl = document.getElementById("scan-summary-text");
  if (summaryEl) {
    summaryEl.textContent = scoring.summary || "";
  }

  // Warnings list
  const warningsListEl = document.getElementById("scan-warnings-list");
  if (warningsListEl) {
    warningsListEl.innerHTML = "";
    const warnings = scoring.warnings || [];
    if (warnings.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No major risks detected based on current data.";
      warningsListEl.appendChild(li);
    } else {
      warnings.forEach((w) => {
        const li = document.createElement("li");
        li.textContent = w;
        warningsListEl.appendChild(li);
      });
    }
  }

  // Alternatives
  const altsEl = document.getElementById("scan-alternatives-list");
  if (altsEl) {
    altsEl.innerHTML = "";
    const alts = alternatives || [];
    if (alts.length === 0) {
      const div = document.createElement("div");
      div.className = "alternative-card";
      div.textContent = "No alternatives suggested yet.";
      altsEl.appendChild(div);
    } else {
      alts.forEach((alt) => {
        const card = document.createElement("div");
        card.className = "alternative-card";
        card.innerHTML = `
          <div class="alt-name">${alt.name}</div>
          <div class="alt-platform">${alt.platform || ""}</div>
          <div class="alt-score">Trust Score: ${alt.trustScore ?? "--"}</div>
          <div class="alt-note">${alt.note || ""}</div>
        `;
        altsEl.appendChild(card);
      });
    }
  }
}
