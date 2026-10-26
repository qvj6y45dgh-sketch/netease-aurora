import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
// AMLL only gives held Latin words the long-note emphasis when they are at most 7 letters,
// which skips words like "multiply"; allow up to 12 letters instead.
const emphasizeLimit = {name:'amll-emphasize-limit', setup(b) {
  b.onLoad({filter:/amll-core\.mjs$/}, async args => {
    const source = await readFile(args.path, 'utf8');
    const from = 'word.word.trim().length <= 7';
    if (!source.includes(from)) throw new Error('AMLL emphasize rule not found; re-check the patch');
    return {contents:source.replace(from, 'word.word.trim().length <= 12'), loader:'js'};
  });
}};
await build({entryPoints:['plugin/amll-entry.js'],bundle:true,minify:true,format:'iife',globalName:'AuroraAMLL',target:['chrome116'],outfile:'plugin/vendor/amll.js',legalComments:'external',treeShaking:true,plugins:[emphasizeLimit]});
await build({entryPoints:['node_modules/@applemusic-like-lyrics/core/dist/style.css'],bundle:true,minify:true,target:['chrome116'],outfile:'plugin/vendor/amll.css',legalComments:'external'});
