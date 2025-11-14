// script.js – Shared frontend logic for SupplySense AI

document.addEventListener("DOMContentLoaded", () => {
  highlightActiveNavLink();
  setupSideNavToggle();
  setupAuthTabs();
  setupAuthForms();
  setupScannerPage();
  setupDashboard();
  setupMarketplace();
});

/**
 * Highlight current nav link based on URL
 */
function highlightActiveNavLink() {
  const path = window.location.pathname;
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    if (path.endsWith(href)) {
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
    menu.classList.toggle("side-nav-open");
  });
}

/**
 * Landing auth tabs (Log in / Sign up)
 */
function setupAuthTabs() {
  const tabs = document.querySelectorAll(".auth-tab");
  const forms = document.querySelectorAll(".auth-form");
  if (!tabs.length || !forms.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.authTab;
      tabs.forEach((t) => t.classList.remove("auth-tab-active"));
      tab.classList.add("auth-tab-active");

      forms.forEach((form) => {
        if (form.id === `${target}-form`) {
          form.classList.add("auth-form-active");
        } else {
          form.classList.remove("auth-form-active");
        }
      });
    });
  });
}

/**
 * Fake auth forms (localStorage) – for demo and navigation
 */
function setupAuthForms() {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("signup-name")?.value || "";
      const email = document.getElementById("signup-email")?.value || "";
      const password = document.getElementById("signup-password")?.value || "";

      if (!email || !password) {
        alert("Please fill out all required fields.");
        return;
      }

      const user = {
        name: name || "SupplySense User",
        email,
        password,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem("supplysenseUser", JSON.stringify(user));
      alert("Account created! Redirecting to your dashboard...");
      window.location.href = "dashboard.html";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email")?.value || "";
      const password = document.getElementById("login-password")?.value || "";

      if (!email || !password) {
        alert("Please enter your email and password.");
        return;
      }

      const stored = localStorage.getItem("supplysenseUser");
      if (!stored) {
        alert("No local account found. Please sign up first.");
        return;
      }

      const user = JSON.parse(stored);
      if (user.email === email && user.password === password) {
        alert("Welcome back! Taking you to your dashboard...");
        window.location.href = "dashboard.html";
      } else {
        alert("Incorrect email or password.");
      }
    });
  }
}

/**
 * Scanner page: call /api/scan and show trust score
 */
function setupScannerPage() {
  const urlInput = document.getElementById("scan-url-input");
  const scanButton = document.getElementById("scan-submit");
  const errorEl = document.getElementById("scan-error");
  const statusEl = document.getElementById("scan-status");
  const resultsContainer = document.getElementById("scan-results-container");

  if (!urlInput || !scanButton) return;

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
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Scan failed. Please try again.");
      }

      const data = await response.json();
      statusEl.style.display = "none";

      renderScanResults(data, resultsContainer);
      saveScanToLocal(data);
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

function showError(errorEl, msg) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.style.display = "block";
}

