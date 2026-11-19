# 🐚 2shelldetector

Is there a `<thing>2shell` yet? Find out before your CISO does.

**Live at https://teixeirarafael.github.io/2shelldetector/**

Type any term and 2shelldetector checks the internet for a vulnerability called `<term>2shell`
(think React2Shell, PHP2Shell). If one exists you get a search-results page, a Shell-o-meter and
the related CVEs with live CVSS scores. If not, you get a randomly picked, very reassuring joke.

## Run it

It is a plain static site: no build step, no API keys, no backend.

```bash
python3 -m http.server 8642
```

Then open http://localhost:8642. Shareable links work too: `http://localhost:8642/?q=php`.

## How it works

All searches run in the visitor's browser against public APIs that allow cross-origin calls:

| Source | Used for |
| --- | --- |
| Hacker News (Algolia API) | News and articles |
| GitHub search API | PoCs, scanners, joke repos |
| Wikipedia API | "Is this a real, named thing?" |
| NVD CVE API | CVSS score for CVE IDs found in the results |

Results only count if they literally contain `<term>2shell` (also `<term>-2-shell`, `<term> 2shell`),
so a fuzzy match on "php shell" does not set off the alarm.

The Shell-o-meter is the number of sources that found it, plus one if CVE IDs show up and at least
two sources agree. One lonely GitHub repo is an "Unconfirmed sighting"; Wikipedia, HN, GitHub and
CVEs together is a "Full-blown 2shell".

## Files

- `index.html`: the page
- `style.css`: styles, light and dark
- `app.js`: searching, matching and rendering
- `messages.js`: the jokes, loading quips and "famous cousin" easter eggs (log → Log4Shell, bash → Shellshock...). Add your own here.

## Deploying

It is served by GitHub Pages straight from the `main` branch root, so every push to `main`
redeploys the site in about a minute. The empty `.nojekyll` file tells Pages to serve the files
as-is instead of running them through Jekyll.

Any other static host works too (Netlify, Cloudflare Pages, an S3 bucket): just upload the folder.

## Limits

- GitHub allows 10 unauthenticated searches per minute per visitor IP. When it says no, the chip
  turns amber and the verdict says that source did not answer.
- NVD allows about 5 requests per 30 seconds without a key, so CVE scores can occasionally be missing.
- This is a joke. It is not a vulnerability scanner.
