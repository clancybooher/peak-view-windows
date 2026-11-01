# Deploy

Merges to `main` deploy automatically to the Cloudflare Worker `peak-view-windows`, which serves peakvieworegon.com and www.peakvieworegon.com. There is no build step. Wrangler publishes `worker.js` together with the static assets in this repository. Deploys go to Cloudflare Workers only.

## Required repository secrets

Add these under GitHub → Settings → Secrets and variables → Actions before merging:

- `CLOUDFLARE_API_TOKEN` — Workers Scripts:Edit and Workers Routes:Edit on the peakvieworegon.com zone
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account that owns the Worker

Do not commit either value.

## Manual deploy

Open the Actions tab, choose **Deploy**, and run the workflow. From a machine that is already logged in to Wrangler, the same publish is `npx wrangler deploy`.
