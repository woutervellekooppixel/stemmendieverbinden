# stemmendieverbinden

Statische pagina met inschrijfformulier (Mailchimp via Vercel API-route).

## Deploy (Vercel)

- Import deze repo in Vercel.
- Zet bij **Project Settings → Environment Variables**:
	- `MAILCHIMP_API_KEY`
	- `MAILCHIMP_SERVER_PREFIX` (bijv. `us5`)
	- `MAILCHIMP_LIST_ID`
	- `ALLOWED_ORIGINS` (optioneel, komma-gescheiden allowlist; standaard is alleen same-origin toegestaan)

Daarna opnieuw deployen.

## Waarom via API?

Het formulier post niet direct naar Mailchimp (wat je naar een Engelse Mailchimp pagina/captcha stuurt),
maar blijft op de pagina en toont succes/foutmeldingen in de eigen styling.

## Security

- `vercel.json` zet strikte security headers (incl. CSP) voor de hele site.
- De API-route valideert input streng, checkt `Origin` (via `ALLOWED_ORIGINS`) en heeft een basis rate-limit.
