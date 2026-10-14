# Sicherheit / Security

Dies ist ein Fork von [gyoridavid/short-video-maker](https://github.com/gyoridavid/short-video-maker)
(Pixabay statt Pexels). Der Server ist für den **lokalen Betrieb** gedacht
(`video-server.sh` bindet ihn an `127.0.0.1`); er hat keine Anmeldung und
gehört nicht ins offene Netz.

## Schwachstelle melden / Reporting a vulnerability

Bitte **nicht** als öffentliches Issue, sondern über
[„Report a vulnerability"](https://github.com/marcobockelbrink/short-video-maker/security/advisories/new)
im Reiter *Security*. Please use GitHub private vulnerability reporting, not a public issue.

Betrifft der Fund den Originalcode, hilft eine Meldung auch beim
[Original-Repository](https://github.com/gyoridavid/short-video-maker).

## Was hier automatisch läuft

| Schutz | Wo |
| --- | --- |
| Abhängigkeits-Warnungen und Sicherheits-Updates | Dependabot (`.github/dependabot.yml`, Repository-Einstellungen) |
| Statische Code-Analyse | CodeQL (`codeql.yml`) |
| Neue verwundbare Abhängigkeiten in Pull Requests | Dependency Review (`dependency-review.yml`) |
| Bekannte Lücken, Geheimnisse, Dockerfile-Fehler | Trivy, `pnpm audit`, Gitleaks, Hadolint (`security.yml`) |
| Lieferkette des Repositories | OpenSSF Scorecard (`scorecard.yml`) |
| Geheimnisse beim Push | GitHub Secret Scanning mit Push-Schutz |

Alle Actions sind auf eine Commit-Prüfsumme festgenagelt; Dependabot hebt sie an.

## Zugangsdaten

Der Pixabay-Schlüssel gehört in eine lokale `.env` (ist in `.gitignore`),
nie ins Repository.
