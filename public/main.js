async function fillSelect(selectEl, rows, selectedValue) {
  selectEl.innerHTML = '<option value="">All</option>';

  for (const r of rows) {
    const opt = document.createElement("option");
    opt.value = r.code;
    opt.textContent = `${r.code} - ${r.name_en || r.name_kh || ""}`;

    if (selectedValue && selectedValue === r.code)
      opt.selected = true;

    selectEl.appendChild(opt);
  }
}

/* ================= DISTRICT ================= */

async function loadDistricts(provinceCode, selected) {
  const district = document.getElementById("district");
  const commune = document.getElementById("commune");
  const village = document.getElementById("village");

  if (!provinceCode) {
    district.innerHTML = '<option value="">All</option>';
    commune.innerHTML = '<option value="">All</option>';
    village.innerHTML = '<option value="">All</option>';

    district.disabled = true;
    commune.disabled = true;
    village.disabled = true;
    return;
  }

  const res = await fetch(
    "/api/districts?province_code=" + encodeURIComponent(provinceCode)
  );

  const rows = await res.json();

  await fillSelect(district, rows, selected);

  district.disabled = rows.length === 0;
  commune.disabled = true;
  village.disabled = true;
}

/* ================= COMMUNE ================= */

async function loadCommunes(districtCode, selected) {
  const commune = document.getElementById("commune");
  const village = document.getElementById("village");

  if (!districtCode) {
    commune.innerHTML = '<option value="">All</option>';
    village.innerHTML = '<option value="">All</option>';

    commune.disabled = true;
    village.disabled = true;
    return;
  }

  const res = await fetch(
    "/api/communes?district_code=" + encodeURIComponent(districtCode)
  );

  const rows = await res.json();

  if (rows.length === 0) {
    commune.innerHTML =
      '<option value="">No commune data</option>';
    commune.disabled = true;
  } else {
    await fillSelect(commune, rows, selected);
    commune.disabled = false;
  }

  village.disabled = true;
}

/* ================= VILLAGE ================= */

async function loadVillages(communeCode, selected) {
  const village = document.getElementById("village");

  if (!communeCode) {
    village.innerHTML = '<option value="">All</option>';
    village.disabled = true;
    return;
  }

  const res = await fetch(
    "/api/villages?commune_code=" + encodeURIComponent(communeCode)
  );

  const rows = await res.json();

  if (rows.length === 0) {
    village.innerHTML =
      '<option value="">No village data</option>';
    village.disabled = true;
  } else {
    await fillSelect(village, rows, selected);
    village.disabled = false;
  }
}

/* ================= INIT ================= */

window.addEventListener("DOMContentLoaded", async () => {

  const province = document.getElementById("province");
  const district = document.getElementById("district");
  const commune = document.getElementById("commune");
  const village = document.getElementById("village");

  if (!province || !district || !commune || !village) return;

  const selectedDistrict = district.dataset.selected || "";
  const selectedCommune = commune.dataset.selected || "";
  const selectedVillage = village.dataset.selected || "";

  if (province.value) {
    await loadDistricts(province.value, selectedDistrict);
  }

  if (district.value || selectedDistrict) {
    await loadCommunes(
      district.value || selectedDistrict,
      selectedCommune
    );
  }

  if (commune.value || selectedCommune) {
    await loadVillages(
      commune.value || selectedCommune,
      selectedVillage
    );
  }

  province.addEventListener("change", async () => {
    await loadDistricts(province.value, "");
    await loadCommunes("", "");
    await loadVillages("", "");
  });

  district.addEventListener("change", async () => {
    await loadCommunes(district.value, "");
    await loadVillages("", "");
  });

  commune.addEventListener("change", async () => {
    await loadVillages(commune.value, "");
  });
});

window.addEventListener("DOMContentLoaded", () => {
  const mapEl = document.getElementById("cambodia-map");
  if (!mapEl || typeof L === "undefined") return;

  const cambodiaBounds = [
    [9.3, 102.3],
    [14.9, 108.0]
  ];

  const map = L.map("cambodia-map", {
    zoomControl: true,
    attributionControl: false,
    minZoom: 6,
    maxZoom: 12
  });

  map.fitBounds(cambodiaBounds);
  map.setMaxBounds(cambodiaBounds);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  L.marker([11.5564, 104.9282])
    .addTo(map)
    .bindPopup("Phnom Penh, Cambodia")
    .openPopup();
});

function isInternalNavigableLink(anchor) {
  if (!anchor || !anchor.href) return false;
  if (anchor.hasAttribute("download")) return false;
  if ((anchor.getAttribute("target") || "").toLowerCase() === "_blank") return false;
  const href = anchor.getAttribute("href") || "";
  if (!href || href.startsWith("#")) return false;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
  return true;
}

function ensureRouteLoader() {
  let loader = document.getElementById("route-loader");
  if (loader) return loader;
  loader = document.createElement("div");
  loader.id = "route-loader";
  document.body.appendChild(loader);
  return loader;
}

function startPageTransition() {
  document.body.classList.add("page-transitioning");
  const loader = ensureRouteLoader();
  loader.classList.add("active");
}

function initSmoothUx() {
  document.body.classList.add("js-ready");
  ensureRouteLoader();

  const backBtn = document.querySelector(".back-btn");
  const hideBackOnPaths = new Set(["/", "/people", "/login"]);
  if (backBtn && hideBackOnPaths.has(window.location.pathname)) {
    const wrap = backBtn.closest(".page-actions");
    if (wrap) {
      wrap.style.display = "none";
    }
  }

  if (window.location.pathname === "/login") {
    const navLoginBtn = document.querySelector(".nav-login-btn");
    if (navLoginBtn) {
      navLoginBtn.style.display = "none";
    }
  }

  window.requestAnimationFrame(() => {
    document.body.classList.add("page-entered");
  });

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");
    if (!anchor) return;
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    if (!isInternalNavigableLink(anchor)) return;
    if (anchor.dataset.noTransition === "true") return;

    event.preventDefault();
    startPageTransition();
    window.setTimeout(() => {
      window.location.href = anchor.href;
    }, 170);
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (event.defaultPrevented) return;

    form.classList.add("is-submitting");
    const submitter = event.submitter;
    if (submitter && submitter.tagName === "BUTTON") {
      submitter.disabled = true;
      if (!submitter.dataset.originalHtml) {
        submitter.dataset.originalHtml = submitter.innerHTML;
      }
      submitter.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Processing...';
    }

    startPageTransition();
  });
}

window.addEventListener("DOMContentLoaded", initSmoothUx);