function renderScanResults(data, container) {
  if (!data || !data.scoring) return;
  if (container) container.style.display = "block";

  const { url, platform, scoring, alternatives } = data;

  const urlEl = document.getElementById("scan-results-url");
  const platformEl = document.getElementById("scan-results-platform");
  const scoreEl = document.getElementById("scan-results-score");
  const labelEl = document.getElementById("scan-results-label");

  if (urlEl) urlEl.textContent = url || "";
  if (platformEl) platformEl.textContent = platform ? `Platform: ${platform}` : "Platform: Unknown";
  if (scoreEl) scoreEl.textContent = scoring.overall ?? "--";
  if (labelEl) labelEl.textContent = scoring.riskLabel ?? "–";

  const shipEl = document.getElementById("scan-metric-shipping");
  const qualEl = document.getElementById("scan-metric-quality");
  const commEl = document.getElementById("scan-metric-communication");
  const stabEl = document.getElementById("scan-metric-stability");

  if (shipEl) shipEl.textContent = scoring.shipping ?? "--";
  if (qualEl) qualEl.textContent = scoring.quality ?? "--";
  if (commEl) commEl.textContent = scoring.communication ?? "--";
  if (stabEl) stabEl.textContent = scoring.stability ?? "--";

  const summaryEl = document.getElementById("scan-summary-text");
  if (summaryEl) summaryEl.textContent = scoring.summary || "";

  const warningsListEl = document.getElementById("scan-warnings-list");
  if (warningsListEl) {
    warningsListEl.innerHTML = "";
    const warnings = scoring.warnings || [];
    if (!warnings.length) {
      const li = document.createElement("li");
      li.textContent = "No major risks detected based on current metrics.";
      warningsListEl.appendChild(li);
    } else {
      warnings.forEach((w) => {
        const li = document.createElement("li");
        li.textContent = w;
        warningsListEl.appendChild(li);
      });
    }
  }

  const altsEl = document.getElementById("scan-alternatives-list");
  if (altsEl) {
    altsEl.innerHTML = "";
    const alts = alternatives || [];
    if (!alts.length) {
      const div = document.createElement("div");
      div.className = "alternative-card";
      div.textContent = "No alternative suppliers suggested yet.";
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

/**
 * Store last few scans locally for dashboard
 */
function saveScanToLocal(data) {
  try {
    const existing = JSON.parse(localStorage.getItem("supplysenseScans") || "[]");
    const entry = {
      url: data.url,
      platform: data.platform,
      overall: data.scoring?.overall ?? null,
      riskLabel: data.scoring?.riskLabel ?? null,
      timestamp: new Date().toISOString()
    };
    const updated = [entry, ...existing].slice(0, 5);
    localStorage.setItem("supplysenseScans", JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not save scan locally", e);
  }
}

/**
 * Dashboard: greet user + show recent scans (from localStorage)
 */
function setupDashboard() {
  const greetingEl = document.getElementById("dashboard-greeting");
  const recentListEl = document.getElementById("recent-scans-list");
  const emptyStateEl = document.getElementById("recent-scans-empty");
  const scanCountEl = document.getElementById("snapshot-scan-count");
  const highRiskCountEl = document.getElementById("snapshot-high-risk-count");

  if (!greetingEl && !recentListEl && !emptyStateEl) return;

  // Greeting from user
  try {
    const storedUser = localStorage.getItem("supplysenseUser");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      const name = user.name || "there";
      greetingEl.textContent = `Welcome back, ${name}`;
    }
  } catch (e) {
    // ignore
  }

  // Recent scans
  try {
    const scans = JSON.parse(localStorage.getItem("supplysenseScans") || "[]");
    if (scanCountEl) scanCountEl.textContent = scans.length.toString();

    const highRisk = scans.filter((s) => s.riskLabel === "RISKY" || s.riskLabel === "AVOID");
    if (highRiskCountEl) highRiskCountEl.textContent = highRisk.length.toString();

    if (!scans.length) {
      if (emptyStateEl) emptyStateEl.style.display = "block";
      if (recentListEl) recentListEl.innerHTML = "";
      return;
    }

    if (emptyStateEl) emptyStateEl.style.display = "none";
    if (!recentListEl) return;

    recentListEl.innerHTML = "";
    scans.forEach((scan) => {
      const li = document.createElement("li");
      li.className = "recent-scan-item";
      li.innerHTML = `
        <div class="recent-scan-main">
          <div class="recent-scan-url">${scan.url}</div>
          <div class="recent-scan-platform">${scan.platform || ""}</div>
        </div>
        <div class="recent-scan-meta">
          <span class="recent-scan-score">${scan.overall ?? "--"}</span>
          <span class="recent-scan-label">${scan.riskLabel ?? ""}</span>
        </div>
      `;
      recentListEl.appendChild(li);
    });
  } catch (e) {
    console.warn("Could not load recent scans", e);
  }
}

/**
 * Marketplace: product search & filter mock data
 */
const SUPPLIER_DATA = [
  {
    id: 1,
    productKeyword: "led dog collar",
    productName: "LED Dog Collar – USB Rechargeable",
    supplierName: "Shenzhen PetLights Co.",
    platform: "ALIEXPRESS",
    region: "US",
    minShippingDays: 7,
    maxShippingDays: 14,
    minPrice: 6.5,
    maxPrice: 9.0,
    rating: 4.7,
    trustScore: 91,
    branding: true
  },
  {
    id: 2,
    productKeyword: "led dog collar",
    productName: "Glow-in-the-Dark Pet Collar",
    supplierName: "Guangzhou NightPet Factory",
    platform: "1688",
    region: "US",
    minShippingDays: 12,
    maxShippingDays: 20,
    minPrice: 3.2,
    maxPrice: 5.5,
    rating: 4.3,
    trustScore: 82,
    branding: false
  },
  {
    id: 3,
    productKeyword: "posture corrector",
    productName: "Adjustable Back Posture Corrector",
    supplierName: "Ningbo HealthGear",
    platform: "ALIBABA",
    region: "EU",
    minShippingDays: 10,
    maxShippingDays: 18,
    minPrice: 4.0,
    maxPrice: 7.0,
    rating: 4.5,
    trustScore: 87,
    branding: true
  },
  {
    id: 4,
    productKeyword: "posture corrector",
    productName: "Premium Posture Brace with Padding",
    supplierName: "WellnessPro Supplies",
    platform: "CJ_DROPSHIPPING",
    region: "US",
    minShippingDays: 5,
    maxShippingDays: 9,
    minPrice: 9.0,
    maxPrice: 14.0,
    rating: 4.8,
    trustScore: 94,
    branding: true
  },
  {
    id: 5,
    productKeyword: "wireless earbuds",
    productName: "Wireless Earbuds with Charging Case",
    supplierName: "Shenzhen AudioTech",
    platform: "ALIEXPRESS",
    region: "EU",
    minShippingDays: 9,
    maxShippingDays: 16,
    minPrice: 11.0,
    maxPrice: 18.0,
    rating: 4.2,
    trustScore: 79,
    branding: false
  }
];

function setupMarketplace() {
  const searchInput = document.getElementById("product-search-input");
  const searchBtn = document.getElementById("product-search-btn");
  const shippingFilter = document.getElementById("filter-shipping");
  const priceFilter = document.getElementById("filter-price");
  const ratingFilter = document.getElementById("filter-rating");
  const regionFilter = document.getElementById("filter-region");
  const resultsEl = document.getElementById("supplier-results");
  const emptyEl = document.getElementById("supplier-results-empty");

  if (!resultsEl || !searchInput || !searchBtn) return;

  const runSearch = () => {
    const query = searchInput.value.trim().toLowerCase();
    const maxShipping = shippingFilter?.value || "";
    const priceRange = priceFilter?.value || "";
    const minRating = ratingFilter?.value ? parseFloat(ratingFilter.value) : null;
    const region = regionFilter?.value || "";

    let filtered = SUPPLIER_DATA;

    if (query) {
      filtered = filtered.filter((s) =>
        s.productKeyword.toLowerCase().includes(query) ||
        s.productName.toLowerCase().includes(query)
      );
    }

    if (maxShipping) {
      const maxShipInt = parseInt(maxShipping, 10);
      filtered = filtered.filter((s) => s.maxShippingDays <= maxShipInt);
    }

    if (priceRange) {
      if (priceRange === "low") {
        filtered = filtered.filter((s) => s.minPrice < 10);
      } else if (priceRange === "mid") {
        filtered = filtered.filter((s) => s.minPrice >= 10 && s.minPrice <= 30);
      } else if (priceRange === "high") {
        filtered = filtered.filter((s) => s.minPrice > 30);
      }
    }

    if (minRating != null) {
      filtered = filtered.filter((s) => s.rating >= minRating);
    }

    if (region) {
      filtered = filtered.filter((s) => s.region === region);
    }

    renderSupplierResults(filtered, resultsEl, emptyEl, !!query);
  };

  searchBtn.addEventListener("click", runSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  });

  [shippingFilter, priceFilter, ratingFilter, regionFilter].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", runSearch);
  });

  // initial render: show all
  renderSupplierResults(SUPPLIER_DATA, resultsEl, emptyEl, false);
}

