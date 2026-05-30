# Supported Link Shorteners

This document provides a comprehensive list of the link shorteners and ad-networks that our bypasser engine can successfully bypass.

## 🚀 Natively Supported (Instant Bypass)
Our custom engine and integrated `PyBypass` package support bypassing the following popular domains instantly:

*   `tpi.li`
*   `oii.la`
*   `vplink.in`
*   `droplink.co` / `droplink.in`
*   `rocklinks.net`
*   `shrinkme.io`
*   `mahnokari.com`
*   `studyeducations.com`
*   `asmultiverse.com`
*   `ouo.io` / `ouo.press`
*   `adf.ly`
*   `linkvertise.com`
*   `shorte.st`
*   `clicksfly.com`
*   `gplinks.in` / `gplinks.co`

*(This list is not exhaustive. Dozens of other minor ad-networks and wrappers are automatically decrypted by the engine.)*

---

## 🛡️ Protected Domains (Manual Click Required)
Some highly aggressive ad-networks use specialized Cloudflare Turnstile, ReCAPTCHA, or client-side JavaScript obfuscation that strictly checks for a real human browser. 

Our system automatically detects these and will prompt you to open them in your browser first to pass the security check.

*   `links.olamovies.mov` *(Cloudflare Turnstile + Math Captcha)*
*   `fc-lc.xyz` / `fc.lc` *(Client-side JS + Invisible Captcha)*

**How to handle these:** 
When you encounter one of these, simply click the link, pass the Captcha or wait for the timer on your own browser, and it will redirect you to an intermediate link (like `tpi.li` or `oii.la`). You can then paste that new link into the bypasser, and it will instantly reveal the final destination!
