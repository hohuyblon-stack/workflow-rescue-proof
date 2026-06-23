const messyRows = [
  { order_id: "WEB-1001", order_date: "2026-06-01", sku: " sku-001 ", quantity: "2", unit_price: "120.50" },
  { order_id: "WEB-1002", order_date: "06/02/2026", sku: "SKU-002", quantity: "5", unit_price: "75" },
  { order_id: "WEB-1003", order_date: "2026/06/03", sku: "sku 003", quantity: "10", unit_price: "44.20" },
  { order_id: "WEB-1003", order_date: "2026/06/03", sku: "SKU-003", quantity: "10", unit_price: "44.20" },
  { order_id: "WEB-1004", order_date: "2026-06-04", sku: "SKU-004", quantity: "bad", unit_price: "91" },
  { order_id: "", order_date: "2026-06-05", sku: "SKU-005", quantity: "1", unit_price: "20" },
  { order_id: "WEB-1005", order_date: "2026-06-06", sku: "sku-006", quantity: "4", unit_price: "275" },
  { order_id: "WEB-1006", order_date: "2026-06-07", sku: "sku-002", quantity: "3", unit_price: "81" }
];

const inventory = {
  "SKU-001": { stock_on_hand: 4, reorder_point: 6 },
  "SKU-002": { stock_on_hand: 22, reorder_point: 10 },
  "SKU-003": { stock_on_hand: 8, reorder_point: 12 },
  "SKU-004": { stock_on_hand: 15, reorder_point: 5 },
  "SKU-005": { stock_on_hand: 2, reorder_point: 5 },
  "SKU-006": { stock_on_hand: 19, reorder_point: 7 }
};

function setLanguage(lang) {
  document.querySelectorAll("[data-copy]").forEach((node) => {
    node.hidden = node.getAttribute("data-copy") !== lang;
  });
  document.querySelectorAll("[data-lang-button]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.getAttribute("data-lang-button") === lang));
  });
}

function normalizeSku(value) {
  let compact = value.trim().toUpperCase().replaceAll(" ", "-");
  if (compact.startsWith("SKU") && !compact.startsWith("SKU-")) {
    compact = compact.replace("SKU", "SKU-");
  }
  return compact;
}

function parseDate(value) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slashDate = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashDate) return `${slashDate[3]}-${slashDate[1]}-${slashDate[2]}`;
  const ymdSlash = trimmed.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (ymdSlash) return `${ymdSlash[1]}-${ymdSlash[2]}-${ymdSlash[3]}`;
  throw new Error("invalid_order_date");
}

function normalizeOrder(row) {
  const orderId = row.order_id.trim();
  const sku = normalizeSku(row.sku);
  if (!orderId) throw new Error("missing_order_id");
  const quantity = Number.parseInt(row.quantity, 10);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("invalid_quantity");
  const unitPrice = Number.parseFloat(row.unit_price);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("invalid_unit_price");
  return {
    order_id: orderId,
    order_date: parseDate(row.order_date),
    sku,
    quantity,
    unit_price: unitPrice,
    revenue: Number((quantity * unitPrice).toFixed(2))
  };
}

function runPipeline() {
  const seen = new Set();
  const cleaned = [];
  const exceptions = [];
  const log = [
    "Loaded synthetic CSV and API-like inventory sources.",
    "Simulated one temporary API-like rate limit and retried successfully."
  ];

  messyRows.forEach((row, index) => {
    try {
      const normalized = normalizeOrder(row);
      const key = `${normalized.order_id}::${normalized.sku}`;
      if (seen.has(key)) {
        exceptions.push({ row: index + 1, issue: "duplicate_record" });
        return;
      }
      seen.add(key);
      const stock = inventory[normalized.sku] || { stock_on_hand: 0, reorder_point: 0 };
      cleaned.push({
        ...normalized,
        stock_on_hand: stock.stock_on_hand,
        reorder_point: stock.reorder_point,
        low_stock: stock.stock_on_hand <= stock.reorder_point,
        unusual_movement: normalized.quantity >= Math.max(8, stock.reorder_point)
      });
    } catch (error) {
      exceptions.push({ row: index + 1, issue: error.message });
    }
  });

  log.push("Validated schemas, normalized SKUs/dates/numbers, and detected duplicates.");
  log.push("Calculated KPIs, low-stock alerts, unusual-movement alerts, and management summary.");
  log.push("Generated cleaned table, exception list, and execution log.");

  const totalRevenue = cleaned.reduce((sum, row) => sum + row.revenue, 0);
  return {
    cleaned,
    exceptions,
    log,
    kpis: {
      "Cleaned records": cleaned.length,
      "Exceptions": exceptions.length,
      "Synthetic revenue": totalRevenue.toFixed(2),
      "Low-stock alerts": cleaned.filter((row) => row.low_stock).length
    }
  };
}

function renderTable(elementId, rows, fields) {
  const table = document.getElementById(elementId);
  table.replaceChildren();
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  fields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = field;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    fields.forEach((field) => {
      const td = document.createElement("td");
      td.textContent = String(row[field] ?? "");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

function renderResults(result) {
  renderTable("output-table", result.cleaned, [
    "order_id",
    "order_date",
    "sku",
    "quantity",
    "revenue",
    "low_stock",
    "unusual_movement"
  ]);
  renderTable("exception-table", result.exceptions, ["row", "issue"]);
  const kpis = document.getElementById("kpis");
  kpis.replaceChildren();
  Object.entries(result.kpis).forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "kpi";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    item.append(strong, span);
    kpis.appendChild(item);
  });

  const log = document.getElementById("execution-log");
  log.replaceChildren();
  result.log.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    log.appendChild(li);
  });
}

document.querySelectorAll("[data-lang-button]").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.getAttribute("data-lang-button")));
});

document.getElementById("run-demo").addEventListener("click", () => {
  renderResults(runPipeline());
});

renderTable("input-table", messyRows, ["order_id", "order_date", "sku", "quantity", "unit_price"]);
renderResults(runPipeline());
setLanguage("en");
