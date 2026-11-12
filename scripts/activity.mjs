import fs from 'node:fs/promises';

// No external chart services or packages. The token is read only at runtime.
const login = process.env.PROFILE_LOGIN || 'eman-110';
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is required to read the contribution calendar.');
const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `query($login:String!){ user(login:$login){ contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date weekday contributionCount contributionLevel } } } } } }`,
    variables: { login }
  })
});
if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
const result = await response.json();
if (result.errors || !result.data?.user) throw new Error('GitHub did not return a contribution calendar.');
const calendar = result.data.user.contributionsCollection.contributionCalendar;
const days = calendar.weeks.flatMap(w=>w.contributionDays);
const active = days.filter(d=>d.contributionCount>0).length;
let longest=0, streak=0;
for(const day of days){streak=day.contributionCount>0?streak+1:0;longest=Math.max(longest,streak);}
const palette={NONE:'#302d29',FIRST_QUARTILE:'#66523e',SECOND_QUARTILE:'#977552',THIRD_QUARTILE:'#c6a37c',FOURTH_QUARTILE:'#ead2b2'};
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const label=(x,y,value,size=16,fill='#c3b8ab')=>`<text x="${x}" y="${y}" font-family="Segoe UI,Arial,sans-serif" font-size="${size}" fill="${fill}">${escape(value)}</text>`;
let cells='',months='',lastMonth='';
calendar.weeks.forEach((week,col)=>{
 const month=week.contributionDays[0].date.slice(0,7);
 if(month!==lastMonth && col<calendar.weeks.length-2){months+=label(36+col*19,163,new Date(week.contributionDays[0].date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}),12);lastMonth=month;}
 week.contributionDays.forEach(day=>{cells+=`<rect x="${36+col*19}" y="${178+day.weekday*19}" width="14" height="14" rx="3" fill="${palette[day.contributionLevel]||palette.NONE}"><title>${day.date}: ${day.contributionCount} contributions</title></rect>`;});
});
const width=1100;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="370" viewBox="0 0 ${width} 370" role="img" aria-label="GitHub contributions for ${escape(login)}"><style>.sweep{animation:scan 14s linear infinite}@keyframes scan{0%,12%{transform:translateX(0);opacity:0}15%{opacity:.5}85%{opacity:.5}90%,100%{transform:translateX(1015px);opacity:0}}@media(prefers-reduced-motion:reduce){.sweep{display:none}}</style><rect width="1100" height="370" rx="20" fill="#191919"/>${label(36,42,'A YEAR OF BUILDING',16,'#ddc3a8')}${label(36,94,calendar.totalContributions.toLocaleString('en-US'),36,'#f4e9dc')}${label(36,122,'contributions',15)}${label(380,94,active,36,'#f4e9dc')}${label(380,122,'active days',15)}${label(724,94,longest+' days',36,'#f4e9dc')}${label(724,122,'longest streak',15)}${months}${cells}<rect class="sweep" x="36" y="175" width="2" height="136" fill="#f1ddc3" opacity="0"/>${label(36,346,days[0].date+' — '+days.at(-1).date,12)}${label(725,346,'Public activity · Updated daily',13)}</svg>`;
await fs.mkdir('assets',{recursive:true});
await fs.writeFile('assets/activity.svg',svg);
console.log(`Rendered ${days.length} calendar days for ${login}.`);
