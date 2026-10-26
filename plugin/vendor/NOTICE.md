# Bundled lyric renderer

Apple Music Like Lyrics (AMLL) core 0.6.0

- Upstream source: https://github.com/amll-dev/applemusic-like-lyrics/tree/main/packages/core
- Package: https://www.npmjs.com/package/@applemusic-like-lyrics/core/v/0.6.0
- License: AGPL-3.0-only; full text in `AMLL-LICENSE.txt`.
- One source modification, applied at build time by `scripts/build.mjs`: `LyricLineBase.shouldEmphasize` allows held non-CJK words of up to 12 characters (upstream: 7) to receive the long-note emphasis, so words such as "multiply" are highlighted. `plugin/amll-entry.js`, `plugin/lyrics.mjs`, and `scripts/build.mjs` describe the local integration and reproducible bundle entry.
- The bundle's additional retained license comments are in `amll.js.LEGAL.txt`. Package versions are pinned in the root lockfile.

The integration uses only the DOM lyric renderer. It does not instantiate an AMLL/Pixi background renderer or request lyric data from third-party servers.
