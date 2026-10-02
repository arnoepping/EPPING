# Domain cutover: eppingmusic.com → GitHub Pages

## Why
The site is broken at https://arnoepping.github.io/EPPING/. Its CSS/JS load from `/_astro/...`, and under the `/EPPING/` subpath those paths 404. On the custom domain the site is served from the root, so the paths work. No code change is needed.

## Never touch
MX, SPF (TXT `v=spf1 ...`) and `google._domainkey`. Email runs on Google Workspace.

## Steps
1. **GitHub, verify the domain:** github.com → profile Settings → Pages → Add a domain → `eppingmusic.com`. Copy the TXT record name and value it shows.
2. **Squarespace Domains → eppingmusic.com → DNS settings:**
   - Delete the **Squarespace Defaults** preset (A records 198.x and `www` → `ext-sq.squarespace.com`). Keep the Google Workspace records.
   - Add 4 **A** records, host `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Add 4 **AAAA** records, host `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - Add **CNAME** `www` → `arnoepping.github.io`
   - Add the **TXT** record from step 1.
3. **Wait for DNS** (minutes to a few hours). Check in Terminal: `dig +short A eppingmusic.com @8.8.8.8`. You should see only the four `185.199.x.153` IPs.
4. **Check email is untouched:** `dig +short MX eppingmusic.com` should still show `1 smtp.google.com.`
5. **GitHub:** profile Settings → Pages → **Verify** the domain.
6. **Repo** github.com/arnoepping/EPPING → Settings → Pages → Custom domain: `eppingmusic.com` → Save. (In the terminal instead: `gh api -X PUT repos/arnoepping/EPPING/pages -f cname=eppingmusic.com`.) Once the DNS check is green, tick **Enforce HTTPS**. The certificate can take up to about an hour.
7. **Check** https://eppingmusic.com: the tunnel and 3D should work. https://www.eppingmusic.com should redirect to it.
8. **Cancel the Squarespace website subscription.** Cancel the website only, not the domain.

A local DNS snapshot from before the switch is at `.superpowers/sdd/2026-10-02-deploy-pipeline/dns-before.txt`.
