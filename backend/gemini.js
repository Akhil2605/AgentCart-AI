const db = require('../database/db');

const CATALOG_SUMMARY = db.getAllProducts().map(p => ({
  id: p.id,
  name: p.name,
  category: p.category,
  style: p.style,
  price: p.price,
  original_price: p.original_price,
  colors: p.colors.map(c => c.name),
  sizes: p.sizes.filter(s => s.stock > 0).map(s => s.size),
  waterproof_rating: p.waterproof_rating,
  breathability: p.breathability,
  material: p.material,
  features: p.features,
  description: p.description
}));

/**
 * Handle AI recommendations using Gemini API when key exists,
 * or fallback to catalogue-grounded heuristic matcher when unconfigured.
 */
async function getRecommendations(userPrompt, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() && apiKey !== 'your_gemini_api_key_here') {
    try {
      return await callGeminiAPI(apiKey, userPrompt, history);
    } catch (err) {
      console.error('Gemini API call failed, falling back to heuristic assistant:', err.message);
      const fallback = runHeuristicAssistant(userPrompt);
      fallback.is_fallback = true;
      fallback.fallback_reason = `Gemini API error: ${err.message}. Showing local catalog analysis.`;
      return fallback;
    }
  } else {
    const fallback = runHeuristicAssistant(userPrompt);
    fallback.is_fallback = true;
    fallback.fallback_reason = 'Demo mode active. Add GEMINI_API_KEY to .env to enable live Gemini AI.';
    return fallback;
  }
}

