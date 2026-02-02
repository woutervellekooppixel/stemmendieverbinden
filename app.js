(() => {
	const form = document.getElementById("mc-embedded-subscribe-form");
	if (!form) return;

	// Hide logo if missing, without inline JS attributes (CSP-friendly)
	for (const img of document.querySelectorAll("img.brandLogo")) {
		img.addEventListener("error", () => {
			img.style.display = "none";
		});
	}

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
				data?.message || "Gelukt. Check je e-mail voor de bevestiging van je inschrijving."
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
