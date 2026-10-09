// Reads local secrets from the environment or the git-ignored .env.local.
// Only scripts use these; nothing here is bundled into the game.
import fs from 'node:fs';
export function env(name){
 if(process.env[name])return process.env[name].trim();
 if(!fs.existsSync('.env.local'))return '';
 const line=fs.readFileSync('.env.local','utf8').split('\n').find(l=>new RegExp(`^\\s*${name}\\s*=`).test(l));
 return line?line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g,''):'';
}
