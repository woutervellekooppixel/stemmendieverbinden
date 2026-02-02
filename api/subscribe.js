export default async function handler(req, res) {
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ message: "Method not allowed" });
	}

	try {
		const apiKey = process.env.MAILCHIMP_API_KEY;
		const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX; // e.g. us5
		const listId = process.env.MAILCHIMP_LIST_ID;

		if (!apiKey || !serverPrefix || !listId) {
			return res.status(500).json({
				message:
					"Server is niet volledig ingesteld (MAILCHIMP_API_KEY / MAILCHIMP_SERVER_PREFIX / MAILCHIMP_LIST_ID).",
			});
		}

		const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

		const email = String(body?.EMAIL || "").trim();
		const firstName = String(body?.FNAME || "").trim();
		const lastName = String(body?.LNAME || "").trim();
		const organisatie = String(body?.ORGANISATI || "").trim();
		const leeftijd = String(body?.LEEFTIJD || "").trim();
		const heardFrom = String(body?.MMERGE7 || "").trim();
		const needs = String(body?.MMERGE8 || "").trim();

		// Honeypot field from the embed
		const honeypot = String(body?.b_c9c512e493e7843d1aaf9a471_2519fc7af4 || "").trim();
		if (honeypot) {
			return res.status(200).json({ ok: true });
		}

		if (!email || !firstName || !lastName || !leeftijd) {
			return res.status(400).json({
				message: "Vul alle verplichte velden in.",
			});
		}

		const auth = Buffer.from(`anystring:${apiKey}`).toString("base64");
		const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members`;

		const mcResponse = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email_address: email,
				status: "pending", // double opt-in
				merge_fields: {
					FNAME: firstName,
					LNAME: lastName,
					ORGANISATI: organisatie,
					LEEFTIJD: leeftijd,
					MMERGE7: heardFrom,
					MMERGE8: needs,
				},
			}),
		});

		const mcJson = await mcResponse.json().catch(() => ({}));

		if (!mcResponse.ok) {
			const title = String(mcJson?.title || "");
			const detail = String(mcJson?.detail || "");

			if (title.toLowerCase().includes("member exists")) {
				return res.status(409).json({
					message: "Dit e-mailadres is al ingeschreven.",
				});
			}

			if (detail) {
				return res.status(400).json({ message: detail });
			}

			return res.status(500).json({ message: "Inschrijven mislukt. Probeer het later opnieuw." });
		}

		return res.status(200).json({ ok: true, status: mcJson?.status });
	} catch (error) {
		return res.status(500).json({
			message: error instanceof Error ? error.message : "Serverfout.",
		});
	}
}