function renderSupplierResults(list, container, emptyEl, fromSearch) {
  if (!container) return;

  if (!list.length) {
    container.innerHTML = "";
    if (emptyEl) {
      emptyEl.style.display = "block";
      emptyEl.textContent = fromSearch
        ? "No suppliers match your filters yet."
        : "Start by searching for a product keyword.";
    }
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  container.innerHTML = "";
  list.forEach((s) => {
    const card = document.createElement("div");
    card.className = "supplier-card";
    card.innerHTML = `
      <div class="supplier-card-top">
        <div>
          <div class="supplier-product-name">${s.productName}</div>
          <div class="supplier-name">${s.supplierName}</div>
        </div>
        <div class="supplier-score-block">
          <span class="supplier-score">${s.trustScore}</span>
          <span class="supplier-score-label">Trust</span>
        </div>
      </div>
      <div class="supplier-meta-row">
        <span>${s.platform}</span>
        <span>Ships to ${s.region}</span>
        <span>${s.minShippingDays}-${s.maxShippingDays} days</span>
        <span>$${s.minPrice.toFixed(2)}–$${s.maxPrice.toFixed(2)}</span>
        <span>⭐ ${s.rating.toFixed(1)}</span>
      </div>
      <div class="supplier-footer-row">
        <span>${s.branding ? "Supports branding / packaging" : "Standard packaging"}</span>
        <button class="secondary-btn supplier-view-btn" type="button">
          View supplier options
        </button>
      </div>
    `;
    container.appendChild(card);
  });
        }
