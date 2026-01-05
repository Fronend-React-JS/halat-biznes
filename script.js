/*********************************************************
 REAL OPTOM HALAT SAVDOSI – HISOB TIZIMI
 HTML: index.html
 CSS:  style.css
 JS:   script.js
**********************************************************/

/* ===============================
   ASOSIY SAQLANADIGAN MA'LUMOT
================================ */
const STORAGE_KEY = "optom_halat_data_v1";

let DB = {
    purchases: [],   // sexdan kirim
    sales: [],       // mijozga sotuv
    returns: [],     // qaytish
    defects: [],     // brak
    stock: {},       // ombor hisob
    sexDebts: {},    // sexlar qarzi
    clientDebts: {}, // mijozlar qarzi
    logs: []         // umumiy log
};

/* ===============================
   SAQLASH / YUKLASH
================================ */
function loadDB() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            DB = JSON.parse(raw);
        } catch (e) {
            console.error("Ma'lumotni o‘qib bo‘lmadi", e);
        }
    }
}

function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

/* ===============================
   YORDAMCHI FUNKSIYALAR
================================ */
function today() {
    return new Date().toISOString().slice(0, 10);
}

function num(v) {
    v = Number(v);
    return isNaN(v) ? 0 : v;
}

function log(type, text, amount = 0) {
    DB.logs.unshift({
        date: new Date().toLocaleString(),
        type,
        text,
        amount
    });
    if (DB.logs.length > 200) DB.logs.pop();
}

/* ===============================
   OMBOR INIT
================================ */
function ensureStock(product) {
    if (!DB.stock[product]) {
        DB.stock[product] = {
            in: 0,
            out: 0,
            defect: 0
        };
    }
}

/* ===============================
   SEXDAN KIRIM
================================ */
function addPurchase(data) {
    const date = data.date || today();
    const sex = data.sex || "Noma'lum sex";
    const product = data.product || "Noma'lum halat";
    const qty = num(data.quantity);
    const price = num(data.price);
    const paid = num(data.paid);

    const total = qty * price;
    const debt = total - paid;

    ensureStock(product);
    DB.stock[product].in += qty;

    if (!DB.sexDebts[sex]) {
        DB.sexDebts[sex] = { total: 0, paid: 0, defect: 0 };
    }

    DB.sexDebts[sex].total += total;
    DB.sexDebts[sex].paid += paid;

    DB.purchases.push({
        date, sex, product, qty, price, total, paid, debt
    });

    log("KIRIM", `${sex} → ${product} (${qty})`, total);
    saveDB();
    renderAll();
}

/* ===============================
   MIJOZGA SOTUV
================================ */
function addSale(data) {
    const date = data.date || today();
    const client = data.client || "Noma'lum mijoz";
    const region = data.region || "-";
    const product = data.product || "Noma'lum halat";
    const qty = num(data.quantity);
    const price = num(data.price);
    const paid = num(data.paid);

    ensureStock(product);

    // agar omborda yetarli bo‘lmasa ham minusga tushirmaymiz
    const available =
        DB.stock[product].in -
        DB.stock[product].out -
        DB.stock[product].defect;

    const realQty = Math.min(qty, available);

    const total = realQty * price;
    const debt = total - paid;

    DB.stock[product].out += realQty;

    if (!DB.clientDebts[client]) {
        DB.clientDebts[client] = { total: 0, paid: 0 };
    }

    DB.clientDebts[client].total += total;
    DB.clientDebts[client].paid += paid;

    DB.sales.push({
        date, client, region, product,
        qty: realQty, price, total, paid, debt
    });

    log("SOTUV", `${client} → ${product} (${realQty})`, total);
    saveDB();
    renderAll();
}

/* ===============================
   SOTUVDAN QAYTISH
================================ */
function addReturn(data) {
    const date = data.date || today();
    const client = data.client || "Noma'lum mijoz";
    const product = data.product || "Noma'lum halat";
    const qty = num(data.quantity);
    const type = data.type || "good"; // good | defect

    ensureStock(product);

    if (type === "good") {
        DB.stock[product].out -= qty;
        DB.stock[product].out = Math.max(0, DB.stock[product].out);
        log("QAYTISH", `${product} (${qty}) omborga qaytdi`);
    } else {
        DB.stock[product].defect += qty;
        log("BRAK", `${product} (${qty})`);
    }

    DB.returns.push({ date, client, product, qty, type });
    saveDB();
    renderAll();
}

