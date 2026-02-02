import crypto from "crypto";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

function getClientIp(req) {
	const xff = req.headers["x-forwarded-for"]; // "client, proxy1, proxy2"
	if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
	const realIp = req.headers["x-real-ip"];
	if (typeof realIp === "string" && realIp.length > 0) return realIp.trim();
	return "unknown";
}

function parseAllowedOrigins() {
	const raw = process.env.ALLOWED_ORIGINS || "";
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function isOriginAllowed(req) {
	const origin = req.headers.origin;
	if (!origin) return process.env.NODE_ENV !== "production";

	const allowed = parseAllowedOrigins();
	if (allowed.length > 0) return allowed.includes(origin);

	// Default: same-origin only
	try {
		const originUrl = new URL(origin);
		const host = String(req.headers.host || "");
		return originUrl.host === host;
	} catch {
		return false;
	}
}

function takeRateLimitToken(ip) {
	const now = Date.now();
	const store = (globalThis.__rateLimitStore ??= new Map());
	const existing = store.get(ip);
	if (!existing || now >= existing.resetAt) {
		store.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return { ok: true, remaining: RATE_LIMIT_MAX - 1 };
	}
	if (existing.count >= RATE_LIMIT_MAX) {
		return { ok: false, remaining: 0, resetAt: existing.resetAt };
	}
	existing.count += 1;
	store.set(ip, existing);
	return { ok: true, remaining: RATE_LIMIT_MAX - existing.count };
}

function clampString(value, maxLen) {
	const s = String(value ?? "").trim();
	return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function isValidEmail(email) {
	// pragmatic email check (Mailchimp will do final validation)
	if (email.length < 5 || email.length > 254) return false;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.setHeader("Cache-Control", "no-store");

	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ message: "Alleen POST is toegestaan." });
	}

	if (!isOriginAllowed(req)) {
		return res.status(403).json({ message: "Niet toegestaan." });
	}

	const ip = getClientIp(req);
	const rate = takeRateLimitToken(ip);
	if (!rate.ok) {
		return res.status(429).json({ message: "Te veel pogingen. Probeer het later opnieuw." });
	}

	const contentType = String(req.headers["content-type"] || "");
	if (!contentType.toLowerCase().includes("application/json")) {
		return res.status(415).json({ message: "Ongeldig formaat (JSON vereist)." });
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
		if (!body || typeof body !== "object") {
			return res.status(400).json({ message: "Ongeldige invoer." });
		}

		// Honeypot field from the embed
		const honeypot = clampString(body?.b_c9c512e493e7843d1aaf9a471_2519fc7af4, 200);
		if (honeypot) {
			return res.status(200).json({ ok: true, message: "Gelukt." });
		}

		// Timing check (basic bot heuristic)
		const start = Number(body?._start);
		if (Number.isFinite(start)) {
			const elapsed = Date.now() - start;
			if (elapsed >= 0 && elapsed < 800) {
				return res.status(200).json({ ok: true, message: "Gelukt." });
			}
		}

		const emailRaw = clampString(body?.EMAIL, 254).toLowerCase();
		const firstName = clampString(body?.FNAME, 80);
		const lastName = clampString(body?.LNAME, 80);
		const organisatie = clampString(body?.ORGANISATI, 120);
		const leeftijd = clampString(body?.LEEFTIJD, 40);
		const heardFrom = clampString(body?.MMERGE7, 200);
		const needs = clampString(body?.MMERGE8, 200);

		const allowedLeeftijd = new Set(["< 24", "25-30", "31-45", "46-60", "60 >", "Wil ik niet zeggen"]);
		if (!emailRaw || !firstName || !lastName || !leeftijd) {
			return res.status(400).json({ message: "Vul alle verplichte velden in." });
		}
		if (!isValidEmail(emailRaw)) {
			return res.status(400).json({ message: "Vul een geldig e-mailadres in." });
		}
		if (!allowedLeeftijd.has(leeftijd)) {
			return res.status(400).json({ message: "Kies een geldige leeftijdscategorie." });
		}

		const subscriberHash = crypto.createHash("md5").update(emailRaw).digest("hex");
		const auth = Buffer.from(`anystring:${apiKey}`).toString("base64");
		const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`;

		// PUT is idempotent; status_if_new ensures double opt-in for new members
		const mcResponse = await fetch(url, {
			method: "PUT",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email_address: emailRaw,
				status_if_new: "pending",
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

			// Keep messages user-friendly; avoid leaking internals
			if (title.toLowerCase().includes("invalid resource")) {
				return res.status(400).json({ message: "Controleer je invoer en probeer het opnieuw." });
			}

			if (detail && process.env.NODE_ENV !== "production") {
				return res.status(400).json({ message: detail });
			}

			return res.status(500).json({ message: "Inschrijven mislukt. Probeer het later opnieuw." });
		}

		const status = String(mcJson?.status || "");
		if (status === "subscribed") {
			return res.status(200).json({ ok: true, message: "Je bent al ingeschreven." });
		}

		return res
			.status(200)
			.json({ ok: true, message: "Gelukt. Check je e-mail om je inschrijving te bevestigen." });
	} catch {
		return res.status(500).json({ message: "Serverfout. Probeer het later opnieuw." });
	}
}
