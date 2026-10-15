# Sin login: Turnstile + límite por IP

La herramienta no tiene cuentas. Crear un Trabajo exige un token de Cloudflare Turnstile verificado en el servidor (éxito, hostname y action; los tokens reusados se rechazan) y respeta límites diarios por IP (2 PDF y 10 MusicXML), hasta 10 exportaciones por Trabajo y un presupuesto mensual que, al agotarse, pausa los Trabajos nuevos.

## Por qué no alcanza CORS

CORS restringe lo que hace un navegador, no lo que hace un script con `curl`. La API es pública; CORS se mantiene al sitio y a localhost por prolijidad, pero la garantía son Turnstile y los límites.

## Alternativas descartadas

- **Cognito / login.** Obliga a registrarse para una herramienta ocasional, agrega fricción y datos personales que luego hay que proteger y declarar. Turnstile es casi siempre invisible.
- **AWS WAF.** Tiene costo fijo mensual (web ACL y reglas) que supera el gasto esperado de toda la herramienta, y no distingue personas de scripts mejor que Turnstile.

## Consecuencias

- El secret de Turnstile vive en un parámetro cifrado de AWS cargado por el dueño; nunca en el repo.
- Se guardan IPs solo para contar límites, con borrado automático (TTL).
- Compartir IP (CGNAT, oficinas) puede agotar el límite diario de varios visitantes; se acepta a este volumen.
