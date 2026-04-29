(function () {
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");

  if (navToggle && nav) {
    function closeNav() {
      nav.classList.remove("is-open");
      navToggle.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Ouvrir le menu");
    }

    navToggle.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("is-open");
      navToggle.classList.toggle("is-open", isOpen);
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      navToggle.setAttribute("aria-label", isOpen ? "Fermer le menu" : "Ouvrir le menu");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        closeNav();
      });
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 720) {
        closeNav();
      }
    });
  }

  const API_BASE_URL = window.BOOKMYBEARD_API_URL || "http://localhost:4000";
  const ADMIN_PASSWORD_KEY = "bookmybeard_admin_password";

  const adminNotice = document.getElementById("adminNotice");
  const bookingsBody = document.getElementById("adminBookingsBody");
  const refreshButton = document.getElementById("refreshAdmin");
  const logoutButton = document.getElementById("adminLogout");

  const statTotal = document.getElementById("statTotal");
  const statUpcoming = document.getElementById("statUpcoming");
  const statCancelRate = document.getElementById("statCancelRate");

  const listByStatus = document.getElementById("listByStatus");
  const listByService = document.getElementById("listByService");
  const listByDay = document.getElementById("listByDay");
  const chartByStatusCanvas = document.getElementById("chartByStatus");
  const chartByServiceCanvas = document.getElementById("chartByService");
  const chartByDayCanvas = document.getElementById("chartByDay");
  let adminPassword = sessionStorage.getItem(ADMIN_PASSWORD_KEY) || "";
  const adminBody = document.body;
  const charts = {
    status: null,
    service: null,
    day: null,
  };

  function setNotice(message, type) {
    adminNotice.textContent = message;
    adminNotice.className = `admin-notice ${type ? `is-${type}` : ""}`.trim();
  }

  function renderList(container, rows, labelKey) {
    container.innerHTML = "";
    if (!rows || !rows.length) {
      const li = document.createElement("li");
      li.textContent = "Aucune donnée";
      container.appendChild(li);
      return;
    }
    rows.forEach(function (row) {
      const li = document.createElement("li");
      li.textContent = `${row[labelKey]} : ${row.count}`;
      container.appendChild(li);
    });
  }

  function createActionButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn ${className} admin-action-btn`;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function formatDayLabel(day) {
    const date = new Date(`${day}T00:00:00`);
    if (Number.isNaN(date.getTime())) return day;
    return new Intl.DateTimeFormat("fr-CH", { day: "2-digit", month: "2-digit" }).format(date);
  }

  function renderCharts(stats) {
    if (typeof window.Chart === "undefined") {
      return;
    }

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 450,
      },
      plugins: {
        legend: {
          labels: {
            font: {
              family: "Inter",
            },
          },
        },
      },
    };

    const byStatus = stats.byStatus || [];
    const byService = stats.byService || [];
    const byDay = stats.byDay || [];

    if (charts.status) charts.status.destroy();
    if (charts.service) charts.service.destroy();
    if (charts.day) charts.day.destroy();

    if (chartByStatusCanvas) {
      charts.status = new window.Chart(chartByStatusCanvas, {
        type: "doughnut",
        data: {
          labels: byStatus.map((s) => s.status),
          datasets: [
            {
              data: byStatus.map((s) => s.count),
              backgroundColor: ["#1f3d3b", "#a47149", "#912727", "#6b6b6b"],
              borderColor: "#ffffff",
              borderWidth: 2,
            },
          ],
        },
        options: {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            legend: {
              position: "bottom",
            },
          },
        },
      });
    }

    if (chartByServiceCanvas) {
      charts.service = new window.Chart(chartByServiceCanvas, {
        type: "bar",
        data: {
          labels: byService.map((s) => s.service),
          datasets: [
            {
              label: "Réservations",
              data: byService.map((s) => s.count),
              backgroundColor: "#1f3d3b",
              borderRadius: 8,
              maxBarThickness: 48,
            },
          ],
        },
        options: {
          ...baseOptions,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
              },
            },
          },
          plugins: {
            ...baseOptions.plugins,
            legend: {
              display: false,
            },
          },
        },
      });
    }

    if (chartByDayCanvas) {
      const orderedDays = [...byDay].reverse();
      charts.day = new window.Chart(chartByDayCanvas, {
        type: "line",
        data: {
          labels: orderedDays.map((d) => formatDayLabel(d.day)),
          datasets: [
            {
              label: "Réservations / jour",
              data: orderedDays.map((d) => d.count),
              borderColor: "#a47149",
              backgroundColor: "rgba(164, 113, 73, 0.2)",
              tension: 0.35,
              fill: true,
              pointRadius: 2.5,
              pointHoverRadius: 4,
            },
          ],
        },
        options: {
          ...baseOptions,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0,
              },
            },
          },
          plugins: {
            ...baseOptions.plugins,
            legend: {
              display: false,
            },
          },
        },
      });
    }
  }

  async function fetchJson(url, options) {
    const finalOptions = options ? { ...options } : {};
    const headers = { ...(finalOptions.headers || {}) };
    if (url.includes("/api/admin/")) {
      headers["x-admin-password"] = adminPassword;
    }
    finalOptions.headers = headers;

    const response = await fetch(url, finalOptions);
    const data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      throw new Error(data.error || "Erreur serveur");
    }
    return data;
  }

  function redirectToHome() {
    window.location.href = "index.html#top";
  }

  async function ensureAdminAuth() {
    if (!adminPassword) {
      const typed = window.prompt("Mot de passe administrateur BookMyBeard");
      if (!typed || !typed.trim()) {
        redirectToHome();
        return false;
      }
      adminPassword = typed.trim();
      sessionStorage.setItem(ADMIN_PASSWORD_KEY, adminPassword);
    }

    try {
      await fetchJson(`${API_BASE_URL}/api/admin/auth-check`);
      if (adminBody) {
        adminBody.classList.remove("admin-auth-pending");
      }
      return true;
    } catch (error) {
      adminPassword = "";
      sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
      window.alert("Accès administrateur refusé.");
      redirectToHome();
      return false;
    }
  }

  async function updateBookingStatus(id, status) {
    const data = await fetchJson(`${API_BASE_URL}/api/admin/bookings/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (data.emailStatus === "sent") {
      setNotice(`Rendez-vous #${id} mis à jour (${status}) + email envoyé.`, "success");
    } else if (data.emailStatus === "simulated") {
      setNotice(`Rendez-vous #${id} mis à jour (${status}) en mode test email.`, "warning");
    } else {
      setNotice(`Rendez-vous #${id} mis à jour (${status}) sans email.`, "warning");
    }
  }

  async function deleteBooking(id) {
    const data = await fetchJson(`${API_BASE_URL}/api/admin/bookings/${id}`, {
      method: "DELETE",
    });
    if (data.emailStatus === "sent") {
      setNotice(`Rendez-vous #${id} supprimé + email d'annulation envoyé.`, "success");
    } else {
      setNotice(`Rendez-vous #${id} supprimé.`, "warning");
    }
  }

  function renderBookingsTable(bookings) {
    const tableLabels = ["ID", "Client", "Email", "Service", "Promo", "Date", "Heure", "Statut", "Actions"];
    bookingsBody.innerHTML = "";
    if (!bookings.length) {
      const row = document.createElement("tr");
      row.className = "admin-empty-row";
      const cell = document.createElement("td");
      cell.colSpan = 9;
      cell.textContent = "Aucune réservation.";
      row.appendChild(cell);
      bookingsBody.appendChild(row);
      return;
    }

    bookings.forEach(function (booking) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${booking.id}</td>
        <td>${booking.fullName}</td>
        <td>${booking.email}</td>
        <td>${booking.service}</td>
        <td>${
          booking.firstVisitDiscount
            ? '<span class="admin-promo-badge">-10% 1ere resa</span>'
            : '<span class="admin-promo-none">-</span>'
        }</td>
        <td>${booking.date}</td>
        <td>${booking.time}</td>
        <td><span class="admin-status status-${booking.status}">${booking.status}</span></td>
        <td class="admin-actions"></td>
      `;

      const actionsCell = row.querySelector(".admin-actions");

      if (booking.status !== "confirmed") {
        actionsCell.appendChild(
          createActionButton("Confirmer", "btn-primary", async function () {
            try {
              await updateBookingStatus(booking.id, "confirmed");
              await loadDashboard();
            } catch (error) {
              setNotice(error.message, "error");
            }
          })
        );
      }

      if (booking.status !== "cancelled") {
        actionsCell.appendChild(
          createActionButton("Annuler", "btn-secondary", async function () {
            try {
              await updateBookingStatus(booking.id, "cancelled");
              await loadDashboard();
            } catch (error) {
              setNotice(error.message, "error");
            }
          })
        );
      }

      actionsCell.appendChild(
        createActionButton("Supprimer", "btn-secondary", async function () {
          const ok = window.confirm(`Supprimer définitivement la réservation #${booking.id} ?`);
          if (!ok) return;
          try {
            await deleteBooking(booking.id);
            await loadDashboard();
          } catch (error) {
            setNotice(error.message, "error");
          }
        })
      );

      row.querySelectorAll("td").forEach(function (cell, index) {
        cell.setAttribute("data-label", tableLabels[index] || "");
      });

      bookingsBody.appendChild(row);
    });
  }

  async function loadDashboard() {
    try {
      setNotice("Chargement des données admin...", "info");
      const [bookings, stats] = await Promise.all([
        fetchJson(`${API_BASE_URL}/api/bookings`),
        fetchJson(`${API_BASE_URL}/api/admin/stats`),
      ]);

      statTotal.textContent = stats.total;
      statUpcoming.textContent = stats.upcomingConfirmed;
      statCancelRate.textContent = `${stats.cancellationRate}%`;

      renderList(listByStatus, stats.byStatus, "status");
      renderList(listByService, stats.byService, "service");
      renderList(listByDay, stats.byDay, "day");
      renderCharts(stats);
      renderBookingsTable(bookings);
      setNotice("Tableau de bord à jour.", "success");
    } catch (error) {
      setNotice(`Erreur: ${error.message}`, "error");
    }
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", function () {
      loadDashboard();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      adminPassword = "";
      sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
      redirectToHome();
    });
  }

  ensureAdminAuth().then(function (ok) {
    if (ok) {
      loadDashboard();
    }
  });
})();