/* ===============================
   BRAK SEXGA BOG‘LASH
================================ */
function addDefect(data) {
    const date = data.date || today();
    const sex = data.sex || "Noma'lum sex";
    const product = data.product || "Noma'lum halat";
    const qty = num(data.quantity);
    const loss = num(data.loss);

    ensureStock(product);

    if (!DB.sexDebts[sex]) {
        DB.sexDebts[sex] = { total: 0, paid: 0, defect: 0 };
    }

    DB.sexDebts[sex].defect += loss;

    DB.defects.push({ date, sex, product, qty, loss });
    log("BRAK", `${sex} → ${product} (${qty})`, loss);
    saveDB();
    renderAll();
}

/* ===============================
   FOYDA HISOBI
================================ */
function calculateProfit() {
    let profit = 0;

    DB.sales.forEach(s => {
        // kelish narxi taxminiy o‘rtacha olinadi
        const purchases = DB.purchases.filter(p => p.product === s.product);
        let avgCost = 0;

        if (purchases.length) {
            let sum = 0, count = 0;
            purchases.forEach(p => {
                sum += p.price * p.qty;
                count += p.qty;
            });
            avgCost = count ? sum / count : 0;
        }

        profit += (s.price - avgCost) * s.qty;
    });

    DB.defects.forEach(d => {
        profit -= d.loss;
    });

    return Math.round(profit);
}

/* ===============================
   RENDER QISMI
================================ */
function renderDashboard() {
    const totalStock = Object.values(DB.stock).reduce((a, s) => {
        return a + (s.in - s.out - s.defect);
    }, 0);

    const sexDebt = Object.values(DB.sexDebts).reduce((a, s) => {
        return a + (s.total - s.paid - s.defect);
    }, 0);

    const clientDebt = Object.values(DB.clientDebts).reduce((a, c) => {
        return a + (c.total - c.paid);
    }, 0);

    document.getElementById("stat-total-stock").innerText = totalStock;
    document.getElementById("stat-sex-debt").innerText = sexDebt;
    document.getElementById("stat-client-debt").innerText = clientDebt;
    document.getElementById("stat-profit").innerText = calculateProfit();

    const logBody = document.getElementById("dashboard-log-body");
    if (!logBody) return;
    logBody.innerHTML = "";
    DB.logs.slice(0, 20).forEach(l => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${l.date}</td>
            <td>${l.type}</td>
            <td>${l.text}</td>
            <td>${l.amount}</td>
        `;
        logBody.appendChild(tr);
    });
}

function renderWarehouse() {
    const body = document.getElementById("warehouse-table");
    if (!body) return;
    body.innerHTML = "";

    Object.keys(DB.stock).forEach(p => {
        const s = DB.stock[p];
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p}</td>
            <td>${s.in}</td>
            <td>${s.out}</td>
            <td>${s.defect}</td>
            <td>${s.in - s.out - s.defect}</td>
        `;
        body.appendChild(tr);
    });
}

function renderAll() {
    renderDashboard();
    renderWarehouse();
}

/* ===============================
   FORMA ULASH
================================ */
document.addEventListener("DOMContentLoaded", () => {
    loadDB();
    renderAll();

    const purchaseForm = document.getElementById("purchase-form");
    if (purchaseForm) {
        purchaseForm.addEventListener("submit", e => {
            e.preventDefault();
            const f = e.target;
            addPurchase({
                date: f.date.value,
                sex: f.sex.value,
                product: f.product.value,
                quantity: f.quantity.value,
                price: f.price.value,
                paid: f.paid.value
            });
            f.reset();
        });
    }

    const saleForm = document.getElementById("sale-form");
    if (saleForm) {
        saleForm.addEventListener("submit", e => {
            e.preventDefault();
            const f = e.target;
            addSale({
                date: f.date.value,
                client: f.client.value,
                region: f.region.value,
                product: f.product.value,
                quantity: f.quantity.value,
                price: f.price.value,
                paid: f.paid.value
            });
            f.reset();
        });
    }
});
