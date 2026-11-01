# Deploy

Production deploys of the Cloudflare Worker `peak-view-windows` (peakvieworegon.com and www.peakvieworegon.com) come from Cloudflare Workers Builds when changes merge to `main`. No GitHub repository secrets are required.

There is no build step. Workers Builds publishes `worker.js` together with the static assets in this repository.

## CI

Pull requests and pushes to `main` run a GitHub Actions check on Node 22. It runs `wrangler deploy --dry-run` and checks that `blog/posts.json` parses. That workflow does not deploy.