async function callGeminiAPI(apiKey, userPrompt, history) {
  const systemInstruction = `You are AgentCart AI — the world's premier technical outerwear and jacket styling advisor.
Your knowledge base is strictly limited to the official AgentCart jacket catalog below.
NEVER fabricate products, features, or prices that are not in this catalog.
If a user asks for something not in the catalog or outside constraints, state it honestly and recommend the closest match while highlighting trade-offs.

OFFICIAL CATALOGUE:
${JSON.stringify(CATALOG_SUMMARY, null, 2)}

OUTPUT FORMAT REQUIREMENTS:
You MUST respond with valid JSON only (no markdown code blocks, or wrapped in a single json block).
Schema:
{
  "reply": "Your natural, stylish, expert advisory text explaining recommendations, fit, and technical outerwear nuances.",
  "extracted_preferences": {
    "budget_max": number or null,
    "color": string or null,
    "size": string or null,
    "category": string or null,
    "occasion": string or null,
    "materials_features": [string]
  },
  "recommended_product_ids": ["product-id-1", "product-id-2"],
  "product_reasons": {
    "product-id-1": "Specific explanation referencing its actual specs (e.g. 28,000mm waterproofing, ₹1,999 price, M in stock).",
    "product-id-2": "Why this is an alternative or trade-off."
  },
  "trade_offs_identified": "Any trade-offs found (e.g. slightly over budget, different colorway, etc.)"
}`;

  const promptBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemInstruction },
          { text: `Conversation history: ${JSON.stringify(history.slice(-4))}` },
          { text: `User shopping request: ${userPrompt}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(promptBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini API');

  const parsed = JSON.parse(rawText);
  
  // Validate that recommended product IDs actually exist in catalog
  const validIds = (parsed.recommended_product_ids || []).filter(id => 
    CATALOG_SUMMARY.some(p => p.id === id)
  );

  return {
    is_fallback: false,
    reply: parsed.reply,
    extracted_preferences: parsed.extracted_preferences || {},
    recommendations: validIds.map(id => {
      const p = db.getProductById(id);
      return {
        ...p,
        match_reason: parsed.product_reasons?.[id] || 'Matched from your requirements.'
      };
    }),
    trade_offs: parsed.trade_offs_identified || null
  };
}

/**
 * Intelligent Catalog Heuristic Engine used as a clearly labelled demo fallback
 * when GEMINI_API_KEY is not configured.
 */
function runHeuristicAssistant(prompt) {
  const lower = prompt.toLowerCase();
  
  // 1. Budget extraction (handles numbers with or without commas, e.g. 2000 or 2,000)
  let budgetMax = null;
  const budgetMatch = lower.match(/(?:under|below|less than|within|budget of?|max)\s*₹?\s*([\d,]{3,7})/i) ||
                      lower.match(/₹\s*([\d,]{3,7})/i);
  if (budgetMatch) {
    budgetMax = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
  }

  // 2. Size extraction
  let size = null;
  const sizeMatches = lower.match(/\b(xs|xxl|xl|[sml])\b/i);
  if (sizeMatches) {
    size = sizeMatches[1].toUpperCase();
  }

  // 3. Color extraction
  const colorKeywords = [
    'black', 'white', 'olive', 'orange', 'magenta', 'pink',
    'camo', 'navy', 'blue', 'lime', 'green', 'grey', 'gray', 'coyote', 'khaki', 'crimson', 'red', 'amber'
  ];
  const detectedColors = colorKeywords.filter(c => lower.includes(c));

  // 4. Style & feature keywords
  const featureKeywords = {
    waterproof: ['waterproof', 'rain', 'hardshell', 'storm', 'monsoon', 'downpour'],
    windproof: ['wind', 'windbreaker', 'windrunner', 'breeze'],
    insulated: ['winter', 'cold', 'sub-zero', 'snow', 'warm', 'down', 'puffer', 'parka', 'thermal'],
    bomber: ['bomber', 'ma-1', 'flight'],
    denim: ['denim', 'selvedge', 'jean'],
    everyday: ['everyday', 'daily', 'commute', 'office', 'casual', 'urban', 'city'],
    outdoor: ['outdoor', 'hiking', 'trek', 'tactical', 'trail', 'expedition', 'mountain']
  };

  const detectedCategories = [];
  for (const [cat, words] of Object.entries(featureKeywords)) {
    if (words.some(w => lower.includes(w))) {
      detectedCategories.push(cat);
    }
  }

  // Score all 24 jackets
  const scored = CATALOG_SUMMARY.map(p => {
    let score = 0;
    const reasons = [];
    const tradeOffs = [];

    // Budget check
    if (budgetMax !== null) {
      if (p.price <= budgetMax) {
        score += 35;
        reasons.push(`Price of ₹${p.price.toLocaleString('en-IN')} fits within your ₹${budgetMax.toLocaleString('en-IN')} budget`);
      } else {
        score -= 25;
        tradeOffs.push(`Priced at ₹${p.price.toLocaleString('en-IN')} (₹${p.price - budgetMax} above stated ₹${budgetMax} budget)`);
      }
    }

    // Size check
    if (size) {
      if (p.sizes.includes(size)) {
        score += 25;
        reasons.push(`Size ${size} is currently in stock`);
      } else {
        score -= 30;
        tradeOffs.push(`Size ${size} is currently out of stock for this model`);
      }
    }

    // Color check
    if (detectedColors.length > 0) {
      const pColorStr = p.colors.join(' ').toLowerCase();
      const matchColor = detectedColors.some(c => pColorStr.includes(c) || p.name.toLowerCase().includes(c));
      if (matchColor) {
        score += 25;
        reasons.push(`Available in your requested color tones (${detectedColors.join(', ')})`);
      }
    }

    // Feature / Category match
    const pFullText = (p.name + ' ' + p.category + ' ' + p.style + ' ' + p.description + ' ' + p.features.join(' ') + ' ' + p.material).toLowerCase();
    
    if (detectedCategories.includes('waterproof') && (p.waterproof_rating && p.waterproof_rating !== 'None')) {
      score += 20;
      reasons.push(`High weatherproofing rating (${p.waterproof_rating})`);
    }

    if (detectedCategories.includes('insulated') && (p.category.includes('Winter') || p.category.includes('Puffer'))) {
      score += 20;
      reasons.push(`Heavy thermal insulation built for freezing temperatures`);
    }

    if (detectedCategories.includes('bomber') && p.category.includes('Bomber')) {
      score += 25;
      reasons.push(`Authentic bomber silhouette`);
    }

    if (detectedCategories.includes('denim') && p.category.includes('Denim')) {
      score += 25;
      reasons.push(`Reinforced selvedge denim construction`);
    }

    if (detectedCategories.includes('everyday') && (p.category.includes('Everyday') || p.category.includes('Urban'))) {
      score += 15;
      reasons.push(`Designed for everyday metropolitan comfort`);
    }

    if (detectedCategories.includes('outdoor') && (p.category.includes('Outdoor') || p.category.includes('Technical'))) {
      score += 15;
      reasons.push(`Engineered for rugged outdoor terrain`);
    }

    // If query was generic, reward rating and featured
    if (score === 0) {
      score = p.price <= 2500 ? 10 : 5;
    }

    return {
      product: p,
      score,
      reasons,
      tradeOffs
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, 3);

  const best = topMatches[0];
  let replyText = '';
  
  if (best && best.score > 15) {
    replyText = `Based on your request, I analyzed our technical outerwear collection. Here are the top matched jackets tailored to your specifications:`;
  } else {
    replyText = `I couldn't find an exact 100% match for all specific constraints simultaneously, but here are our closest alternatives with detailed trade-off analysis:`;
  }

  const tradeOffList = [];
  topMatches.forEach(m => {
    if (m.tradeOffs.length > 0) {
      tradeOffList.push(`${m.product.name}: ${m.tradeOffs.join('; ')}`);
    }
  });

  return {
    is_fallback: true,
    reply: replyText,
    extracted_preferences: {
      budget_max: budgetMax,
      color: detectedColors.length ? detectedColors.join(', ') : null,
      size: size,
      categories: detectedCategories,
      occasion: detectedCategories.includes('everyday') ? 'Daily Casual / Commute' : (detectedCategories.includes('outdoor') ? 'Outdoor Sports / Trail' : null)
    },
    recommendations: topMatches.map(m => {
      const full = db.getProductById(m.product.id);
      return {
        ...full,
        match_score: m.score,
        match_reason: m.reasons.length ? m.reasons.join('. ') + '.' : 'Popular jacket matching your general style preferences.',
        trade_offs: m.tradeOffs.length ? m.tradeOffs.join('. ') + '.' : null
      };
    }),
    trade_offs: tradeOffList.length ? tradeOffList.join(' | ') : null
  };
}

module.exports = {
  getRecommendations,
  CATALOG_SUMMARY
};
