# Family Cabinet security hardening review — 2026-11-19

Review basis: `master` at `29bd8a8849bec65ba603c124bd5b9bb95a1ceada`, compared with proposed changes on branch `security/family-cabinet-hardening-20261119`.

**Scope:** static Astro application, content/publication controls, archive URL handling, GitHub Pages build, dependency supply chain and CI permissions. No accounts, server API, authentication, or database are part of this site.

**Status:** Proposed code hardening, pending PR checks and manual browser verification. This is not a penetration test or independent production security certification.

## Findings and remediation status

| ID | Severity | Source finding | Action in this branch | Remaining limitation |
| --- | --- | --- | --- | --- |
| FC-SEC-01 | Medium | The `visibility` guard checked only collection Markdown; committed files in a **public GitHub repo** are accessible even if a build rejects them. | Added `scripts/public-assets.mjs` before Astro processes content, restricting types of public assets, checking references, forbidding active/remote SVG content and common JPEG/PNG/WebP metadata. Added regression tests and explicit publication instructions in README. | **Partially addressed.** Manual editorial approval is required for personal information in Markdown, translations, SVG text and files outside approved asset directories. Nothing can undo exposure of data already committed to public Git history. |
| FC-SEC-02 | Medium architectural risk | Sites deployed to different paths under `leo0331.github.io` share one browser origin. | Documented the boundary and hosting recommendation below. This project itself has no login or browser storage. | **Open**: isolate future authenticated/sensitive projects on different hostnames where appropriate. Cannot change other projects or DNS from this PR. |
| FC-SEC-03 | Medium | Build CI did not scan dependency advisories or committed secrets. | Added `npm audit --audit-level=high` (including Astro build dependencies) and Gitleaks v8.30.1 Git-history scan, pinned to the official Linux AMD64 container digest. Deployment now waits on both. | CI results require successful PR runs; secret scanners can miss custom credentials or flag false positives; GitHub Advanced Security/secret scanning settings were not independently confirmed. |
| FC-SEC-04 | Low | Generated URL validator accepted `javascript:` and `data:` links. | Rejects unsupported URL schemes, non-navigation `mailto:`/`tel:` use and insecure HTTP embedded resources; adds negative tests. | Build checks are not a sanitizer for arbitrary untrusted HTML; the archive remains curated source content. |
| FC-SEC-05 | Low | No explicit generated Content Security Policy. | Enables Astro 7's hash-aware `security.csp` with restrictive local sources, blocked objects/frames, local form actions and no network connections except self; build audit checks for CSP per generated HTML page. | Meta CSP cannot enforce all HTTP-header directives (e.g. `frame-ancestors`). Browser inspection of bilingual filtering/print routes is still required. `'self'` covers all same-origin GitHub Pages paths, not only this project. |
| FC-SEC-06 | Low | Build/PR job requested `pages:write`. | Build job is `contents:read` only; `pages:write`/`id-token:write` is limited to deploy job; Pages configuration moved to deploy step. | Pinned tags are still used for GitHub first-party actions; commit-SHA pinning is a separate supply-chain governance choice. |

## Existing controls retained

- `assertPublicContent` fails closed for missing, duplicate, `family`, or `private` visibility on collection Markdown.
- `getPublicObjects` and related records filter to public entries.
- Archive query length is bounded and facets/sorts are restricted to known values; DOM changes avoid injecting untrusted HTML.
- GitHub Actions builds and verifies the bilingual static output before deployment, and the repo uses Dependabot updates.

## Publish safely: checklist

1. Store *all* private family originals and drafts outside this public repository, including non-rendered paths and commit history; never use GitHub's build failure as a privacy mechanism.
2. Obtain explicit permission for any real family story or photograph. Check both English Markdown and Chinese translations, captions, SVG text, filenames, location hints and inadvertent identifying details.
3. Export publication-safe images with camera metadata removed. The new image guard rejects common EXIF/XMP/PNG metadata but does not guarantee every possible metadata format is absent. Keep image size at most 10 MB and use only SVG/PNG/JPEG/WebP. Add published assets under the associated `src/assets/items/` record directory.
4. Run `npm ci`, `npm audit --audit-level=high`, `npm run check`, `npm test`, `npm run build`, `npm run verify:build`. Review Gitleaks results in CI; do not add blanket allowlists to suppress a genuine disclosure.
5. If credentials ever enter a public commit, rotate/revoke them immediately and treat Git history as exposed. Deleting the working-tree copy is insufficient.
6. Review the deployed English and Traditional Chinese archive search, language switch, images, related links, page navigation and print action under CSP. Monitor browser console for violations.

## Same-origin note

All `https://leo0331.github.io/<repo>/` projects share an origin. `localStorage`, IndexedDB and same-origin script trust are not separated by pathname. Future sites that handle user tokens or sensitive browser state should use separate origins and appropriate origin-scoped isolation controls; moving only this public static archive is not essential.

## Validation evidence and limitations

The previous `master` Pages deployment succeeded on 2026-11-15; it **does not validate this branch**. This remediation must be validated via the PR's check/test/build/secret-scan jobs. Production Pages deployment is not requested before owner approval and merge. No live runtime penetration testing, GitHub security-alert inventory, DNS configuration verification, or manual inspection of future real photographs was performed.
