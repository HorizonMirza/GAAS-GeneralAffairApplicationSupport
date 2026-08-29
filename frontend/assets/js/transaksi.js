let ME = null;
let state = { page: 1, limit: 10, bulan: "" };

function renderRow(item) {
  return `
    <tr>
      <td>${item.no_resi || "-"}</td>
      <td>${formatDate(item.tanggal)}</td>
      <td>${item.tujuan_penerimaan}</td>
      <td>${item.jumlah_item}</td>
      <td>${item.nama_pengirim}</td>
      <td>${item.divisi}</td>
      <td>${item.kode_program}</td>
      <td>${item.nama_penerima}</td>
      <td>${item.no_telepon_penerima}</td>
      <td>${item.asuransi_status}</td>
      <td>${item.request_packing || "-"}</td>
      <td>${item.berat_barang_kg ?? "-"}</td>
      <td>${item.sub_total ? formatCurrency(item.sub_total) : "-"}</td>
      <td>${item.total ? formatCurrency(item.total) : "-"}</td>
      <td>${statusBadge(item.status)}</td>
    </tr>`;
}

function renderPagination(total) {
  const totalPages = Math.max(1, Math.ceil(total / state.limit));
  const info = document.getElementById("pagination-info");
  info.textContent = `Total ${total} transaksi · Halaman ${state.page} dari ${totalPages}`;

  const pagesEl = document.getElementById("pagination-pages");
  let html = "";
  html += `<button class="page-btn" ${state.page <= 1 ? "disabled" : ""} onclick="goToPage(${state.page - 1})">‹</button>`;

  const start = Math.max(1, Math.min(state.page, totalPages - 1));
  const end = Math.min(totalPages, start + 1);
  for (let p = start; p <= end; p++) {
    html += `<button class="page-btn ${p === state.page ? "active" : ""}" onclick="goToPage(${p})">${p}</button>`;
  }
  html += `<button class="page-btn" ${state.page >= totalPages ? "disabled" : ""} onclick="goToPage(${state.page + 1})">›</button>`;
  pagesEl.innerHTML = html;
}

function goToPage(page) {
  if (page < 1) return;
  state.page = page;
  loadTable();
}

async function loadTable() {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = `<tr><td colspan="15" class="table-empty">Memuat data...</td></tr>`;

  try {
    const result = await api.listPengiriman({ page: state.page, limit: state.limit, bulan: state.bulan });
    if (!result.items.length) {
      tbody.innerHTML = `<tr><td colspan="15" class="table-empty">Tidak ada data untuk filter ini.</td></tr>`;
    } else {
      tbody.innerHTML = result.items.map(renderRow).join("");
    }
    renderPagination(result.total);

    const totalWrap = document.getElementById("total-bulan-wrap");
    if (ME.role === "KPU" && result.total_bulan_ini !== null && result.total_bulan_ini !== undefined) {
      totalWrap.classList.remove("hidden");
      document.getElementById("total-bulan-value").textContent = formatCurrency(result.total_bulan_ini);
    } else {
      totalWrap.classList.add("hidden");
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="15" class="table-empty">${err.message}</td></tr>`;
  }
}

document.getElementById("filter-limit").addEventListener("change", (e) => {
  state.limit = Number(e.target.value);
  state.page = 1;
  loadTable();
});

document.getElementById("filter-bulan").addEventListener("change", (e) => {
  state.bulan = e.target.value;
  state.page = 1;
  loadTable();
});

document.getElementById("reset-filter").addEventListener("click", () => {
  document.getElementById("filter-bulan").value = "";
  document.getElementById("filter-limit").value = "10";
  state = { page: 1, limit: 10, bulan: "" };
  loadTable();
});

document.getElementById("export-btn").addEventListener("click", () => {
  window.open(api.exportUrl(state.bulan), "_blank");
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api.logout();
  window.location.href = "index.html";
});

async function init() {
  ME = await requireAuth();
  if (!ME) return;
  setupSidebarActive();
  document.getElementById("chip-name").textContent = ME.nama;
  document.getElementById("chip-role").textContent = ME.role;

  if (ME.role === "EMAK") {
    document.getElementById("export-btn").classList.remove("hidden");
  }

  await loadTable();
}

init();
