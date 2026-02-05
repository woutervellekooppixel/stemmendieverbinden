(() => {
	// Hide logo if missing, without inline JS attributes (CSP-friendly)
	for (const img of document.querySelectorAll("img.brandLogo")) {
		img.addEventListener("error", () => {
			img.style.display = "none";
		});
	}

	// Mobile nav (works on every page)
	const navToggle = document.querySelector("[data-nav-toggle]");
	const navLinks = document.getElementById("nav-links");
	const navWrap = document.querySelector("[data-nav]");

	const closeNav = () => {
		if (!navWrap || !navToggle) return;
		navWrap.removeAttribute("data-open");
		navToggle.setAttribute("aria-expanded", "false");
	};

	const openNav = () => {
		if (!navWrap || !navToggle) return;
		navWrap.setAttribute("data-open", "true");
		navToggle.setAttribute("aria-expanded", "true");
	};

	if (navToggle && navLinks && navWrap) {
		navToggle.addEventListener("click", () => {
			const isOpen = navWrap.getAttribute("data-open") === "true";
			if (isOpen) closeNav();
			else openNav();
		});

		navLinks.addEventListener("click", (event) => {
			const target = event.target;
			if (target instanceof HTMLElement && target.closest("a")) closeNav();
		});

		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape") closeNav();
		});

		document.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (navWrap.contains(target)) return;
			closeNav();
		});
	}

	// Active nav item (no build tooling; keep it simple)
	const current = (() => {
		const path = window.location.pathname;
		const last = path.split("/").filter(Boolean).pop();
		return last || "index.html";
	})();

	for (const link of document.querySelectorAll("[data-nav] a[href]")) {
		const href = link.getAttribute("href") || "";
		const normalizedHref = href.replace(/^\.\//, "");
		const isHome = current === "index.html" && (normalizedHref === "index.html" || normalizedHref === "./" || normalizedHref === "/");
		const isActive = isHome || normalizedHref.endsWith(current);
		if (isActive) {
			link.setAttribute("aria-current", "page");
		}
	}

	// Subscribe form logic (only on the signup page)
	const form = document.getElementById("mc-embedded-subscribe-form");
	if (!form) return;

	const submitButton = document.getElementById("mc-embedded-subscribe");
	const errorEl = document.getElementById("mce-error-response");
	const successEl = document.getElementById("mce-success-response");

	const startField = document.getElementById("form-start");
	if (startField) startField.value = String(Date.now());

	const setResponse = (type, message) => {
		if (errorEl) {
			errorEl.style.display = type === "error" ? "block" : "none";
			errorEl.textContent = type === "error" ? message : "";
		}
		if (successEl) {
			successEl.style.display = type === "success" ? "block" : "none";
			successEl.textContent = type === "success" ? message : "";
		}
	};

	form.addEventListener("submit", async (event) => {
		event.preventDefault();

		setResponse("error", "");
		setResponse("success", "");

		// Use native validation first
		if (!form.reportValidity()) return;

		const endpoint = form.getAttribute("data-endpoint") || "/api/subscribe";
		const formData = new FormData(form);
		const payload = Object.fromEntries(formData.entries());

		if (submitButton) {
			submitButton.setAttribute("disabled", "");
			submitButton.value = "Bezig met inschrijven…";
		}

		try {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Accept": "application/json",
				},
				body: JSON.stringify(payload),
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data?.message || "Er ging iets mis. Probeer het later opnieuw.");
			}

			setResponse(
				"success",
				data?.message || "Gelukt. Je inschrijving is ontvangen."
			);
			form.reset();
			if (startField) startField.value = String(Date.now());
		} catch (error) {
			setResponse(
				"error",
				error instanceof Error ? error.message : "Er ging iets mis. Probeer het later opnieuw."
			);
		} finally {
			if (submitButton) {
				submitButton.removeAttribute("disabled");
				submitButton.value = "Inschrijven";
			}
		}
	});
})();
