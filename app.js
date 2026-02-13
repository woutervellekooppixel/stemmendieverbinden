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

	// Speaker bios: clamp + "Lees meer" toggle (program page)
	const bioToggles = Array.from(document.querySelectorAll(".bioToggle")).filter(
		(el) => el instanceof HTMLButtonElement
	);

	if (bioToggles.length) {
		const items = bioToggles
			.map((toggle) => {
				const card = toggle.closest(".speakerCard");
				const bio = card?.querySelector(".speakerBio");
				if (!(bio instanceof HTMLElement)) return null;

				if (!bio.id) {
					bio.id = `bio-${Math.random().toString(36).slice(2, 10)}`;
				}
				toggle.setAttribute("aria-controls", bio.id);
				return { toggle, bio };
			})
			.filter(Boolean);

		const COLLAPSED_LINES = 6;

		const getCollapsedHeight = (bio) => {
			const styles = window.getComputedStyle(bio);
			const lineHeight = Number.parseFloat(styles.lineHeight);
			if (Number.isFinite(lineHeight) && lineHeight > 0) {
				return Math.ceil(lineHeight * COLLAPSED_LINES);
			}
			const fontSize = Number.parseFloat(styles.fontSize) || 14;
			return Math.ceil(fontSize * 1.45 * COLLAPSED_LINES);
		};

		const setExpanded = (current, expanded, { animate = true } = {}) => {
			const { toggle, bio } = current;
			const collapsedHeight = getCollapsedHeight(bio);

			const applyState = () => {
				bio.classList.toggle("is-clamped", !expanded);
				bio.classList.toggle("is-expanded", expanded);
				toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
				toggle.textContent = expanded ? "Lees minder" : "Lees meer";
			};

			// Ensure we can animate max-height between two concrete values.
			if (!animate) {
				applyState();
				bio.style.maxHeight = expanded ? "none" : `${collapsedHeight}px`;
				return;
			}

			if (expanded) {
				applyState();
				bio.style.maxHeight = `${collapsedHeight}px`;
				// Next frame: animate to full height
				requestAnimationFrame(() => {
					bio.style.maxHeight = `${bio.scrollHeight}px`;
				});
			} else {
				// Start from current height, then animate down
				applyState();
				bio.style.maxHeight = `${bio.scrollHeight}px`;
				requestAnimationFrame(() => {
					bio.style.maxHeight = `${collapsedHeight}px`;
				});
			}
		};

		const collapseAllExcept = (exception) => {
			for (const item of items) {
				if (exception && item.bio === exception.bio) continue;
				setExpanded(item, false);
			}
		};

		// Initial clamp + hide toggles for short bios
		for (const item of items) {
			const collapsedHeight = getCollapsedHeight(item.bio);
			item.bio.style.maxHeight = `${collapsedHeight}px`;
			item.bio.classList.add("is-clamped");
			item.bio.classList.remove("is-expanded");
			item.toggle.setAttribute("aria-expanded", "false");
			item.toggle.textContent = "Lees meer";

			// If there's nothing to expand, hide the button.
			if (item.bio.scrollHeight <= collapsedHeight + 2) {
				item.toggle.style.display = "none";
			}
		}

		for (const item of items) {
			item.toggle.addEventListener("click", () => {
				const isExpanded = item.toggle.getAttribute("aria-expanded") === "true";
				if (!isExpanded) {
					collapseAllExcept(item);
					setExpanded(item, true);
				} else {
					setExpanded(item, false);
				}
			});
		}

		// Keep expanded height correct on resize.
		let resizeTimer;
		window.addEventListener("resize", () => {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(() => {
				for (const item of items) {
					const expanded = item.toggle.getAttribute("aria-expanded") === "true";
					const collapsedHeight = getCollapsedHeight(item.bio);
					if (expanded) item.bio.style.maxHeight = `${item.bio.scrollHeight}px`;
					else item.bio.style.maxHeight = `${collapsedHeight}px`;
				}
			}, 120);
		});
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
