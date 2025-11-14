// api/scan.js
// Simple Supplier Trust Scan endpoint with NO database dependency.
// Runs as a Serverless Function on Vercel at /api/scan

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST /api/scan" });
  }

  try {
    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'url' in body" });
    }

    // 1) Detect platform based on URL
    const platform = detectPlatform(url);

    // 2) Generate some mock metrics (later can be replaced with real data/scrapers)
    const metrics = generateMockMetrics(platform);

    // 3) Compute Trust Score & breakdown
    const scoring = computeTrustScore(metrics);

    // 4) Build a simple alternative suggestions mock
    const alternatives = buildMockAlternatives(platform);

    return res.status(200).json({
      ok: true,
      url,
      platform,
      scoring,
      alternatives,
    });
  } catch (err) {
    console.error("Scan error:", err);
    return res.status(500).json({ error: "Internal error while scanning supplier" });
  }
}

// ---------- Platform detection ----------
function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes("aliexpress")) return "ALIEXPRESS";
  if (u.includes("alibaba")) return "ALIBABA";
  if (u.includes("1688.com")) return "1688";
  if (u.includes("cjdropshipping")) return "CJ_DROPSHIPPING";
  if (u.includes("taobao")) return "TAOBAO";
  return "OTHER";
}

// ---------- Mock metrics generator (placeholder for real data later) ----------
function generateMockMetrics(platform) {
  let baseShipping = 16;
  if (platform === "ALIEXPRESS") baseShipping = 12;
  if (platform === "ALIBABA") baseShipping = 18;
  if (platform === "CJ_DROPSHIPPING") baseShipping = 10;

  return {
    avgShippingDaysUS: baseShipping,
    onTimeDeliveryRate: 0.88,
    refundRate: 0.04,
    disputeRate: 0.02,
    defectRate: 0.03,
    reviewAuthenticityScore: 0.75,
    responseTimeHours: 8,
    outOfStockFrequency: 0.07,
    priceVolatilityScore: 0.25,
    trendScore: 0.1,
    orderVolume: 1200
  };
}

