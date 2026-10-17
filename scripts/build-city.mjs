// Forward npm's city arguments before updating the README and city map.
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/city-build.mjs',...process.argv.slice(2)],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/cities-readme.mjs'],{stdio:'inherit'});
