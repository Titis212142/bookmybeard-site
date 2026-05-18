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

  const form = document.getElementById("bookingForm");
  const nameInput = form ? form.querySelector('[name="fullName"]') : null;
  const emailInput = form ? form.querySelector('[name="email"]') : null;
  const serviceInput = document.getElementById("service");
  const dateInput = document.getElementById("date");
  const timeInput = document.getElementById("time");
  const submitButton = form ? form.querySelector('button[type="submit"]') : null;
  const errorContainer = document.getElementById("formError");
  const toast = document.getElementById("toast");
  const reserveButtons = document.querySelectorAll(".reserve-service");
  function resolveApiBaseUrl() {
    if (window.BOOKMYBEARD_API_URL) return window.BOOKMYBEARD_API_URL;
    if (window.location.hostname.endsWith(".github.io")) return "";
    return "http://localhost:4000";
  }
  const API_BASE_URL = resolveApiBaseUrl();
  const PROMO_POPUP_SEEN_KEY = "bookmybeard_first_visit_promo_seen";
  const PROMO_DISCOUNT_ACTIVE_KEY = "bookmybeard_first_visit_discount_active";
  const weekdayTimes = [
    "09:00",
    "10:00",
    "11:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
  ];
  const saturdayTimes = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
  let successPopupTimeout = null;
  let promoPopupVisible = false;

  function getBaseTimesForDate(dateIso) {
    if (!dateIso) return weekdayTimes;
    const day = new Date(`${dateIso}T00:00:00`).getDay();
    if (day === 0) return [];
    if (day === 6) return saturdayTimes;
    return weekdayTimes;
  }

  function showSuccessPopup(message) {
    let popup = document.getElementById("successPopup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "successPopup";
      popup.className = "success-popup";
      popup.setAttribute("role", "status");
      popup.setAttribute("aria-live", "polite");
      document.body.appendChild(popup);
    }

    popup.textContent = message;
    popup.classList.add("show");
    if (successPopupTimeout) {
      window.clearTimeout(successPopupTimeout);
    }
    successPopupTimeout = window.setTimeout(function () {
      popup.classList.remove("show");
    }, 3000);
  }

  function highlightSuccess(formElement) {
    if (!formElement) return;
    formElement.classList.add("form-success-highlight");
    window.setTimeout(function () {
      formElement.classList.remove("form-success-highlight");
    }, 2200);
  }

  function showGlobalToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(function () {
      toast.classList.remove("show");
    }, 2800);
  }

  function isFirstVisitPromoSeen() {
    return localStorage.getItem(PROMO_POPUP_SEEN_KEY) === "1";
  }

  function isFirstVisitDiscountActive() {
    return sessionStorage.getItem(PROMO_DISCOUNT_ACTIVE_KEY) === "1";
  }

  function setFirstVisitDiscountActive(active) {
    if (active) {
      sessionStorage.setItem(PROMO_DISCOUNT_ACTIVE_KEY, "1");
    } else {
      sessionStorage.removeItem(PROMO_DISCOUNT_ACTIVE_KEY);
    }
  }

  function markPromoAsSeen() {
    localStorage.setItem(PROMO_POPUP_SEEN_KEY, "1");
  }

  function closePromoPopup() {
    const popup = document.getElementById("firstVisitPromoPopup");
    if (!popup) return;
    popup.remove();
    promoPopupVisible = false;
  }

  function showFirstVisitPromoPopup() {
    if (promoPopupVisible || isFirstVisitPromoSeen()) return;
    promoPopupVisible = true;

    const popup = document.createElement("div");
    popup.id = "firstVisitPromoPopup";
    popup.className = "first-visit-promo-popup";
    popup.innerHTML = `
      <button type="button" class="promo-close-btn" aria-label="Fermer">&times;</button>
      <p class="promo-eyebrow">Offre bienvenue</p>
      <h3>-10% sur votre premiere reservation</h3>
      <p>Reservez maintenant pour activer votre reduction client.</p>
      <div class="promo-actions">
        <button type="button" class="btn btn-primary promo-activate-btn">Profiter de l'offre</button>
        <button type="button" class="btn btn-secondary promo-dismiss-btn">Plus tard</button>
      </div>
    `;
    document.body.appendChild(popup);

    const activateButton = popup.querySelector(".promo-activate-btn");
    const dismissButton = popup.querySelector(".promo-dismiss-btn");
    const closeButton = popup.querySelector(".promo-close-btn");

    if (activateButton) {
      activateButton.addEventListener("click", function () {
        setFirstVisitDiscountActive(true);
        markPromoAsSeen();
        closePromoPopup();
        showGlobalToast("Reduction -10% activee pour votre premiere reservation.");
        const reservationSection = document.getElementById("reservation");
        if (reservationSection) {
          reservationSection.scrollIntoView({ behavior: "smooth" });
        }
      });
    }

    const dismissPromo = function () {
      markPromoAsSeen();
      closePromoPopup();
    };

    if (dismissButton) dismissButton.addEventListener("click", dismissPromo);
    if (closeButton) closeButton.addEventListener("click", dismissPromo);
  }

  if (
    form &&
    nameInput &&
    emailInput &&
    serviceInput &&
    dateInput &&
    timeInput &&
    errorContainer &&
    toast
  ) {
    // Prevent selecting a past date in the date picker.
    const today = new Date().toISOString().split("T")[0];
    dateInput.min = today;

    function setSubmitLoading(loading) {
      if (!submitButton) return;
      submitButton.disabled = loading;
      submitButton.classList.toggle("is-loading", loading);
      submitButton.setAttribute("aria-busy", loading ? "true" : "false");
      submitButton.textContent = loading ? "Envoi..." : "Réserver maintenant";
    }

    function showToast(message) {
      toast.textContent = message;
      toast.classList.add("show");
      window.setTimeout(function () {
        toast.classList.remove("show");
      }, 2800);
    }

    function renderTimeOptions(times, useDefaultWhenEmpty) {
      const shouldUseDefault = useDefaultWhenEmpty !== false;
      const dateBasedDefault = getBaseTimesForDate(dateInput.value);
      const options =
        times && times.length ? times : shouldUseDefault ? dateBasedDefault : [];
      const previousValue = timeInput.value;
      timeInput.innerHTML = "";

      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Choisissez une heure";
      timeInput.appendChild(placeholder);

      if (!options.length) {
        const unavailable = document.createElement("option");
        unavailable.value = "";
        unavailable.textContent = "Aucun créneau disponible";
        timeInput.appendChild(unavailable);
      } else {
        options.forEach(function (time) {
          const option = document.createElement("option");
          option.value = time;
          option.textContent = time;
          timeInput.appendChild(option);
        });
      }

      if (options.includes(previousValue)) {
        timeInput.value = previousValue;
      } else {
        timeInput.value = "";
      }
    }

    async function refreshAvailability(date) {
      if (!date) {
        renderTimeOptions(getBaseTimesForDate(""));
        return;
      }

      const selectedDay = new Date(`${date}T00:00:00`).getDay();
      if (selectedDay === 0) {
        renderTimeOptions([], false);
        errorContainer.textContent =
          "Le salon est fermé le dimanche. Merci de choisir un autre jour.";
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/availability?date=${encodeURIComponent(date)}`
        );
        if (!response.ok) {
          throw new Error("Erreur de disponibilité");
        }
        const payload = await response.json();
        renderTimeOptions(payload.available || [], false);
        if (!(payload.available || []).length) {
          errorContainer.textContent = "Aucun créneau disponible pour cette date.";
        } else {
          errorContainer.textContent = "";
        }
      } catch (error) {
        console.error("[BOOKING] Erreur availability:", error);
        renderTimeOptions(getBaseTimesForDate(date));
      }
    }

    function rejectSundaySelection() {
      dateInput.value = "";
      renderTimeOptions(getBaseTimesForDate(""));
      errorContainer.textContent =
        "Le salon est fermé le dimanche. Merci de choisir un autre jour.";
    }

    function validateForm() {
      if (
        !nameInput.value.trim() ||
        !emailInput.value.trim() ||
        !serviceInput.value ||
        !dateInput.value ||
        !timeInput.value
      ) {
        errorContainer.textContent =
          "Merci de renseigner votre nom, email, service, date et heure.";
        return false;
      }

      if (!emailInput.checkValidity()) {
        errorContainer.textContent = "Merci de saisir une adresse email valide.";
        return false;
      }

      const selectedDay = new Date(`${dateInput.value}T00:00:00`).getDay();
      if (selectedDay === 0) {
        errorContainer.textContent =
          "Le salon est fermé le dimanche. Merci de choisir un autre jour.";
        return false;
      }
      errorContainer.textContent = "";
      return true;
    }

    renderTimeOptions(getBaseTimesForDate(""));

    dateInput.addEventListener("change", function () {
      const value = dateInput.value;
      if (!value) {
        refreshAvailability("");
        return;
      }

      const selectedDay = new Date(`${value}T00:00:00`).getDay();
      if (selectedDay === 0) {
        rejectSundaySelection();
        return;
      }

      refreshAvailability(value);
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!API_BASE_URL) {
        errorContainer.textContent =
          "API en ligne non configurée. Ajoutez votre URL Railway dans api-config.js.";
        return;
      }
      if (!validateForm()) {
        return;
      }

      const payload = {
        fullName: nameInput.value.trim(),
        email: emailInput.value.trim(),
        service: serviceInput.value,
        date: dateInput.value,
        time: timeInput.value,
      };

      try {
        setSubmitLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/bookings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
          errorContainer.textContent =
            data.error || "Impossible d'enregistrer la réservation.";
          if (response.status === 409) {
            await refreshAvailability(dateInput.value);
          }
          return;
        }

        if (data.emailStatus === "sent") {
          showToast("Demande envoyée. Vous recevrez un email de suivi.");
          showSuccessPopup("Reservation enregistree avec succes.");
        } else if (data.emailStatus === "simulated") {
          showToast("Demande envoyée. Email en mode test.");
          showSuccessPopup("Reservation enregistree avec succes.");
        } else {
          showToast("Demande envoyée. Email non envoyé, merci de contacter le salon.");
          showSuccessPopup("Reservation enregistree avec succes.");
        }

        if (data.firstVisitDiscountApplied) {
          showToast("Reduction -10% premiere reservation confirmee.");
          setFirstVisitDiscountActive(false);
        }
        errorContainer.textContent = "";
        form.reset();
        dateInput.min = today;
        renderTimeOptions(getBaseTimesForDate(""));
        highlightSuccess(form);
      } catch (error) {
        console.error("[BOOKING] Erreur création réservation:", error);
        errorContainer.textContent =
          "Le serveur de réservation est indisponible. Merci de réessayer.";
      } finally {
        setSubmitLoading(false);
      }
    });

    reserveButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const selectedService = button.getAttribute("data-service");
        if (selectedService) {
          serviceInput.value = selectedService;
        }
        const reservationSection = document.getElementById("reservation");
        if (reservationSection) {
          reservationSection.scrollIntoView({ behavior: "smooth" });
        }
        serviceInput.focus();
      });
    });
  }

  const isHomePage =
    window.location.pathname.endsWith("index.html") || window.location.pathname === "/";

  if (isHomePage && !isFirstVisitPromoSeen()) {
    const onFirstScroll = function () {
      if (window.scrollY < 260 || promoPopupVisible) return;
      showFirstVisitPromoPopup();
      window.removeEventListener("scroll", onFirstScroll);
    };
    window.addEventListener("scroll", onFirstScroll, { passive: true });
  }

  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    const contactNameInput = contactForm.querySelector('[name="fullName"]');
    const contactEmailInput = contactForm.querySelector('[name="email"]');
    const contactSubjectInput = contactForm.querySelector('[name="subject"]');
    const contactMessageInput = contactForm.querySelector('[name="message"]');
    const contactSubmitButton = contactForm.querySelector('button[type="submit"]');
    const contactFeedback = document.getElementById("contactFormFeedback");

    function setContactLoading(loading) {
      if (!contactSubmitButton) return;
      contactSubmitButton.disabled = loading;
      contactSubmitButton.classList.toggle("is-loading", loading);
      contactSubmitButton.setAttribute("aria-busy", loading ? "true" : "false");
      contactSubmitButton.textContent = loading ? "Envoi..." : "Envoyer";
    }

    function setContactFeedback(message, type) {
      if (!contactFeedback) return;
      contactFeedback.textContent = message;
      contactFeedback.classList.remove("is-error", "is-success");
      if (type === "error") {
        contactFeedback.classList.add("is-error");
      } else if (type === "success") {
        contactFeedback.classList.add("is-success");
      }
    }

    function validateContactForm() {
      if (
        !contactNameInput ||
        !contactEmailInput ||
        !contactSubjectInput ||
        !contactMessageInput
      ) {
        return false;
      }

      if (
        !contactNameInput.value.trim() ||
        !contactEmailInput.value.trim() ||
        !contactSubjectInput.value.trim() ||
        !contactMessageInput.value.trim()
      ) {
        setContactFeedback("Merci de remplir tous les champs du formulaire.", "error");
        return false;
      }

      if (!contactEmailInput.checkValidity()) {
        setContactFeedback("Merci de saisir une adresse email valide.", "error");
        return false;
      }

      if (contactMessageInput.value.trim().length < 10) {
        setContactFeedback("Votre message doit contenir au moins 10 caractères.", "error");
        return false;
      }

      setContactFeedback("", "");
      return true;
    }

    contactForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!validateContactForm()) return;

      const payload = {
        fullName: contactNameInput.value.trim(),
        email: contactEmailInput.value.trim(),
        subject: contactSubjectInput.value.trim(),
        message: contactMessageInput.value.trim(),
      };

      try {
        setContactLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/contact`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json();

        if (!response.ok) {
          setContactFeedback(
            data.error || "Impossible d'envoyer votre message pour le moment.",
            "error"
          );
          return;
        }

        contactForm.reset();
        if (data.emailStatus === "sent") {
          setContactFeedback(
            "Message envoyé. Merci, nous vous répondrons rapidement par mail.",
            "success"
          );
          showSuccessPopup("Message envoye avec succes.");
          highlightSuccess(contactForm);
        } else {
          setContactFeedback(
            "Message enregistré, mais l'email n'a pas pu être envoyé automatiquement.",
            "error"
          );
        }
      } catch (error) {
        console.error("[CONTACT] Erreur envoi formulaire:", error);
        setContactFeedback(
          "Le serveur est indisponible. Merci de réessayer dans quelques instants.",
          "error"
        );
      } finally {
        setContactLoading(false);
      }
    });
  }

  // Ensure logo links to #top always trigger smooth scroll on homepage.
  if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
    const topLinks = document.querySelectorAll('a[href="#top"]');
    topLinks.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }
})();