// ---------- Trust Score Engine ----------
function computeTrustScore(metrics) {
  const warnings = [];

  const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
  const inverseRatioScore = (r) => (r == null ? null : clamp(100 - r * 100));
  const directRatioScore = (r) => (r == null ? null : clamp(r * 100));

  // SHIPPING
  let shippingScore = 70;
  if (metrics.avgShippingDaysUS != null) {
    const d = metrics.avgShippingDaysUS;
    const normalized = clamp(120 - d * 4, 40, 100);
    shippingScore = normalized;
    if (d > 20) warnings.push("Long average shipping time to US.");
  }
  if (metrics.onTimeDeliveryRate != null) {
    const s = directRatioScore(metrics.onTimeDeliveryRate) ?? 0;
    shippingScore = shippingScore * 0.6 + s * 0.4;
    if (metrics.onTimeDeliveryRate < 0.8) {
      warnings.push("Low on-time delivery rate.");
    }
  }

  // QUALITY
  let qualityScore = 75;
  if (metrics.defectRate != null) {
    const s = inverseRatioScore(metrics.defectRate) ?? 0;
    qualityScore = qualityScore * 0.5 + s * 0.5;
    if (metrics.defectRate > 0.05) warnings.push("High defect/damage rate.");
  }
  if (metrics.refundRate != null || metrics.disputeRate != null) {
    const refundScore = inverseRatioScore(metrics.refundRate ?? 0) ?? 0;
    const disputeScore = inverseRatioScore(metrics.disputeRate ?? 0) ?? 0;
    const mix = refundScore * 0.5 + disputeScore * 0.5;
    qualityScore = qualityScore * 0.5 + mix * 0.5;
    if ((metrics.refundRate ?? 0) > 0.08 || (metrics.disputeRate ?? 0) > 0.05) {
      warnings.push("Refund/dispute rates are above normal.");
    }
  }
  if (metrics.reviewAuthenticityScore != null) {
    const s = directRatioScore(metrics.reviewAuthenticityScore) ?? 0;
    qualityScore = qualityScore * 0.7 + s * 0.3;
    if (metrics.reviewAuthenticityScore < 0.6) {
      warnings.push("Reviews may be low quality or manipulated.");
    }
  }

  // COMMUNICATION
  let communicationScore = 80;
  if (metrics.responseTimeHours != null) {
    const h = metrics.responseTimeHours;
    const normalized = clamp(120 - h * 2.5, 40, 100);
    communicationScore = normalized;
    if (h > 24) warnings.push("Slow response time to messages.");
  }

  // STABILITY
  let stabilityScore = 80;
  if (metrics.outOfStockFrequency != null) {
    const s = inverseRatioScore(metrics.outOfStockFrequency) ?? 0;
    stabilityScore = stabilityScore * 0.6 + s * 0.4;
    if (metrics.outOfStockFrequency > 0.1) warnings.push("Stock levels are unstable.");
  }
  if (metrics.priceVolatilityScore != null) {
    const s = inverseRatioScore(metrics.priceVolatilityScore) ?? 0;
    stabilityScore = stabilityScore * 0.6 + s * 0.4;
    if (metrics.priceVolatilityScore > 0.4) warnings.push("Pricing is volatile.");
  }
  if (metrics.trendScore != null) {
    if (metrics.trendScore < -0.3) {
      stabilityScore -= 10;
      warnings.push("Performance trend worsening in recent period.");
    } else if (metrics.trendScore > 0.3) {
      stabilityScore += 5;
    }
  }

  if ((metrics.orderVolume ?? 0) < 50) {
    warnings.push("Low order volume – limited historical data.");
  }

  const overallRaw =
    shippingScore * 0.35 +
    qualityScore * 0.35 +
    communicationScore * 0.15 +
    stabilityScore * 0.15;

  const clampScore = (v) => Math.round(clamp(v));
  const overall = clampScore(overallRaw);

  let riskLabel = "OKAY";
  if (overall >= 85) riskLabel = "EXCELLENT";
  else if (overall >= 70) riskLabel = "GOOD";
  else if (overall >= 55) riskLabel = "OKAY";
  else if (overall >= 40) riskLabel = "RISKY";
  else riskLabel = "AVOID";

  const summary = buildSummary(
    overall,
    clampScore(shippingScore),
    clampScore(qualityScore),
    clampScore(communicationScore),
    clampScore(stabilityScore),
    warnings
  );

  return {
    overall,
    shipping: clampScore(shippingScore),
    quality: clampScore(qualityScore),
    communication: clampScore(communicationScore),
    stability: clampScore(stabilityScore),
    riskLabel,
    warnings,
    summary
  };
}

function buildSummary(
  overall,
  shipping,
  quality,
  communication,
  stability,
  warnings
) {
  const parts = [];
  parts.push(`Overall trust score is ${overall}/100.`);

  if (shipping >= 80) parts.push("Shipping performance is strong.");
  else if (shipping <= 60) parts.push("Shipping performance is below average.");

  if (quality >= 80) parts.push("Quality metrics are solid.");
  else if (quality <= 60) parts.push("Quality metrics indicate possible issues.");

  if (communication <= 60) parts.push("Supplier may be slow to respond to messages.");
  if (stability <= 60) parts.push("Stock or pricing stability is a concern.");

  if (warnings.length) {
    parts.push("Key risks: " + warnings.slice(0, 3).join("; ") + ".");
  }

  return parts.join(" ");
}

// ---------- Simple mock alternatives ----------
function buildMockAlternatives(platform) {
  const base = platform === "ALIEXPRESS" ? "AliExpress" :
               platform === "ALIBABA" ? "Alibaba" :
               platform === "CJ_DROPSHIPPING" ? "CJ Dropshipping" :
               platform === "1688" ? "1688" :
               platform === "TAOBAO" ? "Taobao" : "Mixed";

  return [
    {
      name: `${base} Supplier A`,
      platform,
      trustScore: 90,
      note: "High volume, stable shipping, low dispute rate."
    },
    {
      name: `${base} Supplier B`,
      platform,
      trustScore: 84,
      note: "Good performance with slightly slower shipping."
    }
  ];
      }
