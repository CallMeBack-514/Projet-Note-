import {chromium} from '@playwright/test';
import {readFileSync} from 'node:fs';
const {password}=JSON.parse(readFileSync('.local/credentials.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const root='http://localhost:5173';
for(const [label,width,height] of [['desktop',1440,960],['mobile',375,812]]){
 const context=await browser.newContext({viewport:{width,height}});const page=await context.newPage();
 async function capture(file){await page.waitForFunction(()=>!document.documentElement.classList.contains('checking'));await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);await page.screenshot({path:'.impeccable/review/'+file+'.png',fullPage:true});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Débordement: '+file);}
 await page.goto(root+'/connexion');await capture('login-'+label);
 await page.getByLabel('Adresse courriel').fill('a@demo.example');await page.getByLabel('Mot de passe').fill(password);await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.waitForURL('**/dossiers');await capture(label);
 const link=await page.locator('.record-name').first().getAttribute('href');
 await page.goto(root+link);await capture('detail-'+label);await page.goto(root+link+'/transfert');await capture('transfer-'+label);
 if(label==='mobile'){await page.goto(root+'/dossiers/nouveau');await capture('new-mobile');}
 await context.close();
}
await browser.close();console.log('9 captures validées, aucun débordement.');
