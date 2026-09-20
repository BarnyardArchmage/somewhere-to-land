import { useState, useMemo, useEffect, useRef } from "react";
import * as Tone from "tone";

/* ============ INGREDIENTS ============ */
const ING = {
  moonbell:  { name:"Moonbell",   icon:"✽", color:"#d8cbf0", tier:1 , when:"night" },
  lavender:  { name:"Lavender",   icon:"❦", color:"#b49ad8", tier:1 , when:"day" },
  heartroot: { name:"Heartroot",  icon:"❧", color:"#c07a5a", tier:1 , when:"any" },
  inkcap:    { name:"Inkcap",     icon:"☁", color:"#8f8aa8", tier:1 , when:"night" },
  reedsilk:  { name:"Reed Silk",  icon:"⌇", color:"#a8c4a0", tier:1 , when:"day" },
  sunapple:  { name:"Sun Apple",  icon:"◍", color:"#e0a04a", tier:1 , when:"day" },
  nightcap:  { name:"Nightcap",   icon:"◐", color:"#7a6a9a", tier:2 , when:"night" },
  bitterthorn:{name:"Bitterthorn",icon:"✦", color:"#9a7a5a", tier:2, when:"any" },
  frostbell: { name:"Frostbell",  icon:"❄", color:"#cfe0f0", tier:1, when:"any",   seasons:[3] },
  rimeleaf:  { name:"Rimeleaf",   icon:"✥", color:"#b8ccc4", tier:1, when:"day",   seasons:[3] },
  lanternmoss:{name:"Lantern Moss",icon:"◉",color:"#e8dc9a", tier:1, when:"night", seasons:[3] },
  ghostcap:  { name:"Ghostcap",   icon:"◌", color:"#dcd8e8", tier:2 , when:"night" },
  wickroot:  { name:"Wickwater Root", icon:"≈", color:"#8aa87e", tier:2 , when:"day" },
  /* other professions — inert for a herbalist */
  agate:     { name:"River Agate", icon:"◇", color:"#b0c4d0", tier:1, prof:"stonecraft" , when:"any" },
  quartz:    { name:"Rough Quartz",icon:"◈", color:"#d8e4ec", tier:1, prof:"stonecraft" , when:"any" },
};

const TIER1 = ["moonbell","lavender","heartroot","inkcap","reedsilk","sunapple"];
const TIER2 = ["nightcap","bitterthorn","ghostcap","wickroot"];

/* ============ RECIPES (scraps) ============ */
const SCRAPS = {
  poultice: { id:"poultice", name:"Green Poultice", slots:3, pool:TIER1, value:18, tier:1,
    found:"Tucked behind a loose board in the shop — a water-stained page in someone else's hand." },
  fevertea: { id:"fevertea", name:"Fever Tea", slots:3, pool:TIER1, value:16, tier:1,
    found:"The peddler had it folded in a tin. He didn't seem to know what it was." },
  tincture: { id:"tincture", name:"Sleepwell Tincture", slots:4, pool:[...TIER1,...TIER2], value:44, tier:2, repeats:true,
    found:"The herb-woman copies it out for you, slowly, from memory. Most of it." },
  clearsight:{id:"clearsight",name:"Clearsight Brew", slots:4, pool:[...TIER1,...TIER2], value:52, tier:2, repeats:true,
    found:"Found in the watchtower, pinned under a stone. The ink has gone brown." },
};

function makeSolution(scrap) {
  const sol = [];
  if (scrap.repeats) {
    // components may be called for more than once
    for (let i=0;i<scrap.slots;i++) sol.push(scrap.pool[Math.floor(Math.random()*scrap.pool.length)]);
    // guarantee at least one genuine repeat so the rule has teeth
    if (new Set(sol).size === sol.length) {
      const a = Math.floor(Math.random()*scrap.slots);
      let b = Math.floor(Math.random()*scrap.slots);
      while (b===a) b = Math.floor(Math.random()*scrap.slots);
      sol[b] = sol[a];
    }
  } else {
    const pool = [...scrap.pool];
    for (let i=0;i<scrap.slots;i++) sol.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  }
  const knownSlot = Math.floor(Math.random()*scrap.slots);
  return { sol, knownSlot };
}
function score(guess, sol) {
  let exact=0, present=0;
  const solLeft=[], gLeft=[];
  guess.forEach((g,i)=>{ if(g===sol[i]) exact++; else { solLeft.push(sol[i]); gLeft.push(g); } });
  gLeft.forEach(g=>{ const i=solLeft.indexOf(g); if(i>=0){ present++; solLeft.splice(i,1); } });
  return { exact, present };
}
function countOf(arr,k){ return arr.filter(v=>v===k).length; }
function quantityHint(guess, sol){
  if (!guess || !sol) return null;
  const used = [...new Set(guess)];
  const wantMore = [], tooMuch = [];
  used.forEach(k=>{
    const g = countOf(guess,k), s = countOf(sol,k);
    if (s===0) return;
    const anyExact = guess.some((v,i)=>v===k && sol[i]===k);
    if (!anyExact) return;              // only hint about things you've placed rightly
    if (s>g) wantMore.push(k);
    else if (g>s) tooMuch.push(k);
  });
  if (wantMore.length){ const k=wantMore[Math.floor(Math.random()*wantMore.length)];
    return `You keep coming back to the ${ING[k]?ING[k].name.toLowerCase():k}. You feel you needed more of it than that.`; }
  if (tooMuch.length){ const k=tooMuch[Math.floor(Math.random()*tooMuch.length)];
    return `There is too much ${ING[k]?ING[k].name.toLowerCase():k} in it. It drowns the rest.`; }
  return null;
}
function feedbackText(exact, present, slots, guess, sol, repeats, priorAttempts) {
  if (exact === slots) return "It comes together clean. You have it.";
  if (exact===0 && present===0) return "Nothing here belongs. It sours in the bowl and you tip it out.";
  const bits = [];
  if (exact) bits.push(`${exact} ${exact===1?"thing sits":"things sit"} right`);
  if (present) bits.push(`${present} ${present===1?"belongs":"belong"} here but not in that order`);
  const first = !priorAttempts;
  const tail = exact && present
      ? (first ? "Close, then. Closer than you'd any right to be."
               : "Close, then. Closer than yesterday.")
    : exact ? "Something in it holds. The rest fights."
    : "The parts are right and the sense of it is wrong.";
  let out = bits.join(", ") + ". " + tail;
  if (repeats){ const h = quantityHint(guess, sol); if (h) out += " " + h; }
  return out;
}

/* ============ TERRAIN ============ */
const TERRAIN = {
  meadow:  { name:"Meadow",     fill:"#7d9a5c", edge:"#5f7a44", cost:1, blurb:"Tall grass and wildflowers." },
  forest:  { name:"Old Forest", fill:"#3f6b4a", edge:"#2c4d35", cost:2, blurb:"Dense canopy, slow going." },
  hills:   { name:"Hills",      fill:"#8a7a52", edge:"#6b5d3d", cost:2, blurb:"Windy uplands. You see far from here." },
  water:   { name:"Cold Water", fill:"#3d6580", edge:"#2b4a5f", cost:3, blurb:"Open water. Tiring to cross." },
  marsh:   { name:"Marsh",      fill:"#5c7a63", edge:"#445c4a", cost:2, blurb:"Reeds and standing water." },
  orchard: { name:"Orchard",    fill:"#96a04f", edge:"#75803a", cost:1, blurb:"Someone still tends these trees." },
};

const CUSTOMERS = [
  { name:"Bram the Baker", line:"Flour up to my elbows since four this morning." },
  { name:"Old Marta", line:"My knees know the weather before the sky does." },
  { name:"Sella Dock-hand", line:"Boat's in, back's out. You know how it goes." },
  { name:"Pim", line:"I'm nine. I have my own money. It's for my sister." },
  { name:"Hollis the Clerk", line:"I've made a list. I always make a list." },
  { name:"Nan Fairweather", line:"Don't tell my husband I came to see a witch." },
  { name:"Ceri the Weaver", line:"My eyes aren't what they were at the loom." },
  { name:"Tobin", line:"Just curious, mostly. And maybe a little worried." },
];

const PLACES = {
  home:{label:"Home",blurb:"Your parents' cottage. Warm bread, worried faces."},
  town:{label:"Wick Harbour",blurb:"A salt-stained town. Bakery smells, gulls, no witch of its own.",settle:true},
  village:{label:"Thornbury",blurb:"A small village around a stone chapel. Quiet, and slow to warm.",settle:true},
  ruin:{label:"Old Watchtower",blurb:"Empty for years. Something still hums in the stones."},
  shrine:{label:"Roadside Shrine",blurb:"Offerings of dried lavender, freshly left."},
  camp:{label:"Peddler's Camp",blurb:"A trader with a cart and too many opinions."},
};

/* ============ PROFESSIONS ============ */
const PROFS = {
  herbalism: { label:"Herbalism", blurb:"You know plants. Where they grow, when to cut them.",
    tiers:[null,{name:"Forager",need:0},{name:"Herbalist",need:40},{name:"Potioner",need:120}], available:true },
  stonecraft:{ label:"Stonecraft", blurb:"Stone, seams, and what sleeps inside a plain rock.", available:false },
  fortune:   { label:"Fortune Telling", blurb:"You read what the world lets slip.", available:false },
};
const TIER_NEED = [0, 0, 40, 120];

/* ============ OVERLAND ============ */
const G = {
  forest:(<g><path d="M0,5 L-5,-1 L-2.6,-1 L-6.4,-6.5 L6.4,-6.5 L2.6,-1 L5,-1 L0,5 Z" transform="translate(-4,1) scale(0.78)" fill="#25462f"/><path d="M0,6 L-6,-1.5 L-3,-1.5 L-7.5,-8 L7.5,-8 L3,-1.5 L6,-1.5 L0,6 Z" transform="translate(4,0)" fill="#2b5238"/><rect x="3.2" y="5" width="1.6" height="3" fill="#1f3527"/></g>),
  hills:(<g><path d="M-11,7 L-3,-5 L3,3 L6,-1 L12,7 Z" fill="#6d5f3f"/><path d="M-3,-5 L-0.6,-1.4 L-5.2,-1.4 Z" fill="#c4b791"/><path d="M6,-1 L7.6,1.2 L4.4,1.2 Z" fill="#c4b791"/></g>),
  water:(<g fill="none" stroke="#7fb4cf" strokeWidth="1.7" strokeLinecap="round"><path d="M-9,-3 q3,-2.6 6,0 t6,0"/><path d="M-9,2 q3,-2.6 6,0 t6,0"/><path d="M-5,7 q3,-2.6 6,0"/></g>),
  marsh:(<g stroke="#8fae90" strokeWidth="1.5" fill="none" strokeLinecap="round"><path d="M-6,8 L-6,-3"/><path d="M0,8 L0,-6"/><path d="M6,8 L6,-2"/><ellipse cx="-6" cy="-4.6" rx="1.5" ry="2.6" fill="#6d5a45" stroke="none"/><ellipse cx="0" cy="-7.6" rx="1.5" ry="2.6" fill="#6d5a45" stroke="none"/><ellipse cx="6" cy="-3.6" rx="1.5" ry="2.6" fill="#6d5a45" stroke="none"/></g>),
  orchard:(<g><rect x="-1" y="1" width="2" height="6" fill="#5a4526"/><circle cx="0" cy="-2.5" r="6.5" fill="#63873c"/><circle cx="-2.6" cy="-3.6" r="1.5" fill="#c9553f"/><circle cx="2.4" cy="-1.2" r="1.5" fill="#c9553f"/><circle cx="1" cy="-5" r="1.4" fill="#c9553f"/></g>),
  meadow:(<g opacity="0.55"><circle cx="-5" cy="2" r="1.5" fill="#dcd06a"/><circle cx="3" cy="-2" r="1.5" fill="#e0d8f0"/><circle cx="6" cy="4" r="1.3" fill="#dcd06a"/></g>),
};
const PLACE_GLYPH = {
  home:(<g><path d="M-9,2 L0,-7 L9,2 Z" fill="#b8543c"/><rect x="-6.5" y="2" width="13" height="8" fill="#e8d9b4"/><rect x="-2" y="4.6" width="4" height="5.4" fill="#7a5a3a"/><rect x="4" y="-6" width="2.4" height="4" fill="#8a6a4a"/></g>),
  town:(<g><rect x="-11" y="0" width="7" height="10" fill="#d9c9a4"/><path d="M-11.8,0 L-7.5,-5 L-3.2,0 Z" fill="#a8503c"/><rect x="-2.5" y="-3" width="7.5" height="13" fill="#e8d9b4"/><path d="M-3.3,-3 L1.2,-8.4 L5.8,-3 Z" fill="#b8543c"/><rect x="5.5" y="2" width="6" height="8" fill="#d0bf9a"/><path d="M4.7,2 L8.5,-2.4 L12.3,2 Z" fill="#a8503c"/><rect x="-0.4" y="4" width="3" height="6" fill="#6f5237"/></g>),
  village:(<g><rect x="-9" y="2" width="6" height="8" fill="#d9c9a4"/><path d="M-9.8,2 L-6,-2.4 L-2.2,2 Z" fill="#a8503c"/><rect x="-1" y="-2" width="8" height="12" fill="#dcd2c0"/><path d="M-1.8,-2 L3,-8 L7.8,-2 Z" fill="#8f6f5a"/><rect x="2.2" y="-13" width="1.6" height="5.6" fill="#c8b48a"/><rect x="0.6" y="-11.4" width="4.8" height="1.6" fill="#c8b48a"/><rect x="1.6" y="5" width="2.8" height="5" fill="#6f5237"/></g>),
  ruin:(<g><path d="M-5,10 L-5,-7 L-2,-9 L2,-9 L5,-7 L5,10 Z" fill="#9a92a8"/><path d="M-5,-7 L-5,-9.5 L-3,-9.5 L-3,-7.6 L-1,-7.6 L-1,-9.5 L1,-9.5 L1,-7.6 L3,-7.6 L3,-9.5 L5,-9.5 L5,-7 Z" fill="#b5adc4"/><rect x="-1.6" y="-3" width="3.2" height="5" fill="#3b3550"/><path d="M5,2 L9,4 L9,10 L5,10 Z" fill="#7d7590"/></g>),
  shrine:(<g><path d="M-8,-1 L0,-8 L8,-1 Z" fill="#8f7aa8"/><rect x="-6" y="-1" width="12" height="9" fill="#c4b8d4"/><rect x="-2.6" y="1.6" width="5.2" height="6.4" fill="#3b3550"/><circle cx="0" cy="3.4" r="2.2" fill="#f0d890"/><circle cx="0" cy="3.4" r="4.4" fill="#f0d890" opacity="0.22"/></g>),
  camp:(<g><path d="M0,-9 L9,8 L-9,8 Z" fill="#c9a06a"/><path d="M0,-9 L4,8 L-4,8 Z" fill="#8f6a44"/><path d="M0,-9 L0,8" stroke="#6f5237" strokeWidth="1.2"/><circle cx="-11" cy="6" r="2.4" fill="#e08a3c" opacity="0.85"/></g>),
};
const WITCH = (<g>
  <ellipse cx="0" cy="12" rx="9" ry="2.4" fill="#0d0a14" opacity="0.38"/>
  <path d="M-12,4 L11,-3" stroke="#6f5237" strokeWidth="2" strokeLinecap="round"/>
  <path d="M11,-3 q4.5,-1.8 6,1.2 q-3.6,1.6 -6,-1.2 Z" fill="#b0905e"/>
  <path d="M12,-3.4 L16.5,-4.6 M12,-2.2 L16.8,-2.2 M12,-1 L16.2,0.2" stroke="#8a6f44" strokeWidth="0.9"/>
  <path d="M-5.5,-3 q5,-2 11,0 L7.5,9 q-6,2.4 -12,0 Z" fill="#221c30"/>
  <path d="M-5.5,-3 q5,-2 11,0 L5,2 q-4,1.2 -8,0 Z" fill="#2c2540"/>
  <g transform="translate(-8.5,2.5)">
    <path d="M-3.6,-2.2 L3.6,-2.2 L3,4.4 L-3,4.4 Z" fill="#7a5836"/>
    <path d="M-3.6,-2.2 q3.6,-3 7.2,0 L3.6,0.4 q-3.6,-1.6 -7.2,0 Z" fill="#8f6a42"/>
    <path d="M-1.8,1 L-1.8,4.2 M1.8,1 L1.8,4.2" stroke="#5f4327" strokeWidth="0.7"/>
    <path d="M-4,-1.6 q4,-5 8,-0.6" stroke="#5f4327" strokeWidth="0.8" fill="none"/>
  </g>
  <circle cx="2.6" cy="-1.2" r="1.5" fill="#f0d8ba"/>
  <circle cx="-0.5" cy="-8.5" r="3.4" fill="#f4dcc0"/>
  <path d="M-4.2,-9.6 q0.6,-5.2 4.2,-5.2 q3.8,0 4,5.2 q-1.4,-2.6 -4.2,-2.6 q-2.6,0 -4,2.6 Z" fill="#6b4a8c"/>
  <path d="M-4.2,-9.4 q-1.4,3.2 -0.6,6.4 q-2.4,-2.6 -1.8,-6.6 Z" fill="#7a559e"/>
  <path d="M3.8,-9.4 q1.6,3.6 0.6,7 q2.6,-3 1.8,-7.2 Z" fill="#7a559e"/>
  <circle cx="-1.6" cy="-8.4" r="0.55" fill="#2b2338"/>
  <circle cx="0.7" cy="-8.4" r="0.55" fill="#2b2338"/>
</g>);

const RAW = ["mmfhhff","mfffhhf","ooffhww","oomfwww","mVofwwT","fmmmRmm","ffmmmmm","wfsmmmm","wwfmmmH"];
const LETTER = { m:"meadow", f:"forest", h:"hills", w:"water", s:"marsh", o:"orchard" };
const PLACE_LETTER = { H:["home","meadow"], T:["town","meadow"], V:["village","meadow"], R:["ruin","hills"] };
function buildGrid(){
  const g=[];
  RAW.forEach((row,r)=>row.split("").forEach((ch,c)=>{
    let terrain,place=null;
    if(PLACE_LETTER[ch]) [place,terrain]=PLACE_LETTER[ch]; else terrain=LETTER[ch];
    g.push({c,r,terrain,place,id:`${c},${r}`});
  }));
  const s=g.find(t=>t.id==="2,3"); if(s) s.place="shrine";
  const k=g.find(t=>t.id==="6,0"); if(k) k.place="camp";
  return g;
}
const SIZE=30, HW=Math.sqrt(3)*SIZE, VS=1.5*SIZE;
const center=(c,r)=>({x:HW*c+(r%2?HW/2:0)+HW/2+4, y:VS*r+SIZE+4});
const hexPath=(cx,cy)=>Array.from({length:6},(_,i)=>{const a=(Math.PI/180)*(60*i-30);return `${(cx+SIZE*Math.cos(a)).toFixed(1)},${(cy+SIZE*Math.sin(a)).toFixed(1)}`;}).join(" ");
const neighbors=(c,r)=>(r%2?[[c-1,r],[c+1,r],[c,r-1],[c+1,r-1],[c,r+1],[c+1,r+1]]:[[c-1,r],[c+1,r],[c-1,r-1],[c,r-1],[c-1,r+1],[c,r+1]]);
const START="6,8";
function findPath(from,to,byId,seen){
  const dist={[from]:0},prev={},visited=new Set(),q=[from];
  while(q.length){
    q.sort((a,b)=>dist[a]-dist[b]);
    const cur=q.shift();
    if(visited.has(cur))continue; visited.add(cur);
    if(cur===to)break;
    const [c,r]=cur.split(",").map(Number);
    for(const [nc,nr] of neighbors(c,r)){
      const nid=`${nc},${nr}`,tile=byId[nid];
      if(!tile||!seen.has(nid)||visited.has(nid))continue;
      const nd=dist[cur]+TERRAIN[tile.terrain].cost;
      if(dist[nid]===undefined||nd<dist[nid]){dist[nid]=nd;prev[nid]=cur;q.push(nid);}
    }
  }
  if(dist[to]===undefined)return null;
  const path=[];let cur=to;
  while(cur!==from){path.unshift(cur);cur=prev[cur];}
  return {path,cost:dist[to]};
}

/* ============ SITE ============ */
const SW=15, SH=11, T=40;
const SITEW=SW*T, SITEH=SH*T;

/* legend:  . ground   , ground-variant   # blocked terrain   ~ water   = crossing
            * scatter  1 tier-1 slot  2 tier-2 slot  x stone slot
            P permanent anchor  o open slot (curio / greed)  @ entry        */
const TEMPLATES = {
  forest:[
   ["###############",
    "##*..##..*..###",
    "#*..1...,..*.##",
    "#..P...#..1..##",
    "#.1...#....o.##",
    "#..*..2..#..*.#",
    "#*...#....x...#",
    "##..*...1..*.##",
    "#...#...o....##",
    "##*....@....*##",
    "###############"],
   ["####~##########",
    "#*..~..##..*.##",
    "#..1~....,...##",
    "##..=..P..1..##",
    "#.*.~..#....o.#",
    "#..1~.*...#*..#",
    "##..~....x....#",
    "#*..~.#..2..*.#",
    "#...~...o.....#",
    "##*.~..@...*.##",
    "#####~#########"],
   ["###############",
    "#..*...#..1..##",
    "#.1..,....*..##",
    "##....###...o##",
    "#.*..#P.#..1..#",
    "#...##..##..*.#",
    "#.2..#..#..x..#",
    "#*..,..*...*.##",
    "#..1...o......#",
    "##...*.@..*..##",
    "###############"]],
  meadow:[
   ["#####*#########",
    "*..1....,...*..",
    "..*....P...1...",
    ".1..#....*....o",
    "...*...1....#..",
    "#...,..*..x....",
    "..2...#....*..1",
    "*..1....o.....#",
    "...*..,....*...",
    "..#...@....1..*",
    "#####*#########"],
   ["###############",
    "..*..~~~..*..1.",
    "1...~~~~~~...*.",
    "..P.======.1...",
    "*..1~~~~~..o..#",
    "....*~~~..*....",
    ".1....,....x..*",
    "..*...2...1....",
    "#...o....*....1",
    "..*...@..,...*#",
    "###############"],
   ["###############",
    "..1..#...*..1..",
    "*...,...#....*.",
    "..#...1....o..1",
    ".*...P...*.....",
    "1...#...,...x..",
    "..*....1..#...*",
    "...2..*....1...",
    "*...o....*....#",
    "..1..*@....*..1",
    "####*#####*####"]],
  hills:[
   ["###############",
    "#*..#...##..*.#",
    "#..1..,...#..1#",
    "##..P..x....*.#",
    "#.*..#...##...#",
    "#1...,..*...o.#",
    "##..#...1..#..#",
    "#..*...2...*..#",
    "#.1..#..o.....#",
    "##..*.@...1..##",
    "###############"],
   ["###############",
    "#..##..*..##..#",
    "#*..1....,..1.#",
    "##...#P#...*..#",
    "#.1...x....o..#",
    "#..*...,..#..1#",
    "##..#..*...*..#",
    "#..1...2..#...#",
    "#*...o....1..*#",
    "##..*.@..,...##",
    "###############"],
   ["###############",
    "#..*..##..1..##",
    "#1...,....*..1#",
    "#..#...P....*.#",
    "#*...1..#..o..#",
    "##..,...x...1.#",
    "#..*...#..*..##",
    "#.2..1....,..*#",
    "#..o....*....1#",
    "##*..@...*...##",
    "###############"]],
  marsh:[
   ["#####~~~~######",
    "#*..~~~~~~..*.#",
    "#..1======1...#",
    "##.P~~~~~...*.#",
    "#.*..~~~..o..1#",
    "#1..,..*.....##",
    "##..#...2...*.#",
    "#..*...1...,..#",
    "#..o.....*...1#",
    "##*..@...1..*##",
    "###############"],
   ["###############",
    "#..~~..*..~~..#",
    "#*.~~1...~~~.1#",
    "##..~..P..~~..#",
    "#.1..=...,...*#",
    "#..*..~~~..2..#",
    "#1...~~~~~..o.#",
    "##..*~~~~...1.#",
    "#..1...,..*..*#",
    "##*..@...1...##",
    "###############"]],
  orchard:[
   ["###############",
    "#.1.#.1.#.1.#.#",
    "#*..*...*...*.#",
    "#.1.#.P.#.1.#1#",
    "#...*..,*...*.#",
    "#.1.#.1.#.x.#.#",
    "#*..*...*..o*.#",
    "#.2.#.1.#.1.#.#",
    "#..o*...*...*1#",
    "##..*.@....*.##",
    "###############"],
   ["###############",
    "#..1..*..1..,.#",
    "#*..#....#..*.#",
    "#.1...P....1..#",
    "#..*..,..*...o#",
    "#1...#...x...1#",
    "#..*....*..#..#",
    "#.2...1...,..*#",
    "#..o.*...1....#",
    "##..*.@...*..##",
    "###############"]],
};
TEMPLATES.marsh.push(TEMPLATES.marsh[0]);
TEMPLATES.orchard.push(TEMPLATES.orchard[1]);
TEMPLATES.water = TEMPLATES.marsh;

/* per-terrain art */
const TERRART = {
  forest: { g1:"#33583c", g2:"#2e5038", block:"tree", scatter:["fern","mushroomSmall","stone","fern"] },
  meadow: { g1:"#6f8a50", g2:"#77925a", block:"bush", scatter:["tuft","flower","stone","flower"] },
  hills:  { g1:"#7a6c48", g2:"#837555", block:"boulder", scatter:["tuft","stone","stone"] },
  marsh:  { g1:"#4e6a55", g2:"#54715c", block:"reedClump", scatter:["reed","ripple","fern"] },
  orchard:{ g1:"#79883c", g2:"#7f8f42", block:"tree", scatter:["tuft","flower","windfall"] },
  water:  { g1:"#35596f", g2:"#3b6076", block:"rockPool", scatter:["ripple","stone"] },
};

/* permanent landmarks — seeded by hex only, never by day */
const LANDMARKS = [
  { k:"fallenOak", name:"The fallen oak", note:"Down longer than the town has had a name.", ing:"heartroot", terr:["forest","marsh"] },
  { k:"standingStone", name:"The standing stone", note:"Nobody hereabouts will say who set it.", ing:"lavender", terr:["hills","meadow"] },
  { k:"oldWell", name:"The old well", note:"Dry these forty years. The rope is still on the hook.", ing:null, terr:null },
  { k:"cairn", name:"A cairn", note:"Stacked carefully, and added to. Someone still comes.", ing:null, terr:["hills","meadow","orchard"] },
  { k:"brokenWall", name:"A broken wall", note:"A field boundary from before anyone's memory.", ing:"moonbell", terr:["meadow","orchard","hills"] },
  { k:"lightningTree", name:"The lightning tree", note:"Split top to root and still, stubbornly, in leaf.", ing:"inkcap", terr:["forest","orchard"] },
  { k:"heronPool", name:"The heron pool", note:"Still water. Something is always just leaving it.", ing:"reedsilk", terr:["marsh","water"] },
];

function permanentFor(hexId, terrain){
  const rng = mulberry32(hashStr(`perm|${hexId}`));
  if (rng() > 0.4) return null;
  const pool = LANDMARKS.filter(l=>!l.terr||l.terr.includes(terrain));
  if (!pool.length) return null;
  const lm = pool[Math.floor(rng()*pool.length)];
  const withResource = !!lm.ing && rng() < 0.55;
  return { ...lm, withResource };
}

let HOUR_FOR_FOLK=12;
function genSite(hexId, day, terrain, place, wear, atHour) {
  HOUR_FOR_FOLK = atHour===undefined?12:atHour;
  const season = seasonOf(day);
  const def = SITE_DEF[terrain] || SITE_DEF.meadow;
  const baseArt = TERRART[terrain] || TERRART.meadow;
  const pal = (SEASON_GROUND[terrain]||SEASON_GROUND.meadow)[season];
  const art = { ...baseArt, g1:pal[0], g2:pal[1], season };
  const tmplSet = TEMPLATES[terrain] || TEMPLATES.meadow;
  const layoutRng = mulberry32(hashStr(`layout|${hexId}|${day}`));
  const tmpl = tmplSet[Math.floor(layoutRng()*tmplSet.length)];
  const rng = mulberry32(hashStr(`${hexId}|${day}|${terrain}`));
  const perm = permanentFor(hexId, terrain);
  const worn = Math.max(0, Math.min(8, wear||0));
  const yieldFactor = Math.max(0.3, 1 - worn*0.11) * (season===3?0.7:1);

  const cells = [];
  let entry = `${Math.floor(SW/2)},${SH-1}`;
  const slots = { t1:[], t2:[], stone:[], open:[], perm:null, scatter:[] };

  for (let y=0;y<SH;y++) for (let x=0;x<SW;x++) {
    const ch = tmpl[y] ? (tmpl[y][x] || ".") : ".";
    const c = { x, y, id:`${x},${y}`, blocked:false, deco:null, node:null, curio:null,
                greed:null, hidden:false, landmark:null, water:false, cross:false,
                tint: ((x*73856093)^(y*19349663))%3===0 };
    if (ch==="#") { c.blocked=true; c.deco=art.block; }
    else if (ch==="~") { c.blocked=true; c.water=true; }
    else if (ch==="=") { c.water=true; c.cross=true; c.deco="stepStone"; }
    else if (ch==="*") slots.scatter.push(c);
    else if (ch==="1") slots.t1.push(c);
    else if (ch==="2") slots.t2.push(c);
    else if (ch==="x") slots.stone.push(c);
    else if (ch==="o") slots.open.push(c);
    else if (ch==="P") slots.perm = c;
    else if (ch===",") c.deco = art.scatter[0];
    else if (ch==="@") entry = `${x},${y}`;
    cells.push(c);
  }
  const pick = arr => arr.length ? arr.splice(Math.floor(rng()*arr.length),1)[0] : null;

  /* permanent feature */
  if (perm && slots.perm) {
    const c = slots.perm;
    c.blocked = true; c.deco = null; c.landmark = "perm"; c.perm = perm;
    if (perm.withResource) {
      const near = cells.filter(o => o.id!==c.id && !o.blocked && !o.water &&
        Math.abs(o.x-c.x)<=1 && Math.abs(o.y-c.y)<=1);
      const spot = near[Math.floor(rng()*near.length)];
      if (spot) { spot.blocked=true;
        spot.node={ k:HERB_GLYPH[perm.ing]||"heartrootTangle", ing:perm.ing, picks:2, prof:"herbalism", tier:1, perm:true }; }
    }
  } else if (slots.perm) { slots.scatter.push(slots.perm); }

  /* tier-1 herbs: fill most slots */
  const WINTER_HERBS = {
    meadow:[{k:"frostbellPatch",ing:"frostbell",picks:2}],
    hills: [{k:"frostbellPatch",ing:"frostbell",picks:1}],
    forest:[{k:"rimeleafSprig",ing:"rimeleaf",picks:2},{k:"lanternMoss",ing:"lanternmoss",picks:1}],
    orchard:[{k:"rimeleafSprig",ing:"rimeleaf",picks:1}],
    marsh: [{k:"lanternMoss",ing:"lanternmoss",picks:2}],
    water: [],
  };
  let t1opts = (def.herbs1||[]).filter(nd=>ingInSeason(nd.ing,day));
  if(season===3) t1opts = t1opts.concat(WINTER_HERBS[terrain]||[]);
  if(!t1opts.length) t1opts = def.herbs1||[];
  const t1count = Math.max(1, Math.round(slots.t1.length * (0.55 + rng()*0.3) * yieldFactor));
  for (let i=0;i<t1count;i++){
    const c = pick(slots.t1); if(!c) break;
    const nd = t1opts[Math.floor(rng()*t1opts.length)]; if(!nd) break;
    c.blocked=true; c.node={k:nd.k,ing:nd.ing,picks:nd.picks,prof:"herbalism",tier:1};
    c.hidden = !!nd.hidden && rng()<0.7;
  }
  slots.t1.forEach(c=>slots.scatter.push(c));

  /* tier-2 herb: rare */
  if (rng()<0.28*yieldFactor){
    const opts = def.herbs2||[];
    const c = pick(slots.t2);
    if (c && opts.length){ const nd = opts[Math.floor(rng()*opts.length)];
      c.blocked=true; c.node={k:nd.k,ing:nd.ing,picks:nd.picks,prof:"herbalism",tier:2};
      c.hidden = !!nd.hidden && rng()<0.6; }
  }
  slots.t2.forEach(c=>slots.scatter.push(c));

  /* stone (inert for a herbalist) */
  (def.stone||[]).forEach(nd=>{ if(rng()<0.6){ const c=pick(slots.stone);
    if(c){ c.blocked=true; c.node={k:nd.k,ing:nd.ing,picks:1,prof:"stonecraft",tier:1}; } } });
  slots.stone.forEach(c=>slots.scatter.push(c));

  /* greed + curio into open slots */
  if (def.greed && rng()<0.26){ const c=pick(slots.open); if(c){ c.blocked=true; c.greed=def.greed; } }
  if (rng()<0.33){ const c=pick(slots.open); if(c){ c.blocked=true; c.curio=CURIOS[Math.floor(rng()*CURIOS.length)]; } }
  slots.open.forEach(c=>slots.scatter.push(c));

  /* scatter deco */
  slots.scatter.forEach(c=>{ if(!c.blocked&&!c.node&&!c.water&&rng()<0.75)
    c.deco = art.scatter[Math.floor(rng()*art.scatter.length)]; });

  /* signs of being worked over */
  if (worn>=3){
    const open = cells.filter(c=>!c.blocked&&!c.water&&!c.node);
    const n = Math.min(open.length, 2 + worn);
    for(let i=0;i<n;i++){ const c=open[Math.floor(rng()*open.length)];
      if(c && !c.trampled){ c.trampled=true; if(rng()<0.4) c.deco="trampled"; } }
  }

  /* the map's own landmark (town, camp, shrine…) overrides the permanent anchor spot */
  if (place) {
    const c = cells.find(o=>!o.blocked&&!o.node&&!o.curio&&!o.greed&&!o.water&&o.y>=2&&o.y<=4&&Math.abs(o.x-Math.floor(SW/2))<=2)
           || cells[3*SW+Math.floor(SW/2)];
    if (c) { c.blocked=true; c.node=null; c.curio=null; c.greed=null; c.deco=null; c.perm=null; c.landmark=place; }
  }
  /* someone may be working this ground */
  let worker=null;
  const w=wandererFor(hexId, day, HOUR_FOR_FOLK, terrain);
  if(w){
    const open=cells.filter(c=>!c.blocked&&!c.water&&!c.node&&!c.curio&&!c.greed
      && c.y>=1 && c.y<=SH-3);
    if(open.length){
      const spot=open[Math.floor(rng()*open.length)];
      worker={...w, at:spot.id};
    }
  }
  return { cells, def, art, entry, perm, worn, season, worker };
}

function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}

const SITE_DEF = {
  meadow:{ground:"#6f8a50",ground2:"#77925a",scatter:["tuft","flower","flower","stone"],blocks:[{k:"stone",n:2},{k:"bush",n:2}],
    herbs1:[{k:"moonbellPatch",ing:"moonbell",picks:2,n:2},{k:"lavenderSprig",ing:"lavender",picks:2,n:1}],
    herbs2:[{k:"bitterthornBush",ing:"bitterthorn",picks:1}], stone:[{k:"agateBed",ing:"agate"}], greed:"shrine"},
  forest:{ground:"#33583c",ground2:"#2e5038",scatter:["fern","fern","mushroomSmall","stone"],blocks:[{k:"tree",n:5},{k:"log",n:1}],
    herbs1:[{k:"inkcapRing",ing:"inkcap",picks:2,n:2,hidden:true},{k:"heartrootTangle",ing:"heartroot",picks:1,n:1}],
    herbs2:[{k:"nightcapCluster",ing:"nightcap",picks:1,hidden:true},{k:"ghostcapCluster",ing:"ghostcap",picks:1,hidden:true}],
    stone:[{k:"quartzSeam",ing:"quartz"}], greed:"nest"},
  hills:{ground:"#7a6c48",ground2:"#837555",scatter:["tuft","stone","stone"],blocks:[{k:"boulder",n:4}],
    herbs1:[{k:"lavenderSprig",ing:"lavender",picks:2,n:2}],
    herbs2:[{k:"bitterthornBush",ing:"bitterthorn",picks:1}],
    stone:[{k:"quartzSeam",ing:"quartz"},{k:"agateBed",ing:"agate"}], greed:"nest"},
  water:{ground:"#35596f",ground2:"#3b6076",scatter:["ripple","ripple","stone"],blocks:[{k:"rockPool",n:3}],
    herbs1:[{k:"reedBed",ing:"reedsilk",picks:2,n:2}], herbs2:[], stone:[{k:"agateBed",ing:"agate"}], greed:null},
  marsh:{ground:"#4e6a55",ground2:"#54715c",scatter:["reed","reed","ripple","fern"],blocks:[{k:"pool",n:3},{k:"log",n:1}],
    herbs1:[{k:"reedBed",ing:"reedsilk",picks:2,n:2},{k:"heartrootTangle",ing:"heartroot",picks:1,n:1,hidden:true},{k:"inkcapRing",ing:"inkcap",picks:1,n:1}],
    herbs2:[{k:"wickrootPool",ing:"wickroot",picks:1},{k:"bitterthornBush",ing:"bitterthorn",picks:1}],
    stone:[], greed:"nest"},
  orchard:{ground:"#79883c",ground2:"#7f8f42",scatter:["tuft","flower","windfall"],blocks:[{k:"stone",n:1}],
    herbs1:[{k:"fruitTree",ing:"sunapple",picks:2,n:3},{k:"moonbellPatch",ing:"moonbell",picks:1,n:1}],
    herbs2:[], stone:[{k:"agateBed",ing:"agate"}], greed:"shrine"},
};

const CURIOS = [
  { k:"bird", name:"A heron", text:"It watches you a long moment, then folds itself into the air and is gone.", gift:null },
  { k:"mitten", name:"A lost mitten", text:"Child-sized, one thumb worn through. Someone will be missing this.", gift:{coin:3} },
  { k:"stone", name:"A marked stone", text:"Letters worn almost flat. You can make out a name, and a year long past.", gift:null },
  { k:"cat", name:"A cat, not yours", text:"It considers Lazlo. Lazlo considers it. Neither commits.", gift:null },
  { k:"bottle", name:"A stoppered bottle", text:"Empty, but good glass. Worth keeping for the shop.", gift:{coin:5} },
  { k:"feather", name:"A long grey feather", text:"Bigger than any bird you've seen up close. You tuck it away.", gift:{ing:"reedsilk"} },
];

/* ============ ENCOUNTERS (one-time each) ============ */
const ENCOUNTERS = [
  { id:"heron", title:"The heron", terrain:["marsh","water"],
    text:"A heron stands dead still in the shallows, one foot up, directly over a knot of root you'd have liked. It has not decided whether you matter.",
    options:[
      { label:"Clap and scare it off", out:"It goes up in a great ugly panic and you take the root from the mud where it stood. You feel about as good as you expected to.", fx:{ing:{reedsilk:2},rep:-1} },
      { label:"Wait it out", out:"You sit on the bank until your legs go numb. Eventually it steps aside, unhurried, like it was always going to.", fx:{hours:2,ing:{reedsilk:1,wickroot:1}} },
      { label:"Leave it be", out:"You go the long way round. Behind you it hasn't moved at all.", fx:{} },
    ]},
  { id:"marta", title:"Old Marta on the path", terrain:null,
    text:"She's set her basket down in the middle of the track and is standing over it with her hands on her hips, breathing hard, furious at the basket.",
    options:[
      { label:"Carry it home for her", out:"She talks the whole way. By the gate she's told you which of her neighbours can be trusted and which cannot.", fx:{hours:3,bond:{"Old Marta":2},rep:1} },
      { label:"Offer her something for the knees", need:{good:"poultice"}, out:"She takes it, sniffs it, and puts it in her apron without a word. That's how you know she'll use it.", fx:{good:{poultice:-1},bond:{"Old Marta":3},rep:1} },
      { label:"Wish her well and go", out:"She waves you off cheerfully. She'd have said yes, if you'd offered.", fx:{bond:{"Old Marta":-1}} },
    ]},
  { id:"pim", title:"Pim's snare", terrain:["forest","meadow"],
    text:"The boy has caught a rabbit alive and has no idea what to do next. He's been standing there some while. He looks up at you with enormous relief.",
    options:[
      { label:"Show him how it's done", out:"You show him. He's steadier about it than you were at nine, and quieter afterwards.", fx:{bond:{"Pim":2},ing:{heartroot:1}} },
      { label:"Talk him into letting it go", out:"He argues, then doesn't. The rabbit is gone into the fern before either of you has finished the thought.", fx:{bond:{"Pim":1},rep:2} },
      { label:"Leave him to it", out:"You've enough to do. Behind you the snare cord creaks a while longer.", fx:{bond:{"Pim":-1}} },
    ]},
  { id:"shuttle", title:"A weaver's shuttle", terrain:["forest","meadow","orchard"],
    text:"Half-trodden into the path, polished dark by years of a hand. Ceri's, almost certainly — she came out this way in the spring and complained about it for a month.",
    options:[
      { label:"Take it back to her", out:"She goes very quiet, turns it over twice, and then puts the kettle on without asking whether you wanted tea.", fx:{bond:{"Ceri the Weaver":3},rep:1} },
      { label:"Keep it — good wood", out:"It'll do for grinding, or it'll sell. You don't examine the feeling that goes with that.", fx:{coin:9,bond:{"Ceri the Weaver":-2}} },
      { label:"Leave it where it lies", out:"Someone will find it. Someone always does.", fx:{} },
    ]},
  { id:"salvage", title:"What the tide left", terrain:["water","marsh"],
    text:"A wrecked creel and a coil of good line, tangled in the weed. The float is painted with Sella's mark, mostly worn off.",
    options:[
      { label:"Haul it back to her", out:"She swears at the sea for a solid minute and then at you, affectionately, for making her feel obliged.", fx:{hours:3,bond:{"Sella Dock-hand":3}} },
      { label:"Take the line and go", out:"Good line is good line. She'll assume the sea kept it, which the sea very nearly did.", fx:{coin:14,bond:{"Sella Dock-hand":-2}} },
      { label:"Leave it", out:"You leave it to the weed and the next tide.", fx:{} },
    ]},
  { id:"peddler", title:"The peddler's tin", terrain:null,
    text:"He's laid out his wares on a cloth and is watching you look at a folded scrap of paper he clearly can't read. He names a price with great confidence.",
    options:[
      { label:"Pay what he asks — 40 coin", need:{coin:40}, out:"He's delighted, which makes you suspect the price. The page, when you open it properly, is worth rather more.", fx:{coin:-40,scrap:"fevertea",bond:{"The peddler":2}} },
      { label:"Haggle him down", need:{coin:24}, out:"It takes the better part of an hour and he enjoys it more than you do. You get it for twenty-four and he'll remember.", fx:{coin:-24,hours:2,scrap:"fevertea",bond:{"The peddler":-1}} },
      { label:"Not today", out:"He shrugs and folds the cloth. He'll be somewhere else tomorrow.", fx:{} },
    ]},
  { id:"nan", title:"Nan at the shrine", terrain:null,
    text:"She's laying something at the little roadside shrine and she has not seen you. Her husband, everyone knows, has opinions about this sort of thing.",
    options:[
      { label:"Step back and let her finish", out:"You wait behind the hedge until she's gone. She never knows. That's the point.", fx:{bond:{"Nan Fairweather":2}} },
      { label:"Greet her openly", out:"She goes scarlet and bright and talks far too fast about the weather, and afterwards can't quite look at you.", fx:{bond:{"Nan Fairweather":-1},rep:1} },
      { label:"Go another way entirely", out:"None of your business. You take the long path.", fx:{} },
    ]},
  { id:"smoke", title:"Smoke on the hill", terrain:["hills","forest"],
    text:"A small fire, well made, and a woman sat beside it who saw you coming a long way off and has decided not to stand up about it.",
    options:[
      { label:"Sit and share what you have", out:"She's walked from somewhere with a different name for everything. Before she goes she presses a shard of something into your hand.", fx:{hours:2,ing:{quartz:1,ghostcap:1}} },
      { label:"Ask what she knows of the hills", out:"She tells you where the thorn grows thickest, and to stay off the east face after dark. You don't ask why.", fx:{ing:{bitterthorn:1}} },
      { label:"Keep your distance", out:"You skirt the fire wide. She watches you all the way past and lifts a hand as you go.", fx:{} },
    ]},
  { id:"dog", title:"A dog, limping", terrain:null,
    text:"It won't come closer and it won't leave. There's something in the pad of its front foot and it has clearly been there a while.",
    options:[
      { label:"Hold it still and get it out", out:"It bites you, then licks your wrist, then follows you half a mile before turning for home.", fx:{hours:1,rep:1,bond:{"Tobin":1}} },
      { label:"Leave food and move on", out:"It eats once you're far enough away. That will have to be enough.", fx:{ing:{sunapple:-1}},need:{ing:"sunapple"} },
      { label:"Walk on", out:"You walk on. It watches you the whole way down the path.", fx:{} },
    ]},
  { id:"field", title:"The burned strip", terrain:["meadow","orchard"],
    text:"Someone's field has gone up — a narrow black scar, still warm. At the edge, what survived is unattended and no one is anywhere in sight.",
    options:[
      { label:"Gather what's left", out:"You take it. It would only have rotted. You tell yourself that twice.", fx:{ing:{moonbell:2,sunapple:1},rep:-2} },
      { label:"Beat out the last of the smoulder", out:"It takes an hour and ruins your hem, and the strip beyond it is still standing when you're done. Word gets round.", fx:{hours:3,rep:3} },
      { label:"Go on your way", out:"Not your field and not your fire.", fx:{} },
    ]},
];

const S = {
  tuft:(<g stroke="#93ad6e" strokeWidth="1.6" fill="none" strokeLinecap="round"><path d="M-4,6 q1,-6 -1,-9"/><path d="M0,6 q0,-7 2,-10"/><path d="M4,6 q-1,-6 1,-9"/></g>),
  flower:(<g><circle cx="0" cy="-2" r="2.6" fill="#e6dc86"/><circle cx="0" cy="-2" r="1.1" fill="#b8a44a"/><path d="M0,0 L0,6" stroke="#6d8a4e" strokeWidth="1.4"/></g>),
  fern:(<g stroke="#4f7a55" strokeWidth="1.5" fill="none" strokeLinecap="round"><path d="M0,7 q-1,-7 -5,-10"/><path d="M0,7 q1,-8 5,-10"/><path d="M0,7 L0,-4"/></g>),
  reed:(<g stroke="#8aa87e" strokeWidth="1.5" fill="none" strokeLinecap="round"><path d="M-3,8 L-3,-4"/><path d="M2,8 L2,-6"/><ellipse cx="2" cy="-7.5" rx="1.3" ry="2.4" fill="#7a6448" stroke="none"/></g>),
  ripple:(<g fill="none" stroke="#7fb4cf" strokeWidth="1.3" opacity="0.6" strokeLinecap="round"><path d="M-6,0 q3,-2.4 6,0 t6,0"/><path d="M-4,5 q3,-2.4 6,0"/></g>),
  mushroomSmall:(<g><path d="M-3,2 q3,-4 6,0 Z" fill="#9a8aa8"/><rect x="-0.7" y="2" width="1.4" height="3" fill="#d8cfc0"/></g>),
  windfall:(<g><circle cx="-3" cy="5" r="2.3" fill="#c07a3a"/><circle cx="3" cy="6" r="2" fill="#b06a32"/></g>),
  stone:(<g><path d="M-6,6 q0,-6 6,-6 q6,0 6,6 Z" fill="#8d8779"/><path d="M-3,2 q2,-3 5,-2" stroke="#a9a396" strokeWidth="1.2" fill="none"/></g>),
  boulder:(<g><path d="M-13,13 q-2,-16 13,-16 q15,0 13,16 Z" fill="#7f7a6e"/><path d="M-6,4 q4,-6 11,-4" stroke="#9c978a" strokeWidth="1.8" fill="none"/></g>),
  bush:(<g><circle cx="-5" cy="2" r="6" fill="#4a7044"/><circle cx="5" cy="3" r="5.5" fill="#426439"/><circle cx="0" cy="-3" r="6.5" fill="#52794c"/></g>),
  tree:(<g><rect x="-2.2" y="4" width="4.4" height="10" fill="#463122"/><circle cx="0" cy="-3" r="11" fill="#2d5136"/><circle cx="-6" cy="1" r="7" fill="#27472f"/><circle cx="6" cy="0" r="7.5" fill="#33593c"/></g>),
  log:(<g><rect x="-13" y="-3" width="26" height="9" rx="4.5" fill="#5a4430"/><ellipse cx="-13" cy="1.5" rx="3" ry="4.5" fill="#7a5e42"/><path d="M6,-1 L11,-1" stroke="#48351f" strokeWidth="1.4"/></g>),
  pool:(<g><ellipse cx="0" cy="2" rx="14" ry="10" fill="#31505c"/><ellipse cx="0" cy="1" rx="10" ry="6.5" fill="#3d6172"/><path d="M-5,0 q3,-2 6,0" stroke="#7fb4cf" strokeWidth="1.3" fill="none" opacity="0.7"/></g>),
  rockPool:(<g><ellipse cx="0" cy="2" rx="13" ry="9" fill="#2b4553"/><path d="M-13,4 q3,-9 13,-9 q10,0 13,9" fill="none" stroke="#6b7c84" strokeWidth="2.6"/></g>),
  /* tier 1 herbs */
  moonbellPatch:(<g><g transform="translate(-5,1)"><path d="M0,6 L0,-2" stroke="#6d8a4e" strokeWidth="1.4"/><path d="M-3,-2 q3,-5 6,0 Z" fill="#e2d8f4"/></g><g transform="translate(4,-2)"><path d="M0,7 L0,-1" stroke="#6d8a4e" strokeWidth="1.4"/><path d="M-3.4,-1 q3.4,-5.6 6.8,0 Z" fill="#efe8ff"/></g><g transform="translate(0,5)"><path d="M0,4 L0,-1" stroke="#6d8a4e" strokeWidth="1.3"/><path d="M-2.6,-1 q2.6,-4.4 5.2,0 Z" fill="#ded2f0"/></g></g>),
  lavenderSprig:(<g stroke="#6d8a4e" strokeWidth="1.4" fill="none"><path d="M-4,8 L-4,-2"/><path d="M0,8 L0,-5"/><path d="M4,8 L4,-1"/><g stroke="none" fill="#a487cf"><ellipse cx="-4" cy="-4" rx="2" ry="3.4"/><ellipse cx="0" cy="-7" rx="2.1" ry="3.6"/><ellipse cx="4" cy="-3" rx="1.9" ry="3.2"/></g></g>),
  heartrootTangle:(<g><path d="M-9,7 q4,-8 9,-3 q5,5 9,-3" stroke="#8a5a3a" strokeWidth="2.4" fill="none" strokeLinecap="round"/><ellipse cx="-3" cy="2" rx="3.4" ry="4.4" fill="#c07a5a"/><ellipse cx="5" cy="4" rx="2.8" ry="3.6" fill="#a8663f"/><path d="M-3,-2 q0,-5 3,-7" stroke="#5f8046" strokeWidth="1.6" fill="none"/></g>),
  inkcapRing:(<g>{[[-7,3],[0,-1],[7,3],[-3,7],[4,8]].map(([x,y],i)=>(<g key={i} transform={`translate(${x},${y}) scale(${0.85+i*0.05})`}><path d="M-3.4,0 q3.4,-6 6.8,0 Z" fill="#a49ec0"/><rect x="-0.8" y="0" width="1.6" height="4" fill="#ddd6e6"/></g>))}</g>),
  reedBed:(<g stroke="#9fc08c" strokeWidth="1.6" fill="none" strokeLinecap="round"><path d="M-8,9 L-8,-4"/><path d="M-3,9 L-3,-7"/><path d="M3,9 L3,-3"/><path d="M8,9 L8,-6"/><g stroke="none" fill="#8a6f4a"><ellipse cx="-8" cy="-5.6" rx="1.5" ry="2.6"/><ellipse cx="-3" cy="-8.6" rx="1.5" ry="2.6"/><ellipse cx="3" cy="-4.6" rx="1.5" ry="2.6"/><ellipse cx="8" cy="-7.6" rx="1.5" ry="2.6"/></g></g>),
  fruitTree:(<g><rect x="-2.4" y="4" width="4.8" height="10" fill="#523c26"/><circle cx="0" cy="-3" r="11" fill="#5c7f38"/><circle cx="-6" cy="1" r="6.5" fill="#547635"/><circle cx="-4" cy="-4" r="2.4" fill="#d4863a"/><circle cx="4" cy="-1" r="2.4" fill="#c9773a"/><circle cx="1" cy="-8" r="2.2" fill="#dd9440"/></g>),
  /* tier 2 herbs */
  nightcapCluster:(<g><g transform="translate(-5,2)"><path d="M-4,0 q4,-7 8,0 Z" fill="#4a3f66"/><rect x="-1" y="0" width="2" height="5" fill="#9a8fb8"/></g><g transform="translate(4,-1)"><path d="M-4.6,0 q4.6,-8 9.2,0 Z" fill="#564a75"/><rect x="-1.1" y="0" width="2.2" height="6" fill="#a89dc4"/></g><circle cx="-5" cy="-2" r="1" fill="#c8b8e8"/><circle cx="5" cy="-6" r="1.1" fill="#c8b8e8"/></g>),
  ghostcapCluster:(<g><g transform="translate(0,1)"><path d="M-6,0 q6,-10 12,0 Z" fill="#e4e0ee" opacity="0.95"/><rect x="-1.3" y="0" width="2.6" height="8" fill="#cfc9dd"/></g><g transform="translate(-7,5) scale(0.7)"><path d="M-5,0 q5,-8 10,0 Z" fill="#d8d4e4"/><rect x="-1.2" y="0" width="2.4" height="6" fill="#c4becf"/></g><circle cx="0" cy="-6" r="9" fill="#e4e0ee" opacity="0.12"/></g>),
  bitterthornBush:(<g><circle cx="0" cy="0" r="9" fill="#4d4130"/><circle cx="-5" cy="3" r="6" fill="#453a2b"/><g stroke="#b09a70" strokeWidth="1.4" strokeLinecap="round"><path d="M-8,-4 L-11,-7"/><path d="M6,-6 L9,-9"/><path d="M8,3 L12,4"/><path d="M-2,-9 L-3,-13"/></g><circle cx="2" cy="-2" r="2" fill="#8a5a4a"/><circle cx="-4" cy="2" r="1.7" fill="#7a4e42"/></g>),
  wickrootPool:(<g><ellipse cx="0" cy="3" rx="13" ry="9" fill="#2f4a3e"/><ellipse cx="0" cy="2" rx="9" ry="5.6" fill="#3b5c4a"/><path d="M-5,2 q3,-6 5,-1 q2,5 5,-2" stroke="#9ec48a" strokeWidth="2" fill="none" strokeLinecap="round"/><ellipse cx="0" cy="1" rx="2.4" ry="3.2" fill="#c8dcaa"/></g>),
  /* stonecraft (inert for herbalist) */
  quartzSeam:(<g><path d="M-11,9 q-1,-13 11,-13 q12,0 11,13 Z" fill="#7a7468"/><path d="M-5,3 L-2,-5 L1,-1 L4,-7 L6,3 Z" fill="#d0dce4" opacity="0.9"/></g>),
  agateBed:(<g><ellipse cx="-4" cy="4" rx="5.5" ry="4.5" fill="#8d8779"/><ellipse cx="4" cy="2" rx="6" ry="5" fill="#7f7a6e"/><ellipse cx="4" cy="2" rx="2.6" ry="2.2" fill="#b8cfdc"/></g>),
  nest:(<g><path d="M-11,6 q2,-9 11,-9 q9,0 11,9 Z" fill="#7a6040"/><path d="M-9,4 q4,-5 9,-5 q5,0 9,5" fill="#8f7550"/><ellipse cx="-3" cy="2" rx="3" ry="3.6" fill="#cfe0d4"/><ellipse cx="3.5" cy="3" rx="2.8" ry="3.4" fill="#c4d8ca"/></g>),
  shrine:(<g><rect x="-8" y="0" width="16" height="10" fill="#a89cc0"/><path d="M-10,0 L0,-9 L10,0 Z" fill="#8a7aa8"/><rect x="-3" y="3" width="6" height="7" fill="#33294a"/><circle cx="0" cy="5" r="2.2" fill="#f0d890"/><circle cx="0" cy="5" r="5" fill="#f0d890" opacity="0.2"/><ellipse cx="-10" cy="9" rx="3" ry="1.6" fill="#a487cf" opacity="0.8"/></g>),
  bird:(<g><ellipse cx="0" cy="1" rx="4.5" ry="6.5" fill="#8f9aa8"/><circle cx="0" cy="-7" r="3" fill="#9aa6b4"/><path d="M2.6,-7 L8,-6 L2.6,-5 Z" fill="#d8a850"/><path d="M0,7 L-2,13 M0,7 L2,13" stroke="#c8a850" strokeWidth="1.3"/></g>),
  mitten:(<g><path d="M-4,8 L-4,-4 q0,-4 4,-4 q4,0 4,4 L4,8 Z" fill="#b05a5a"/><path d="M4,-1 q4,0 4,3 q0,3 -4,2 Z" fill="#b05a5a"/><rect x="-4.6" y="5" width="9.2" height="2.6" fill="#d8cfc0"/></g>),
  stoneMark:(<g><path d="M-7,9 L-6,-6 q6,-3 12,0 L7,9 Z" fill="#9a958a"/><path d="M-3,-1 L3,-1 M-3,2 L2,2 M-3,5 L3,5" stroke="#6d6960" strokeWidth="1.2"/></g>),
  cat:(<g><ellipse cx="0" cy="4" rx="7" ry="5" fill="#5a5060"/><circle cx="-4" cy="-3" r="4.4" fill="#645a6c"/><path d="M-7.4,-5.6 L-6.6,-9.6 L-3.8,-7 Z" fill="#645a6c"/><path d="M-0.6,-6.6 L-0.2,-9.8 L-2.6,-7.6 Z" fill="#645a6c"/><circle cx="-5.4" cy="-3" r="0.9" fill="#e0c860"/><circle cx="-2.4" cy="-3" r="0.9" fill="#e0c860"/><path d="M6,3 q5,-2 3,-7" stroke="#5a5060" strokeWidth="2.2" fill="none" strokeLinecap="round"/></g>),
  bottle:(<g><path d="M-3,8 L-3,-2 L-1.4,-4 L-1.4,-8 L1.4,-8 L1.4,-4 L3,-2 L3,8 Z" fill="#7ba890" opacity="0.85"/><rect x="-1.8" y="-9.6" width="3.6" height="2" fill="#8a6a44"/></g>),
  trampled:(<g opacity="0.55"><ellipse cx="0" cy="3" rx="13" ry="7" fill="#6a5a42"/>
    <ellipse cx="-3" cy="1" rx="6" ry="3.4" fill="#7a6a4e"/>
    <path d="M-8,7 q5,-2 9,0" stroke="#5a4c38" strokeWidth="1.4" fill="none"/></g>),
  frostbellPatch:(<g>
    <g transform="translate(-5,1)"><path d="M0,6 L0,-2" stroke="#7d8a86" strokeWidth="1.3"/><path d="M-3,-2 q3,-5 6,0 Z" fill="#dceaf6"/></g>
    <g transform="translate(4,-2)"><path d="M0,7 L0,-1" stroke="#7d8a86" strokeWidth="1.3"/><path d="M-3.4,-1 q3.4,-5.6 6.8,0 Z" fill="#eaf3fc"/></g>
    <g transform="translate(0,5)"><path d="M0,4 L0,-1" stroke="#7d8a86" strokeWidth="1.2"/><path d="M-2.6,-1 q2.6,-4.4 5.2,0 Z" fill="#cfe0f0"/></g>
    <circle cx="-5" cy="-4" r="0.9" fill="#ffffff" opacity="0.8"/></g>),
  rimeleafSprig:(<g>
    <g stroke="#8fa89e" strokeWidth="1.5" fill="none" strokeLinecap="round">
      <path d="M0,8 L0,-6"/><path d="M0,0 q-5,-3 -7,-7"/><path d="M0,-3 q5,-3 7,-7"/></g>
    <g fill="#c8dcd4"><ellipse cx="-7" cy="-7.6" rx="2.6" ry="1.6"/><ellipse cx="7" cy="-10" rx="2.6" ry="1.6"/></g>
    <circle cx="0" cy="-6" r="1.4" fill="#eaf6f2"/></g>),
  lanternMoss:(<g>
    <ellipse cx="0" cy="5" rx="12" ry="5" fill="#4a5a4e"/>
    <ellipse cx="-3" cy="3" rx="7" ry="4" fill="#566a58"/>
    <circle cx="-4" cy="2" r="2.2" fill="#e8dc9a"/><circle cx="3" cy="4" r="1.8" fill="#dcd08a"/>
    <circle cx="1" cy="0" r="1.5" fill="#f0e6aa"/></g>),
  stepStone:(<g><ellipse cx="0" cy="2" rx="12" ry="7.5" fill="#7f7a6e"/><ellipse cx="0" cy="0" rx="11" ry="6.5" fill="#96917f"/></g>),
  reedClump:(<g><ellipse cx="0" cy="8" rx="12" ry="4" fill="#3f5a48"/>
    <g stroke="#7f9c7e" strokeWidth="1.8" fill="none" strokeLinecap="round"><path d="M-7,9 L-8,-6"/><path d="M-2,9 L-2,-10"/><path d="M3,9 L4,-7"/><path d="M8,9 L9,-4"/></g>
    <g fill="#7a6448"><ellipse cx="-8" cy="-8" rx="1.7" ry="3"/><ellipse cx="-2" cy="-12" rx="1.7" ry="3"/><ellipse cx="4" cy="-9" rx="1.7" ry="3"/></g></g>),
  fallenOak:(<g><rect x="-24" y="-4" width="48" height="13" rx="6.5" fill="#54402c"/>
    <ellipse cx="-24" cy="2.5" rx="4.2" ry="6.5" fill="#7d6244"/><ellipse cx="-24" cy="2.5" rx="1.8" ry="3" fill="#5e4830"/>
    <path d="M6,-4 q6,-9 13,-8" stroke="#4a3826" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M-8,-4 q-2,-7 4,-10" stroke="#4a3826" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
    <circle cx="13" cy="7" r="3" fill="#3f6b4a"/><circle cx="-15" cy="8" r="3.2" fill="#3f6b4a"/></g>),
  standingStone:(<g><path d="M-7,14 L-9,-14 q9,-5 18,0 L7,14 Z" fill="#8d8779"/>
    <path d="M-3,-10 L-3,8 M2,-8 L2,6" stroke="#6f6a60" strokeWidth="1.4"/>
    <ellipse cx="0" cy="14" rx="12" ry="3.5" fill="#4a5540" opacity="0.7"/></g>),
  oldWell:(<g><ellipse cx="0" cy="6" rx="13" ry="7" fill="#7a7468"/><ellipse cx="0" cy="4" rx="11" ry="5.6" fill="#5a554c"/>
    <ellipse cx="0" cy="4" rx="7" ry="3.4" fill="#20242a"/>
    <path d="M-10,4 L-10,-12 M10,4 L10,-12" stroke="#5a4430" strokeWidth="2.6"/>
    <path d="M-13,-12 L13,-12 L0,-19 Z" fill="#6a5238"/><path d="M0,-11 L0,-3" stroke="#8a7a5a" strokeWidth="1.2"/></g>),
  cairn:(<g><ellipse cx="0" cy="12" rx="13" ry="4" fill="#4a5540" opacity="0.6"/>
    <ellipse cx="0" cy="9" rx="11" ry="4.5" fill="#7f7a6e"/><ellipse cx="0" cy="3" rx="8.5" ry="4" fill="#8d8779"/>
    <ellipse cx="1" cy="-2.5" rx="6.5" ry="3.4" fill="#7f7a6e"/><ellipse cx="0" cy="-7.5" rx="4.5" ry="3" fill="#96917f"/>
    <ellipse cx="0" cy="-11.5" rx="2.8" ry="2.2" fill="#8d8779"/></g>),
  brokenWall:(<g><rect x="-19" y="0" width="14" height="9" fill="#8d8779"/><rect x="-19" y="-6" width="9" height="6" fill="#7f7a6e"/>
    <rect x="-3" y="2" width="10" height="7" fill="#96917f"/><rect x="9" y="0" width="10" height="9" fill="#8d8779"/>
    <rect x="11" y="-6" width="8" height="6" fill="#7f7a6e"/><circle cx="4" cy="-2" r="2.4" fill="#4a7044"/></g>),
  lightningTree:(<g><path d="M-3,14 L-5,-2 L-9,-10 L-4,-6 L-2,-16 L1,-5 L7,-12 L3,-1 L4,14 Z" fill="#4e4034"/>
    <circle cx="-8" cy="-12" r="4.5" fill="#2d5136"/><circle cx="7" cy="-14" r="4" fill="#33593c"/>
    <path d="M-2,-16 L2,-24" stroke="#6a5a48" strokeWidth="2" strokeLinecap="round"/></g>),
  heronPool:(<g><ellipse cx="0" cy="4" rx="16" ry="10" fill="#2b4553"/><ellipse cx="0" cy="3" rx="12" ry="7" fill="#3d6172"/>
    <path d="M-7,2 q4,-2.6 8,0" stroke="#7fb4cf" strokeWidth="1.4" fill="none" opacity="0.7"/>
    <g transform="translate(7,-6) scale(0.75)"><ellipse cx="0" cy="1" rx="4" ry="6" fill="#8f9aa8"/><circle cx="0" cy="-7" r="2.8" fill="#9aa6b4"/>
    <path d="M2.4,-7 L7.5,-6 L2.4,-5 Z" fill="#d8a850"/><path d="M0,7 L-1.6,12 M0,7 L1.6,12" stroke="#c8a850" strokeWidth="1.2"/></g></g>),
  feather:(<g><path d="M-5,9 q-2,-11 5,-16 q7,5 5,16 q-5,3 -10,0 Z" fill="#a8a4b0"/><path d="M0,-7 L0,9" stroke="#6f6a78" strokeWidth="1.3"/></g>),
};
const SEASONAL = {
  tree: sn => sn===3
    ? (<g><rect x="-2.2" y="4" width="4.4" height="10" fill="#3f2e20"/>
        <g stroke="#4a3728" strokeWidth="2.2" fill="none" strokeLinecap="round">
          <path d="M0,4 L-7,-6"/><path d="M0,2 L7,-7"/><path d="M0,-1 L-4,-11"/><path d="M0,-2 L3,-12"/></g>
        <g stroke="#3f2e20" strokeWidth="1.3" fill="none" strokeLinecap="round">
          <path d="M-7,-6 L-10,-10"/><path d="M7,-7 L10,-10"/><path d="M-4,-11 L-6,-15"/><path d="M3,-12 L5,-16"/></g>
        <ellipse cx="0" cy="13" rx="12" ry="3.4" fill="#dce6ee" opacity="0.55"/></g>)
    : (<g><rect x="-2.2" y="4" width="4.4" height="10" fill="#463122"/>
        <circle cx="0" cy="-3" r="11" fill={sn===2?"#a5682e":sn===1?"#2a4e33":"#2d5136"}/>
        <circle cx="-6" cy="1" r="7" fill={sn===2?"#8e5526":sn===1?"#24452c":"#27472f"}/>
        <circle cx="6" cy="0" r="7.5" fill={sn===2?"#b8813a":sn===1?"#2f5539":"#33593c"}/>
        {sn===0&&<><circle cx="-4" cy="-7" r="1.5" fill="#e8c4d8"/><circle cx="5" cy="-5" r="1.4" fill="#e8c4d8"/><circle cx="0" cy="-10" r="1.3" fill="#f0d4e4"/></>}
        {sn===2&&<><circle cx="-9" cy="8" r="1.6" fill="#b8813a"/><circle cx="7" cy="10" r="1.5" fill="#a5682e"/></>}</g>),
  bush: sn => sn===3
    ? (<g><circle cx="-5" cy="2" r="6" fill="#5e6a62"/><circle cx="5" cy="3" r="5.5" fill="#566259"/>
        <circle cx="0" cy="-3" r="6.5" fill="#657069"/>
        <circle cx="-4" cy="-3" r="4.5" fill="#e2ecf4" opacity="0.8"/><circle cx="4" cy="0" r="4" fill="#dae6f0" opacity="0.7"/></g>)
    : (<g><circle cx="-5" cy="2" r="6" fill={sn===2?"#7a6a32":"#4a7044"}/>
        <circle cx="5" cy="3" r="5.5" fill={sn===2?"#6d5e2c":"#426439"}/>
        <circle cx="0" cy="-3" r="6.5" fill={sn===2?"#8a7638":"#52794c"}/>
        {sn===0&&<circle cx="2" cy="-5" r="1.6" fill="#e8d4e8"/>}</g>),
  fern: sn => sn===3
    ? (<g stroke="#7d8a86" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8">
        <path d="M0,7 q-1,-5 -4,-7"/><path d="M0,7 q1,-6 4,-7"/><path d="M0,7 L0,-2"/></g>)
    : (<g stroke={sn===2?"#7d7034":"#4f7a55"} strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d="M0,7 q-1,-7 -5,-10"/><path d="M0,7 q1,-8 5,-10"/><path d="M0,7 L0,-4"/></g>),
  tuft: sn => (<g stroke={sn===3?"#8e9aa0":sn===2?"#9a8c52":"#93ad6e"} strokeWidth="1.6" fill="none" strokeLinecap="round">
      <path d="M-4,6 q1,-6 -1,-9"/><path d="M0,6 q0,-7 2,-10"/><path d="M4,6 q-1,-6 1,-9"/></g>),
  flower: sn => sn===3
    ? (<g><circle cx="0" cy="1" r="2.2" fill="#dce8f2"/><path d="M0,2 L0,6" stroke="#7d8a86" strokeWidth="1.2"/></g>)
    : (<g><circle cx="0" cy="-2" r="2.6" fill={sn===2?"#c9893a":sn===1?"#e6dc86":"#e8c4d8"}/>
        <circle cx="0" cy="-2" r="1.1" fill="#b8a44a"/>
        <path d="M0,0 L0,6" stroke={sn===2?"#7d7034":"#6d8a4e"} strokeWidth="1.4"/></g>),
  fruitTree: sn => sn===3
    ? (<g><rect x="-2.4" y="4" width="4.8" height="10" fill="#3f2e20"/>
        <g stroke="#4a3728" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M0,4 L-7,-5"/><path d="M0,2 L7,-6"/><path d="M0,-1 L0,-11"/></g>
        <ellipse cx="0" cy="13" rx="11" ry="3" fill="#dce6ee" opacity="0.5"/></g>)
    : (<g><rect x="-2.4" y="4" width="4.8" height="10" fill="#523c26"/>
        <circle cx="0" cy="-3" r="11" fill={sn===2?"#9c7a30":"#5c7f38"}/>
        <circle cx="-6" cy="1" r="6.5" fill={sn===2?"#8a6c2c":"#547635"}/>
        {sn===0
          ? <><circle cx="-4" cy="-4" r="1.8" fill="#f0dce8"/><circle cx="4" cy="-1" r="1.8" fill="#f0dce8"/><circle cx="1" cy="-8" r="1.6" fill="#f8e8f0"/></>
          : <><circle cx="-4" cy="-4" r="2.4" fill="#d4863a"/><circle cx="4" cy="-1" r="2.4" fill="#c9773a"/><circle cx="1" cy="-8" r="2.2" fill="#dd9440"/></>}</g>),
};
const HERB_GLYPH = { moonbell:"moonbellPatch", lavender:"lavenderSprig", heartroot:"heartrootTangle",
  inkcap:"inkcapRing", reedsilk:"reedBed", sunapple:"fruitTree", nightcap:"nightcapCluster",
  bitterthorn:"bitterthornBush", ghostcap:"ghostcapCluster", wickroot:"wickrootPool",
  frostbell:"frostbellPatch", rimeleaf:"rimeleafSprig", lanternmoss:"lanternMoss" };
const CURIO_GLYPH = { bird:S.bird, mitten:S.mitten, stone:S.stoneMark, cat:S.cat, bottle:S.bottle, feather:S.feather };
const FAMILIAR = (<g>
  <ellipse cx="0" cy="9" rx="6" ry="2" fill="#0d0a14" opacity="0.33"/>
  <ellipse cx="0.5" cy="3" rx="6" ry="4.4" fill="#332c3e"/>
  <circle cx="-3.6" cy="-2.6" r="4" fill="#3c3448"/>
  <path d="M-6.8,-4.8 L-6.2,-8.8 L-3.5,-6.2 Z" fill="#3c3448"/>
  <path d="M-0.9,-5.8 L-0.4,-9 L-2.7,-6.8 Z" fill="#3c3448"/>
  <path d="M-6.2,-5 L-5.9,-7.4 L-4.4,-5.8 Z" fill="#6a4f5e"/>
  <circle cx="-4.9" cy="-2.6" r="0.95" fill="#e8c87a"/>
  <circle cx="-2.1" cy="-2.6" r="0.95" fill="#e8c87a"/>
  <circle cx="-4.9" cy="-2.6" r="0.35" fill="#241d33"/>
  <circle cx="-2.1" cy="-2.6" r="0.35" fill="#241d33"/>
  <path d="M5.8,2 q5,-2 3,-6.8" stroke="#332c3e" strokeWidth="2.1" fill="none" strokeLinecap="round"/>
  <ellipse cx="-1" cy="6.6" rx="1.5" ry="1" fill="#4a4152"/>
  <ellipse cx="2.6" cy="6.8" rx="1.5" ry="1" fill="#4a4152"/>
</g>);

function sitePath(from,to,cells){
  const at=id=>cells[Number(id.split(",")[1])*SW+Number(id.split(",")[0])];
  const prev={},seen=new Set([from]),q=[from];
  while(q.length){
    const cur=q.shift(); if(cur===to)break;
    const [x,y]=cur.split(",").map(Number);
    for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
      if(nx<0||ny<0||nx>=SW||ny>=SH)continue;
      const nid=`${nx},${ny}`; if(seen.has(nid))continue;
      if(at(nid).blocked&&nid!==to)continue;
      seen.add(nid);prev[nid]=cur;q.push(nid);
    }
  }
  if(!seen.has(to))return null;
  const path=[];let cur=to;
  while(cur!==from){path.unshift(cur);cur=prev[cur];}
  return path;
}

/* ============ UI ============ */
const C={bg:"#171320",panel:"#211a2e",panel2:"#1b1626",line:"#3a2f4d",text:"#e6dcc6",dim:"#a596bd",faint:"#7d6d94",gold:"#f0d890",violet:"#9d86c4"};
const Btn=({children,onClick,disabled,tone="violet",style})=>(
  <button onClick={e=>{Sound.play("tap");onClick&&onClick(e);}} disabled={disabled} style={{width:"100%",padding:"12px",borderRadius:8,fontSize:14,letterSpacing:0.5,fontFamily:"inherit",cursor:disabled?"default":"pointer",
    background:disabled?"#2a2340":tone==="gold"?"#5a4726":"#4a3a6b",color:disabled?"#6b5d80":tone==="gold"?C.gold:"#f0e6ff",
    border:`1px solid ${disabled?"#3a2f4d":tone==="gold"?"#8a6f3a":"#6b559b"}`,...style}}>{children}</button>);
function SkyStrip({h,day,weather}){
  const night=isNight(h), dusk=h>=18.5&&h<20;
  const lit=moonLit(day), waxing=moonAge(day)>0.5;
  const w=WEATHER[weather]||{};
  const grey=(w.extra||0)>0.12;
  const dayFrac=Math.max(0,Math.min(1,(h-DAWN)/(DUSK-DAWN)));
  const nightFrac=h>=DUSK?(h-DUSK)/10:h<DAWN?(h+4)/10:0;
  const showSun=h>=DAWN&&h<DUSK;
  const f=showSun?dayFrac:nightFrac;
  const x=8+f*48, y=30-Math.sin(f*Math.PI)*20;
  return (
    <svg viewBox="0 0 64 34" style={{width:64,height:34,display:"block",borderRadius:6}}>
      <defs><linearGradient id="strip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={grey?(night?"#141a30":"#6f757e"):(night?"#0b1230":dusk?"#5d3f6e":h<7?"#6a5a86":"#5f86ab")}/>
        <stop offset="100%" stopColor={grey?(night?"#232a40":"#9aa3ac"):(night?"#1a2144":dusk?"#c67a56":h<7.5?"#e6a878":"#bcd6e6")}/>
      </linearGradient></defs>
      <rect x="0" y="0" width="64" height="34" fill="url(#strip)"/>
      {night&&!grey&&[...Array(7)].map((_,i)=>(
        <circle key={i} cx={(i*23)%60+3} cy={(i*13)%16+3} r={i%2?0.5:0.75}
          fill="#e8e2ff" opacity={0.3+((i*7)%4)*0.14}/>))}
      {showSun
        ? <><circle cx={x} cy={y} r="5" fill="#ffd98a" opacity="0.3"/><circle cx={x} cy={y} r="3" fill="#ffe6a8"/></>
        : <><circle cx={x} cy={y} r="4.6" fill="#dfe4ff" opacity={0.10+lit*0.16}/>
           <circle cx={x} cy={y} r="2.7" fill="#e8ecff"/>
           {lit<0.97&&<circle cx={x+(waxing?-1:1)*(2.7*(1-lit)*1.9)} cy={y} r="2.7"
             fill={grey?(night?"#1c2338":"#8d959e"):(night?"#141b3c":"#5d3f6e")}/>}</>}
      <rect x="0" y="31" width="64" height="3" fill="#171320" opacity="0.5"/>
    </svg>);
}
function WeatherLayer({kind,strength}){
  const w=WEATHER[kind]; if(!w||!w.particles) return null;
  const st=strength??1;
  if(w.particles==="fog"){
    return (<div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
      <div className="fogA" style={{position:"absolute",inset:"-20% -40%",
        background:"radial-gradient(ellipse at 30% 50%, rgba(226,234,238,0.55), transparent 60%), radial-gradient(ellipse at 70% 40%, rgba(210,220,228,0.5), transparent 62%)",
        opacity:0.85*st}}/>
      <div className="fogB" style={{position:"absolute",inset:"-20% -40%",
        background:"radial-gradient(ellipse at 60% 65%, rgba(236,242,246,0.45), transparent 58%)",
        opacity:0.75*st}}/>
    </div>);
  }
  const snow = w.particles==="snow";
  if(snow){
    const flakes=(cls,size,op,colour,tile)=>(
      <div className={cls} style={{position:"absolute",inset:"-12% 0 -12% 0",pointerEvents:"none",
        opacity:op*st,
        backgroundImage:`radial-gradient(circle, ${colour} 0 ${size}px, transparent ${size}px)`,
        backgroundSize:`${tile}px ${tile}px`, backgroundRepeat:"repeat"}}/>);
    return (<div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
      {flakes("snowA",1.7,0.8,"rgba(255,255,255,0.92)",30)}
      {flakes("snowB",1.1,0.5,"rgba(238,246,255,0.85)",19)}
    </div>);
  }
  /* rain: thin slanted streaks with real gaps between them */
  const streaks=(cls,op,colour,gap,wide)=>(
    <div className={cls} style={{position:"absolute",inset:"-14% -10% -14% -10%",pointerEvents:"none",
      opacity:op*st,
      backgroundImage:`repeating-linear-gradient(104deg, transparent 0 ${gap}px, ${colour} ${gap}px ${gap+wide}px, transparent ${gap+wide}px ${gap+wide+3}px)`}}/>);
  return (<div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
    {streaks("rainA",0.55,"rgba(196,214,238,0.7)",15,1.3)}
    {streaks("rainB",0.35,"rgba(210,226,245,0.55)",23,1)}
  </div>);
}
const Panel=({children,style})=>(<div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"14px 16px",...style}}>{children}</div>);
const Label=({children})=>(<div style={{fontSize:10,letterSpacing:3,color:"#8f7bb0",textTransform:"uppercase",marginBottom:8}}>{children}</div>);

const SWAYS=new Set(["tuft","flower","fern","reed","mushroomSmall"]);
const NODE_SWAY=new Set(["lavenderSprig","moonbellPatch","reedBed","inkcapRing","nightcapCluster","ghostcapCluster"]);
/* ===== TIME ===== */
const HOUR_MS = 45000;                 // 1 in-game hour = 45 real seconds

/* ===== TOWNS ===== */
/* ground legend: . lane  , grass  T tree  ~ water  = planks  w well  # wall */
const TOWNS = {
  town:{
    name:"Wick Harbour", w:21, h:15,
    ground:[
      "~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~",
      "~~~~=~~~~~~~=~~~~~~~~",
      "~~~~=~~~~~~~=~~~~~~~~",
      ".....................",
      ".....................",
      ",...,...,...,...,...,",
      ".....................",
      ".........w...........",
      ",...,...,...,...,...,",
      ".....................",
      ".....................",
      ",..T,...,...T...,..T,",
      ".....................",
      "....................."],
    buildings:[
      {id:"harbour", kind:"office",  name:"Harbourmaster's",     x:1, y:5, w:3, h:2, door:[2,7]},
      {id:"bakery",  kind:"bakery",  name:"The bakery",          x:6, y:5, w:3, h:2, door:[7,7]},
      {id:"store",   kind:"store",   name:"Sloe's general store",x:11,y:5, w:4, h:2, door:[12,7], enter:"store"},
      {id:"clerk",   kind:"office",  name:"The clerk's office",  x:17,y:5, w:3, h:2, door:[18,7]},
      {id:"shop",    kind:"shop",    name:"Your shop",           x:3, y:9, w:4, h:3, door:[4,12], enter:"shop"},
      {id:"weaver",  kind:"cottage", name:"Ceri's cottage",      x:9, y:9, w:3, h:2, door:[10,11]},
      {id:"sella",   kind:"cottage", name:"Sella's cottage",     x:14,y:9, w:3, h:2, door:[15,11]},
      {id:"bunk",    kind:"cottage", name:"The quay bunk room",  x:18,y:9, w:2, h:2, door:[18,11]},
    ],
    boats:[[4,2],[12,3]],
    entry:[10,13],
  },
  village:{
    name:"Thornbury", w:19, h:13,
    ground:[
      ",,,TT,,,,,,,,,TT,,,",
      ",,,,,,,,,,,,,,,,,,,",
      ",,,,,,,,,,,,,,,,,,,",
      ",,,,,,,,,,,,,,,,,,,",
      "...................",
      ",,,,,,,,,,,,,,,,,,,",
      "...................",
      ",,,,,,,,w,,,,,,,,,,",
      ",,,,,,,,,,,,,,,,,,,",
      "...................",
      ",,,,,,,,,,,,,,,,,,,",
      ",,,,,,,,,,,,,,,,,,,",
      ",,T,,,,,,,,,,,,,T,,"],
    buildings:[
      {id:"chapel",  kind:"chapel",  name:"The chapel",        x:8, y:1, w:3, h:3, door:[9,4], enter:"chapel"},
      {id:"shop",    kind:"shop",    name:"Your shop",         x:2, y:2, w:4, h:3, door:[3,5],  enter:"shop"},
      {id:"carpent", kind:"workshop",name:"Stoke's carpentry", x:14,y:2, w:3, h:2, door:[15,4], enter:"furniture"},
      {id:"marta",   kind:"cottage", name:"Marta's cottage",   x:2, y:8, w:4, h:2, door:[3,10]},
      {id:"fair",    kind:"cottage", name:"The Fairweathers'", x:8, y:8, w:3, h:2, door:[9,10]},
      {id:"tobin",   kind:"cabin",   name:"Tobin's cabin",     x:15,y:8, w:3, h:2, door:[16,10]},
      {id:"farm",    kind:"farm",    name:"Hale farm",         x:11,y:11,w:5, h:2, door:[12,10]},
    ],
    boats:[],
    entry:[9,12],
  },
};

/* who is where, and when */
const TOWNSFOLK = {
  town:[
    {name:"Ardith Vell",     role:"Harbourmaster", work:[2,8],  home:[2,8],  hours:[7,19],
     line:"Tide's in at four. Write it down or don't, but don't come asking me twice."},
    {name:"Bram the Baker",  role:"Baker",         work:[7,8],  home:[7,8],  hours:[4,14],
     line:"Flour up to my elbows since four this morning."},
    {name:"Maren Sloe",      role:"General store", work:[12,8], home:[12,8], hours:[8,18],
     line:"If I haven't got it, I can likely get it. Give me a week."},
    {name:"Hollis the Clerk",role:"Clerk",         work:[18,8], home:[18,8], hours:[9,17],
     line:"I've made a list. I always make a list."},
    {name:"Ceri the Weaver", role:"Weaver",        work:[10,12],home:[10,12],hours:[8,18],
     line:"My eyes aren't what they were at the loom."},
    {name:"Sella Dock-hand", role:"Dock-hand",     work:[9,4],  home:[15,12],hours:[6,16],
     line:"Boat's in, back's out. You know how it goes."},
    {name:"Joss Kerrin",     role:"Odd jobs",      work:[13,4], home:[18,12],hours:[7,18],
     line:"You came from somewhere, then. What's it like, somewhere?"},
  ],
  village:[
    {name:"Ansel Roke",      role:"Keeps the chapel", work:[9,5], home:[9,5], hours:[6,19],
     line:"Spirits and prayers are neighbours. I've never seen them quarrel."},
    {name:"Deri Stoke",      role:"Carpenter",     work:[15,6], home:[15,6], hours:[7,18],
     line:"You want that shelf level or you want it quick. Not both."},
    {name:"Old Marta",       role:"Grandmother",   work:[4,11], home:[4,11], hours:[8,19],
     line:"My knees know the weather before the sky does."},
    {name:"Pim",             role:"Nine",          work:[6,11], home:[4,11], hours:[9,18],
     line:"I'm nine. I have my own money. It's for my sister."},
    {name:"Wren",            role:"Six",           work:[5,10], home:[4,11], hours:[10,17],
     line:"..."},
    {name:"Nan Fairweather", role:"",              work:[9,11], home:[9,11], hours:[8,18],
     line:"Don't tell my husband I came to see a witch."},
    {name:"Gareth Fairweather",role:"",            work:[11,10],home:[9,11], hours:[7,18],
     line:"No offence meant. I just don't see what we'd need one for."},
    {name:"Tobin",           role:"Lumberman",     work:[16,11],home:[16,11],hours:[6,17],
     line:"Just curious, mostly. And maybe a little worried."},
    {name:"Morwen Hale",     role:"Farmer",        work:[12,9], home:[12,9], hours:[5,19],
     line:"Frost coming. Three days, maybe four."},
  ],
};

/* buildings are drawn to their footprint in pixels */
function Building({b,T,season}){
  const W=b.w*T, H=b.h*T;
  const roofH=Math.min(H*0.52, T*1.15);
  const wall = {shop:"#e6d6b4",store:"#dfd0b0",bakery:"#e8dcc0",office:"#d6cdb8",
    cottage:"#e2d4b8",cabin:"#b99a74",chapel:"#dcd6c8",workshop:"#d8c4a0",farm:"#d8cdae"}[b.kind]||"#e0d2b6";
  const roof = {shop:"#7a4f78",store:"#8a5a3c",bakery:"#a8613a",office:"#6f6a5a",
    cottage:"#9a5a44",cabin:"#6e4d33",chapel:"#8a8296",workshop:"#7d6446",farm:"#8a7448"}[b.kind]||"#8a5a44";
  const [dx,dy]=b.door;
  const doorX=(dx-b.x)*T+T/2, onBottom=dy>=b.y+b.h;
  return (
    <g>
      <rect x="0" y={roofH} width={W} height={H-roofH} fill={wall}/>
      <path d={`M-4,${roofH} L${W/2},2 L${W+4},${roofH} Z`} fill={roof}/>
      {b.kind==="chapel"&&<>
        <rect x={W/2-1.6} y={-14} width="3.2" height="14" fill="#c8b48a"/>
        <rect x={W/2-6} y={-10} width="12" height="3" fill="#c8b48a"/></>}
      {b.kind==="bakery"&&<rect x={W-12} y={roofH-22} width="6" height="22" fill="#8a7258"/>}
      {b.kind==="shop"&&<>
        <rect x={W*0.12} y={roofH+9} width={W*0.34} height={H-roofH-22} fill="#2f4a52"/>
        <rect x={W*0.54} y={roofH+9} width={W*0.34} height={H-roofH-22} fill="#2f4a52"/>
        <rect x={W/2-16} y={roofH-9} width="32" height="7" rx="2" fill="#4a3a6b"/></>}
      {b.kind!=="shop"&&b.kind!=="farm"&&
        <rect x={W*0.62} y={roofH+8} width={Math.min(14,W*0.22)} height={Math.min(12,H*0.2)} fill="#3d5560"/>}
      {b.kind==="farm"&&<>
        <rect x="6" y={roofH+6} width={W-12} height={H-roofH-14} fill="#b8a878" opacity="0.5"/>
        <path d={`M10,${H-6} L${W-10},${H-6}`} stroke="#8a7448" strokeWidth="2"/></>}
      {/* the door */}
      {onBottom
        ? <rect x={doorX-7} y={H-16} width="14" height="16" rx="2" fill="#5a4430"/>
        : <rect x={doorX-7} y={H-16} width="14" height="16" rx="2" fill="#5a4430"/>}
      <circle cx={doorX+4} cy={H-8} r="1.3" fill="#c9a86a"/>
    </g>);
}
const NPC_SPRITE=(hue)=>(
  <g>
    <ellipse cx="0" cy="10" rx="6.5" ry="2" fill="#0d0a14" opacity="0.3"/>
    <path d="M-5,-1 q5,-2 10,0 L7,9 q-5,2 -10,0 Z" transform="translate(-2.5,0)" fill={hue}/>
    <circle cx="0" cy="-7" r="3.2" fill="#f0d8ba"/>
    <path d="M-3.3,-8 q0.5,-4 3.3,-4 q3,0 3.2,4 q-1.2,-2 -3.3,-2 q-2,0 -3.2,2 Z" fill="#4a3b30"/>
  </g>);
const NPC_HUES=["#5a6e8a","#7a5a4a","#5f7a5a","#7a5f7a","#8a6a4a","#4f6a72","#6a5a8a","#7d6a52","#5a7a6e"];

function npcAt(n,hour){
  if(isNight(hour)) return null;                 // indoors after dark
  const [a,b]=n.hours;
  if(hour>=a&&hour<b) return n.work;
  /* an hour either side of their day they're near home; otherwise inside */
  if(hour>=a-1&&hour<a) return n.home;
  if(hour>=b&&hour<b+1.5) return n.home;
  return null;
}


/* ===== PEOPLE OUT IN THE WORLD ===== */
/* home is the hex they live near; they don't stray far from it */
const WANDERERS = [
  { name:"Tobin", role:"Lumberman", town:"village", terrain:["forest"], hours:[6,17], range:3,
    act:"chop", hue:"#7d6a52",
    lines:["Third one today. The wood's wet and it doesn't want to split.",
           "There's a stand further in I've been saving. Don't tell Deri.",
           "Quiet out here. Suits me most days."] },
  { name:"Morwen Hale", role:"Farmer", town:"village", terrain:["meadow","orchard"], hours:[5,19], range:3,
    act:"tend", hue:"#5f7a5a",
    lines:["Frost coming. Three days, maybe four.",
           "Ground's late this year. It'll catch up or it won't.",
           "You'd be the witch, then."] },
  { name:"Sella Dock-hand", role:"Dock-hand", town:"town", terrain:["marsh","meadow"], hours:[6,16], range:3,
    act:"haul", hue:"#4f6a72",
    lines:["Creels want checking whether I want to check them or not.",
           "Tide's wrong for it. Came out anyway.",
           "Mind the soft ground over that way."] },
  { name:"Pim", role:"Nine", town:"village", terrain:["forest","meadow"], hours:[10,17], range:2,
    act:"crouch", hue:"#8a6a4a",
    lines:["I'm allowed. Marta knows I'm out.",
           "Don't tell Wren I was over this far.",
           "Do witches have to go to school?"] },
  { name:"Joss Kerrin", role:"Odd jobs", town:"town", terrain:["meadow","hills","forest","orchard"], hours:[7,18], range:5,
    act:"stand", hue:"#7a5f7a", weight:0.6,
    lines:["Paid work, this. Sort of. Ardith asked.",
           "You came from somewhere, then. What's it like, somewhere?",
           "One day I'll just go. That's the plan, anyway."] },
  { name:"The peddler", role:"Trader", town:null, terrain:["meadow","hills","orchard","forest"], hours:[8,18], range:99,
    act:"stand", hue:"#8a6a4a", weight:0.25,
    lines:["Everything on the cloth is for sale. Most of it twice.",
           "Roads are roads. Some are worse.",
           "I'd show you the tin but you've that look of no money about you."] },
];
const TOWN_HEX = { town:"6,4", village:"1,4" };
function hexDist(a,b){
  /* offset rows to cube coords, then the usual hex distance */
  const [ax,ay]=a.split(",").map(Number), [bx,by]=b.split(",").map(Number);
  const toCube=(c,r)=>{ const x=c-(r-(r&1))/2, z=r; return [x,-x-z,z]; };
  const [x1,y1,z1]=toCube(ax,ay), [x2,y2,z2]=toCube(bx,by);
  return Math.max(Math.abs(x1-x2),Math.abs(y1-y2),Math.abs(z1-z2));
}
/* who, if anyone, is working this hex today */
function wandererFor(hexId, day, hour, terrain){
  const rng=mulberry32(hashStr(`folk|${hexId}|${day}`));
  if(rng()>=0.17) return null;                    // about one site in six
  const able=WANDERERS.filter(w=>{
    if(!w.terrain.includes(terrain)) return false;
    if(hour<w.hours[0]||hour>=w.hours[1]) return false;
    if(w.town && hexDist(hexId, TOWN_HEX[w.town])>w.range) return false;
    return true;
  });
  if(!able.length) return null;
  /* the roamers turn up less than the locals do */
  const total=able.reduce((a,w)=>a+(w.weight??1),0);
  let r=rng()*total;
  for(const w of able){ r-=(w.weight??1); if(r<=0) return w; }
  return able[able.length-1];
}

/* ===== INTERIORS ===== */
/* floor legend: . boards  , stone  # wall  = threshold */
const INTERIORS = {
  shop:{ name:"The shop", w:11, h:8, floor:"boards",
    plan:["###########",
          "#.........#",
          "#.........#",
          "#.........#",
          "#.........#",
          "#.........#",
          "#.........#",
          "#####=#####"],
    objects:[
      {id:"counter", kind:"counter", x:2,y:2,w:4,h:1, label:"The counter",  act:"counter", stand:[3,3]},
      {id:"shelves", kind:"shelf",   x:8,y:1,w:2,h:1, label:"Your shelves", act:"make",    stand:[8,2]},
      {id:"satchel", kind:"crate",   x:8,y:4,w:1,h:1, label:"Your satchel", act:"satchel", stand:[8,5]},
      {id:"backdoor",kind:"door",    x:1,y:1,w:1,h:1, label:"The back room",act:"go:workshop", stand:[1,2]},
      {id:"stairs",  kind:"stairs",  x:9,y:6,w:1,h:1, label:"Up to your room", act:"go:room", stand:[8,6]},
    ],
    exit:{x:5,y:7,to:"townmap",label:"Out to the street"},
    entry:[5,6] },

  workshop:{ name:"The back room", w:9, h:7, floor:"boards",
    plan:["#########",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "####=####"],
    objects:[
      {id:"bench",  kind:"bench", x:2,y:1,w:3,h:1, label:"The workbench", act:"bench", stand:[3,2]},
      {id:"rack",   kind:"rack",  x:6,y:1,w:2,h:1, label:"A drying rack", act:"look:Bunches hung to dry. Nothing of yours on it yet.", stand:[6,2]},
      {id:"crates", kind:"crate", x:1,y:4,w:1,h:1, label:"Crates",        act:"look:Empty crates, stacked. They'll hold something one day.", stand:[1,3]},
    ],
    exit:{x:4,y:6,to:"shop",label:"Back to the shop"},
    entry:[4,5] },

  room:{ name:"Upstairs", w:9, h:7, floor:"boards",
    plan:["#########",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "####=####"],
    objects:[
      {id:"bed",   kind:"bed",   x:1,y:1,w:2,h:2, label:"Your bed",   act:"bed",   stand:[3,2]},
      {id:"stove", kind:"stove", x:6,y:1,w:2,h:1, label:"The little stove", act:"look:A stove, a kettle, and one chair. It is enough.", stand:[6,2]},
      {id:"chest", kind:"chest", x:7,y:4,w:1,h:1, label:"A chest",    act:"look:Empty but for a folded coat. Storage comes later.", stand:[6,4]},
      {id:"window",kind:"window",x:4,y:0,w:1,h:1, label:"The window", act:"look:It looks out over the lane. You can see a good deal of the town from up here.", stand:[4,1]},
    ],
    exit:{x:4,y:6,to:"shop",label:"Down to the shop"},
    entry:[4,5] },

  store:{ name:"Sloe's general store", w:11, h:7, floor:"stone",
    plan:["###########",
          "#.........#",
          "#.........#",
          "#.........#",
          "#.........#",
          "#.........#",
          "#####=#####"],
    objects:[
      {id:"counter",kind:"counter",x:3,y:2,w:4,h:1, label:"The counter", act:"look:Maren keeps the counter clear and the ledger closed. Buying comes later.", stand:[4,3]},
      {id:"shelfA", kind:"shelf",  x:1,y:1,w:2,h:1, label:"Shelves",     act:"look:Rope, lamp oil, jars, twine, and a great deal of things you'd only want once.", stand:[1,2]},
      {id:"shelfB", kind:"shelf",  x:8,y:1,w:2,h:1, label:"Shelves",     act:"look:Sacks of flour and meal, stacked to the ceiling.", stand:[8,2]},
      {id:"barrel", kind:"crate",  x:9,y:4,w:1,h:1, label:"A barrel",    act:"look:Salt fish. The smell reaches the door.", stand:[8,4]},
    ],
    npc:{name:"Maren Sloe", at:[4,1], hue:"#7a5a4a",
      line:"If I haven't got it, I can likely get it. Give me a week."},
    exit:{x:5,y:6,to:"townmap",label:"Out to the street"},
    entry:[5,5] },

  furniture:{ name:"Stoke's carpentry", w:9, h:7, floor:"boards",
    plan:["#########",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "####=####"],
    objects:[
      {id:"bench", kind:"bench", x:1,y:1,w:3,h:1, label:"Deri's bench", act:"look:Chisels laid out in order of size. Someone minds about that.", stand:[2,2]},
      {id:"timber",kind:"timber",x:6,y:1,w:2,h:1, label:"Stacked timber", act:"look:Boards seasoning against the wall. Tobin's work, most likely.", stand:[6,2]},
      {id:"chair", kind:"chair", x:7,y:4,w:1,h:1, label:"A half-built chair", act:"look:Three legs and an argument.", stand:[6,4]},
    ],
    npc:{name:"Deri Stoke", at:[3,3], hue:"#7d6a52",
      line:"You want that shelf level or you want it quick. Not both."},
    exit:{x:4,y:6,to:"townmap",label:"Out to the street"},
    entry:[4,5] },

  chapel:{ name:"The chapel", w:9, h:9, floor:"stone",
    plan:["#########",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "#.......#",
          "####=####"],
    objects:[
      {id:"altar", kind:"altar", x:3,y:1,w:3,h:1, label:"The altar", act:"look:Swept, and older than the village. Somebody has left dried lavender on it.", stand:[4,2]},
      {id:"pewA",  kind:"pew",   x:2,y:4,w:2,h:1, label:"A pew", act:"look:Worn smooth in two places and nowhere else.", stand:[2,5]},
      {id:"pewB",  kind:"pew",   x:5,y:4,w:2,h:1, label:"A pew", act:"look:Worn smooth in two places and nowhere else.", stand:[5,5]},
      {id:"candles",kind:"candles",x:7,y:1,w:1,h:1, label:"Candles", act:"look:Half of them lit. Ansel says he never lights them himself.", stand:[7,2]},
    ],
    npc:{name:"Ansel Roke", at:[4,3], hue:"#4f6a72",
      line:"Spirits and prayers are neighbours. I've never seen them quarrel."},
    exit:{x:4,y:8,to:"townmap",label:"Out into the village"},
    entry:[4,7] },
};

/* someone at work out in the country */
function Worker({w}){
  const body=(<g>
    <ellipse cx="0" cy="10" rx="6.5" ry="2" fill="#0d0a14" opacity="0.3"/>
    <path d="M-7.5,-1 q5,-2 10,0 L4.5,9 q-5,2 -10,0 Z" fill={w.hue}/>
    <circle cx="0" cy="-7" r="3.2" fill="#f0d8ba"/>
    <path d="M-3.3,-8 q0.5,-4 3.3,-4 q3,0 3.2,4 q-1.2,-2 -3.3,-2 q-2,0 -3.2,2 Z" fill="#4a3b30"/>
  </g>);
  if(w.act==="chop") return (<g>
    <g transform="translate(9,7)"><rect x="-8" y="-3" width="16" height="6" rx="3" fill="#6b5236"/>
      <ellipse cx="-8" cy="0" rx="2.4" ry="3" fill="#8a6c46"/></g>
    {body}
    <g className="chop" style={{transformOrigin:"2px -2px"}}>
      <path d="M2,-2 L11,-9" stroke="#6f5237" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M11,-9 l4,-1 l1,4 Z" fill="#9aa4b0"/>
    </g>
  </g>);
  if(w.act==="tend") return (<g>
    {body}
    <g className="tend" style={{transformOrigin:"0px 0px"}}>
      <path d="M3,-1 L10,7" stroke="#6f5237" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M10,7 l3,3 l-4,1 Z" fill="#8a8f96"/>
    </g>
    <circle cx="-9" cy="9" r="2.4" fill="#63873c"/><circle cx="-13" cy="10" r="2" fill="#547635"/>
  </g>);
  if(w.act==="haul") return (<g>
    {body}
    <g className="tend" style={{transformOrigin:"0px 0px"}}>
      <path d="M4,0 q7,2 9,8" stroke="#8aa87e" strokeWidth="1.4" fill="none"/>
      <path d="M9,8 q5,-1 6,4 q-4,3 -7,0 Z" fill="#7a6448"/>
    </g>
  </g>);
  if(w.act==="crouch") return (<g>
    <ellipse cx="0" cy="9" rx="6" ry="2" fill="#0d0a14" opacity="0.28"/>
    <path d="M-6,2 q5,-3 10,0 L4,8 q-5,2 -9,0 Z" fill={w.hue}/>
    <circle cx="1" cy="-2" r="3" fill="#f0d8ba"/>
    <path d="M-2.2,-3 q0.5,-3.6 3.2,-3.6 q2.8,0 3,3.6 q-1.2,-1.8 -3.1,-1.8 q-1.9,0 -3.1,1.8 Z" fill="#6a4a2e"/>
    <path d="M5,3 q5,1 7,4" stroke="#8a7a5a" strokeWidth="1.2" fill="none"/>
  </g>);
  return (<g>{body}
    <g transform="translate(-11,3)">
      <rect x="-3.5" y="-2" width="7" height="6" fill="#7a5836"/>
      <path d="M-3.5,-2 q3.5,-3 7,0 Z" fill="#8f6a42"/></g>
  </g>);
}

/* furniture, drawn to its footprint */
function Furniture({o,T}){
  const W=o.w*T, H=o.h*T, k=o.kind;
  if(k==="counter") return (<g>
    <rect x="2" y={H*0.28} width={W-4} height={H*0.62} fill="#7a5c3c"/>
    <rect x="0" y={H*0.16} width={W} height={H*0.2} rx="3" fill="#95744c"/>
    <path d={`M8,${H*0.55} L${W-8},${H*0.55}`} stroke="#5f4327" strokeWidth="1.4"/></g>);
  if(k==="shelf") return (<g>
    <rect x="1" y="4" width={W-2} height={H-8} fill="#6b5236"/>
    <rect x="3" y="7" width={W-6} height={4} fill="#8a6c46"/>
    <rect x="3" y={H*0.5} width={W-6} height={4} fill="#8a6c46"/>
    <circle cx={W*0.28} cy="5" r="3" fill="#a487cf"/><circle cx={W*0.55} cy="5" r="3" fill="#c07a5a"/>
    <rect x={W*0.7} y={H*0.28} width="5" height="7" fill="#7ba890"/></g>);
  if(k==="crate") return (<g>
    <rect x="5" y={H*0.3} width={W-10} height={H*0.6} fill="#8a6a44"/>
    <path d={`M5,${H*0.55} L${W-5},${H*0.55}`} stroke="#5f4327" strokeWidth="1.6"/>
    <path d={`M${W/2},${H*0.3} L${W/2},${H*0.9}`} stroke="#5f4327" strokeWidth="1.2"/></g>);
  if(k==="bench") return (<g>
    <rect x="1" y={H*0.3} width={W-2} height={H*0.58} fill="#6f5436"/>
    <rect x="1" y={H*0.24} width={W-2} height={H*0.14} fill="#8d6c45"/>
    <circle cx={W*0.2} cy={H*0.2} r="4.5" fill="#9aa4b0"/>
    <rect x={W*0.42} y={H*0.06} width="7" height="12" rx="2" fill="#7ba890"/>
    <rect x={W*0.62} y={H*0.1} width="5" height="9" rx="1.5" fill="#c9b06a"/></g>);
  if(k==="rack") return (<g>
    <rect x="2" y="6" width={W-4} height="3" fill="#7a5c3c"/>
    {[0.2,0.45,0.7].map((f,i)=>(<g key={i} transform={`translate(${W*f},9)`}>
      <path d="M0,0 L0,13" stroke="#6d8a4e" strokeWidth="1.4"/>
      <ellipse cx="0" cy="15" rx="3.4" ry="5" fill={i%2?"#a487cf":"#9a8aa8"}/></g>))}</g>);
  if(k==="bed") return (<g>
    <rect x="3" y="4" width={W-6} height={H-8} rx="3" fill="#6b5236"/>
    <rect x="5" y={H*0.3} width={W-10} height={H*0.56} rx="3" fill="#c9bfae"/>
    <rect x="5" y={H*0.3} width={W-10} height={H*0.2} rx="3" fill="#8f7aa8"/>
    <rect x="7" y="8" width={W*0.4} height={H*0.2} rx="3" fill="#e8e0cc"/></g>);
  if(k==="stove") return (<g>
    <rect x="3" y={H*0.24} width={W-6} height={H*0.64} fill="#5a5450"/>
    <rect x={W*0.2} y={H*0.44} width={W*0.3} height={H*0.3} fill="#2a2420"/>
    <circle cx={W*0.34} cy={H*0.6} r="4" fill="#d8873a"/>
    <rect x={W*0.62} y={H*0.16} width="9" height="9" rx="2" fill="#8a8a86"/>
    <rect x={W*0.72} y="0" width="4" height={H*0.2} fill="#4a4440"/></g>);
  if(k==="chest") return (<g>
    <rect x="4" y={H*0.4} width={W-8} height={H*0.45} fill="#7a5836"/>
    <path d={`M4,${H*0.4} q${(W-8)/2},-${H*0.3} ${W-8},0 Z`} fill="#8f6a42"/>
    <rect x={W*0.42} y={H*0.44} width="6" height="8" fill="#c9a86a"/></g>);
  if(k==="window") return (<g>
    <rect x="4" y={H*0.2} width={W-8} height={H*0.55} fill="#3d6172"/>
    <rect x="4" y={H*0.2} width={W-8} height={H*0.55} fill="none" stroke="#7a5c3c" strokeWidth="3"/>
    <path d={`M${W/2},${H*0.2} L${W/2},${H*0.75}`} stroke="#7a5c3c" strokeWidth="2"/></g>);
  if(k==="stairs") return (<g>
    {[0,1,2,3].map(i=>(<rect key={i} x={2+i*3} y={H-8-i*7} width={W-4-i*3} height="7" fill={i%2?"#8a6c46":"#7a5c3c"}/>))}</g>);
  if(k==="door") return (<g>
    <rect x="4" y="4" width={W-8} height={H-6} rx="2" fill="#5a4430"/>
    <circle cx={W-11} cy={H*0.55} r="1.6" fill="#c9a86a"/></g>);
  if(k==="timber") return (<g>
    {[0,1,2].map(i=>(<rect key={i} x="2" y={6+i*8} width={W-4} height="6" rx="2" fill={i%2?"#8a6c46":"#7a5c3c"}/>))}</g>);
  if(k==="chair") return (<g>
    <rect x={W*0.25} y={H*0.4} width={W*0.5} height="5" fill="#8a6c46"/>
    <rect x={W*0.28} y={H*0.45} width="4" height={H*0.4} fill="#7a5c3c"/>
    <rect x={W*0.62} y={H*0.45} width="4" height={H*0.4} fill="#7a5c3c"/>
    <rect x={W*0.28} y={H*0.14} width="4" height={H*0.3} fill="#7a5c3c"/></g>);
  if(k==="altar") return (<g>
    <rect x="3" y={H*0.3} width={W-6} height={H*0.6} fill="#a89e8c"/>
    <rect x="0" y={H*0.2} width={W} height={H*0.16} rx="2" fill="#bdb3a0"/>
    <ellipse cx={W*0.5} cy={H*0.26} rx="9" ry="3" fill="#a487cf" opacity="0.8"/></g>);
  if(k==="pew") return (<g>
    <rect x="2" y={H*0.42} width={W-4} height="6" fill="#7a5c3c"/>
    <rect x="2" y={H*0.16} width={W-4} height="5" fill="#6b5236"/>
    <rect x="4" y={H*0.5} width="4" height={H*0.3} fill="#6b5236"/>
    <rect x={W-8} y={H*0.5} width="4" height={H*0.3} fill="#6b5236"/></g>);
  if(k==="candles") return (<g>
    {[0.3,0.5,0.7].map((f,i)=>(<g key={i} transform={`translate(${W*f},${H*0.5})`}>
      <rect x="-1.6" y="0" width="3.2" height={10-i*2} fill="#e8e0cc"/>
      <circle cx="0" cy="-2" r="2.2" fill="#f0d890"/>
      <circle cx="0" cy="-2" r="5" fill="#f0d890" opacity="0.18"/></g>))}</g>);
  return <rect x="4" y="4" width={W-8} height={H-8} fill="#6b5236"/>;
}

/* ===== SOUND =====
   All generated live — no audio files. Four seasonal beds built from the same parts. */
const MUSIC = [
  { bpm:88, bright:2800, lead:"triangle",
    scale:["D4","E4","F#4","G#4","A4","B4","C#5","D5","E5","F#5"],
    bass:["D2","A2","B1","F#2"],
    chords:[["D3","F#3","A3"],["A2","C#3","E3"],["B2","D3","F#3"],["F#2","A2","C#3"]],
    phrases:[[[7,"8n"],[5,"8n"],[4,"4n"],[2,"8n"],[4,"8n"],[5,"2n"]],
             [[4,"8n"],[5,"8n"],[7,"8n"],[8,"4n"],[7,"8n"],[5,"4n"],[4,"4n"]],
             [[2,"4n"],[4,"8n"],[5,"8n"],[4,"4n"],[1,"2n"]],
             [[9,"8n"],[7,"8n"],[5,"8n"],[4,"8n"],[2,"2n"]]] },
  { bpm:78, bright:2400, lead:"sine",
    scale:["G3","A3","B3","C4","D4","E4","F4","G4","A4","B4"],
    bass:["G2","D2","C2","E2"],
    chords:[["G2","B2","D3"],["C3","E3","G3"],["D3","F3","A3"],["E2","G2","B2"]],
    phrases:[[[4,"4n"],[5,"8n"],[7,"8n"],[5,"4n"],[4,"2n"]],
             [[7,"8n"],[8,"8n"],[7,"8n"],[5,"4n."],[4,"8n"],[2,"2n"]],
             [[2,"8n"],[4,"8n"],[5,"4n"],[7,"4n"],[5,"2n"]],
             [[9,"4n"],[7,"8n"],[5,"8n"],[4,"4n"],[0,"2n"]]] },
  { bpm:72, bright:1900, lead:"triangle",
    scale:["A3","B3","C4","D4","E4","F#4","G4","A4","B4","C5"],
    bass:["A1","E2","G1","D2"],
    chords:[["A2","C3","E3"],["G2","B2","D3"],["D3","F#3","A3"],["E2","G2","B2"]],
    phrases:[[[4,"8n"],[2,"8n"],[0,"4n"],[2,"8n"],[4,"8n"],[5,"2n"]],
             [[7,"4n"],[5,"8n"],[4,"8n"],[2,"4n."],[0,"2n"]],
             [[2,"8n"],[4,"8n"],[7,"8n"],[9,"4n"],[7,"4n"],[4,"2n"]],
             [[0,"4n"],[-1,"8n"],[4,"8n"],[2,"4n"],[0,"2n"]]] },
  { bpm:64, bright:1500, lead:"sine",
    scale:["E3","F#3","G3","A3","B3","C4","D4","E4","G4","B4"],
    bass:["E1","B1","C2","G1"],
    chords:[["E2","G2","B2"],["C3","E3","G3"],["G2","B2","D3"],["B1","F#2","A2"]],
    phrases:[[[4,"4n"],[6,"8n"],[7,"8n"],[4,"2n"]],
             [[7,"8n"],[6,"8n"],[4,"4n."],[2,"4n"],[0,"2n"]],
             [[2,"4n"],[4,"4n"],[-1,"4n"],[7,"2n"]],
             [[9,"2n"],[7,"4n"],[4,"2n"]]] },
];

const Sound = {
  ready:false, lastError:null, nodes:null, sfx:null, mood:{season:0,night:false,weather:"fair"}, bar:0,
  async init(){
    if(this.ready) return true;
    try{
      await Tone.start();
      const out=new Tone.Volume(-13).toDestination();
      const reverb=new Tone.Reverb({decay:5.5,wet:0.34}).connect(out);
      const filter=new Tone.Filter({frequency:2800,type:"lowpass",rolloff:-12}).connect(reverb);

      const pad=new Tone.PolySynth(Tone.AMSynth,{harmonicity:1.4,oscillator:{type:"sine"},
        envelope:{attack:2.4,decay:2,sustain:0.65,release:5}}).connect(filter); pad.volume.value=-24;
      const bass=new Tone.Synth({oscillator:{type:"sine"},
        envelope:{attack:0.03,decay:0.5,sustain:0.35,release:1.1}}).connect(filter); bass.volume.value=-17;
      const comp=new Tone.PolySynth(Tone.Synth,{oscillator:{type:"triangle"},
        envelope:{attack:0.005,decay:0.42,sustain:0,release:0.5}}).connect(filter); comp.volume.value=-25;
      const lead=new Tone.Synth({oscillator:{type:"triangle"},
        envelope:{attack:0.008,decay:0.9,sustain:0.08,release:1.3}}).connect(filter); lead.volume.value=-15;
      const bell=new Tone.FMSynth({harmonicity:3.01,modulationIndex:5,
        envelope:{attack:0.004,decay:2.2,sustain:0,release:2},
        modulationEnvelope:{attack:0.01,decay:0.3,sustain:0,release:0.3}}).connect(reverb); bell.volume.value=-26;
      const shaker=new Tone.NoiseSynth({noise:{type:"white"},
        envelope:{attack:0.002,decay:0.045,sustain:0}}).connect(
        new Tone.Filter({frequency:6500,type:"highpass"}).connect(out)); shaker.volume.value=-34;

      const rainNoise=new Tone.Noise("pink");
      const rainFilt=new Tone.Filter({frequency:900,type:"lowpass"}).connect(out);
      const rainVol=new Tone.Volume(-60).connect(rainFilt);
      rainNoise.connect(rainVol); rainNoise.start();

      const self=this;
      Tone.Transport.bpm.value=MUSIC[0].bpm;

      const padLoop=new Tone.Loop(time=>{
        const m=MUSIC[self.mood.season];
        pad.triggerAttackRelease(m.chords[self.bar%m.chords.length],"1m",time,0.45);
        self.bar++;
      },"1m").start(0);
      const bassLoop=new Tone.Loop(time=>{
        const m=MUSIC[self.mood.season];
        const root=m.bass[(self.bar-1+m.bass.length)%m.bass.length];
        const e=Tone.Time("8n").toSeconds();
        bass.triggerAttackRelease(root,"4n",time,0.7);
        if(!self.mood.night) bass.triggerAttackRelease(root,"8n",time+e*4,0.45);
      },"1m").start(0);
      const compLoop=new Tone.Loop(time=>{
        const m=MUSIC[self.mood.season];
        if(Math.random() > (self.mood.night?0.3:0.62)) return;
        const ch=m.chords[(self.bar-1+m.chords.length)%m.chords.length];
        const note=ch[Math.floor(Math.random()*ch.length)];
        comp.triggerAttackRelease(Tone.Frequency(note).transpose(12).toNote(),"16n",time,0.4);
      },"8n").start("1m");
      const shakerLoop=new Tone.Loop(time=>{
        if(self.mood.night&&Math.random()<0.5) return;
        shaker.triggerAttackRelease("64n",time,Math.random()<0.25?0.6:0.3);
      },"8n").start("2m");
      const melLoop=new Tone.Loop(time=>{
        const m=MUSIC[self.mood.season];
        if(Math.random() > (self.mood.night?0.5:0.85)) return;
        const ph=m.phrases[Math.floor(Math.random()*m.phrases.length)];
        lead.oscillator.type=m.lead;
        let t=time;
        ph.forEach(([idx,dur],i)=>{
          const d=Tone.Time(dur).toSeconds();
          if(idx>=0){
            const note=m.scale[Math.min(idx,m.scale.length-1)];
            lead.triggerAttackRelease(note,dur,t,0.55+Math.random()*0.2);
            if(i===0&&Math.random()<0.35)
              bell.triggerAttackRelease(Tone.Frequency(note).transpose(12).toNote(),"2n",t,0.3);
          }
          t+=d;
        });
      },"2m").start("2m");

      const rev=new Tone.Reverb({decay:1.5,wet:0.22}).connect(out);
      const paperFilt=new Tone.Filter({frequency:2200,type:"highpass"}).connect(rev);
      this.sfx={
        tap:new Tone.Synth({oscillator:{type:"sine"},envelope:{attack:0.002,decay:0.09,sustain:0,release:0.08}}).connect(rev),
        wood:new Tone.MembraneSynth({pitchDecay:0.008,octaves:2,envelope:{attack:0.001,decay:0.14,sustain:0}}).connect(rev),
        chime:new Tone.FMSynth({harmonicity:4,modulationIndex:9,envelope:{attack:0.004,decay:1.6,sustain:0,release:1.4}}).connect(rev),
        low:new Tone.Synth({oscillator:{type:"triangle"},envelope:{attack:0.01,decay:0.4,sustain:0,release:0.3}}).connect(rev),
        paper:new Tone.NoiseSynth({noise:{type:"pink"},
          envelope:{attack:0.16,decay:0.10,sustain:0.55,release:0.34}}).connect(paperFilt),
        rev,paperFilt,
      };
      this.sfx.tap.volume.value=-20; this.sfx.wood.volume.value=-18;
      this.sfx.chime.volume.value=-18; this.sfx.low.volume.value=-16;
      this.sfx.paper.volume.value=-16;

      this.nodes={out,reverb,filter,pad,bass,comp,lead,bell,shaker,rainNoise,rainVol,rainFilt};
      Tone.Transport.start();
      this.ready=true;
      return true;
    }catch(e){ this.lastError=e&&e.message?e.message:String(e); return false; }
  },
  setMood(season,night,weather){
    this.mood={season,night,weather};
    if(!this.ready) return;
    const m=MUSIC[season], a=this.nodes;
    const wet=WEATHER[weather]||{};
    const rainy=wet.particles==="rain";
    Tone.Transport.bpm.rampTo(night?m.bpm*0.9:m.bpm,4);
    a.filter.frequency.rampTo(rainy?m.bright*0.4:night?m.bright*0.55:m.bright,3);
    a.reverb.wet.rampTo(night?0.5:rainy?0.44:0.34,3);
    a.rainVol.volume.rampTo(rainy?-29:-60,2.5);
    a.shaker.volume.rampTo(rainy?-40:night?-38:-34,2);
  },
  mute(on){ if(this.ready) this.nodes.out.volume.rampTo(on?-60:-13,0.4); },
  play(kind){
    if(!this.ready||!this.sfx) return;
    const s=this.sfx, t=Tone.now();
    try{
      if(kind==="tap")    s.tap.triggerAttackRelease("C6","32n",t);
      if(kind==="step")   s.wood.triggerAttackRelease("G2","32n",t);
      if(kind==="gather"){s.tap.triggerAttackRelease("E5","32n",t);
                          s.tap.triggerAttackRelease("B5","32n",t+0.07);}
      if(kind==="fail")   s.low.triggerAttackRelease("D3","8n",t);
      if(kind==="coin"){  s.chime.triggerAttackRelease("E6","16n",t,0.5);
                          s.chime.triggerAttackRelease("B6","16n",t+0.06,0.4);}
      if(kind==="done"){  s.chime.triggerAttackRelease("D5","4n",t,0.5);
                          s.chime.triggerAttackRelease("A5","4n",t+0.12,0.45);
                          s.chime.triggerAttackRelease("F#6","2n",t+0.26,0.35);}
      if(kind==="page"){
        s.paperFilt.frequency.cancelScheduledValues(t);
        s.paperFilt.frequency.setValueAtTime(700,t);
        s.paperFilt.frequency.linearRampToValueAtTime(3800,t+0.30);
        s.paperFilt.frequency.linearRampToValueAtTime(1100,t+0.62);
        s.paper.volume.cancelScheduledValues(t);
        s.paper.volume.setValueAtTime(-22,t);
        s.paper.volume.linearRampToValueAtTime(-13,t+0.28);
        s.paper.volume.linearRampToValueAtTime(-24,t+0.60);
        s.paper.triggerAttackRelease(0.46,t,0.6);
      }
    }catch(e){}
  },
};

/* ===== WEATHER ===== */
const WEATHER = {
  clear:  { name:"Clear",        tint:null,              extra:0,    particles:null },
  fair:   { name:"Fair",         tint:[255,244,214],     extra:0.03, particles:null },
  cloud:  { name:"Overcast",     tint:[150,156,170],     extra:0.13, particles:null },
  mist:   { name:"Mist",         tint:[196,206,210],     extra:0.16, particles:"fog" },
  fog:    { name:"Thick fog",    tint:[188,196,202],     extra:0.26, particles:"fog" },
  drizzle:{ name:"Drizzle",      tint:[140,152,168],     extra:0.17, particles:"rain" },
  rain:   { name:"Rain",         tint:[116,128,150],     extra:0.22, particles:"rain" },
  storm:  { name:"Storm",        tint:[86,96,124],       extra:0.30, particles:"rain" },
  wind:   { name:"High wind",    tint:[176,180,186],     extra:0.08, particles:null },
  haze:   { name:"Haze",         tint:[255,232,186],     extra:0.08, particles:null },
  snow:   { name:"Snow",         tint:[206,216,236],     extra:0.16, particles:"snow" },
  sleet:  { name:"Sleet",        tint:[160,172,192],     extra:0.22, particles:"snow" },
  cold:   { name:"Hard cold",    tint:[196,212,238],     extra:0.05, particles:null },
};
/* each season has its own weighted table */
const SEASON_WEATHER = [
  [["fair",4],["clear",3],["cloud",3],["drizzle",3],["rain",2],["mist",2],["wind",1],["storm",1]],   // spring
  [["clear",5],["fair",4],["haze",3],["cloud",2],["storm",2],["rain",1],["mist",1]],                 // summer
  [["cloud",4],["fog",3],["mist",3],["drizzle",3],["wind",3],["fair",2],["rain",2],["storm",1]],     // autumn
  [["cold",4],["snow",4],["cloud",3],["clear",2],["sleet",2],["fog",2],["wind",2]],                  // winter
];
function rollWeather(season,rng){
  const table=SEASON_WEATHER[season];
  const total=table.reduce((a,[,w])=>a+w,0);
  let r=(rng??Math.random())*total;
  for(const [k,w] of table){ r-=w; if(r<=0) return k; }
  return table[0][0];
}
/* ===== SEASONAL PALETTE ===== */
const SEASON_GROUND = {
  meadow: [["#6f8a50","#77925a"],["#7d9450","#869c58"],["#8a8a46","#948f4e"],["#8e9aa0","#97a2a8"]],
  forest: [["#33583c","#2e5038"],["#2f5537","#2a4d33"],["#4a5230","#514f2c"],["#4c5a5e","#455256"]],
  hills:  [["#7a6c48","#837555"],["#847550","#8d7e5c"],["#8a7442","#937d4c"],["#8d949c","#959ca4"]],
  marsh:  [["#4e6a55","#54715c"],["#4c6b52","#527259"],["#5c6243","#63684a"],["#63737a","#6a7a81"]],
  orchard:[["#79883c","#7f8f42"],["#7c8c3e","#829344"],["#8a7a36","#90803c"],["#8a939a","#919aa1"]],
  water:  [["#35596f","#3b6076"],["#36607a","#3c6780"],["#33525f","#395966"],["#4a6c7e","#51748a"]],
};
const HEX_FILL = {
  meadow: ["#7d9a5c","#86a05e","#9a9a52","#a3aeb4"],
  forest: ["#3f6b4a","#3a6746","#5a663c","#5c6a6e"],
  hills:  ["#8a7a52","#94835c","#9a8450","#9aa2aa"],
  water:  ["#3d6580","#406c8a","#3a5e72","#52738a"],
  marsh:  ["#5c7a63","#5f7f66","#6c7350","#6e7e86"],
  orchard:["#96a04f","#9aa653","#a08c46","#9aa3aa"],
};
/* ===== CALENDAR ===== */
const MONTH_DAYS = 30, SEASONS = ["Spring","Summer","Autumn","Winter"];
const seasonOf   = d => Math.floor((d-1)/MONTH_DAYS)%4;
const dayOfMonth = d => ((d-1)%MONTH_DAYS)+1;
const yearOf     = d => Math.floor((d-1)/(MONTH_DAYS*4))+1;
/* day 1 is a full moon — she leaves home under a bright sky */
const moonAge = d => ((dayOfMonth(d)-1)/MONTH_DAYS);          // 0 = full, .5 = new
const moonLit = d => (1+Math.cos(2*Math.PI*moonAge(d)))/2;    // 1 full .. 0 new
const MOON_NAMES = ["Full","Waning gibbous","Last quarter","Waning crescent",
                    "New","Waxing crescent","First quarter","Waxing gibbous"];
const moonPhase = d => Math.round(moonAge(d)*8)%8;
const moonName  = d => MOON_NAMES[moonPhase(d)];
const DAWN = 6, DUSK = 20;
const isNight = h => h>=DUSK || h<DAWN;
const LKEYS=[
  {h:0,c:[10,16,44],a:0.56,l:"deep night"},
  {h:4.5,c:[18,24,56],a:0.53,l:"the small hours"},
  {h:5.5,c:[40,40,78],a:0.44,l:"before dawn"},
  {h:6,c:[232,158,104],a:0.30,l:"dawn"},
  {h:7.5,c:[255,222,172],a:0.12,l:"early morning"},
  {h:9,c:[255,255,255],a:0.00,l:"morning"},
  {h:12,c:[255,255,255],a:0.00,l:"midday"},
  {h:16,c:[255,255,255],a:0.00,l:"afternoon"},
  {h:17.5,c:[255,196,120],a:0.14,l:"late afternoon"},
  {h:19,c:[240,138,78],a:0.28,l:"golden hour"},
  {h:20,c:[96,60,112],a:0.44,l:"dusk"},
  {h:21.5,c:[22,28,60],a:0.52,l:"nightfall"},
  {h:24,c:[10,16,44],a:0.56,l:"deep night"},
];
function lightAt(h,opts){
  h=((h%24)+24)%24;
  let i=0; while(i<LKEYS.length-1&&LKEYS[i+1].h<=h)i++;
  const a=LKEYS[Math.min(i,LKEYS.length-2)],b=LKEYS[Math.min(i+1,LKEYS.length-1)];
  const sp=b.h-a.h||1,t=Math.max(0,Math.min(1,(h-a.h)/sp));
  const c=[0,1,2].map(k=>Math.round(a.c[k]+(b.c[k]-a.c[k])*t));
  let alpha=a.a+(b.a-a.a)*t;
  let rgb=c;
  const o=opts||{};
  /* a full moon lifts the dark; a new moon deepens it */
  if(isNight(h)&&o.moon!==undefined) alpha -= (o.moon-0.4)*0.11;
  /* weather sits on top of the hour */
  if(o.weather){
    const w=WEATHER[o.weather];
    if(w){
      alpha += w.extra;
      if(w.tint){ const m=Math.min(0.75,(w.extra+0.05)*2.2);
        rgb=[0,1,2].map(k=>Math.round(c[k]*(1-m)+w.tint[k]*m)); }
    }
  }
  alpha=Math.max(0,Math.min(0.78,alpha));
  return {rgb:`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,alpha,label:t<0.5?a.l:b.l};
}
function clockLabel(h){
  const hh=Math.floor(h)%24, mm=Math.floor((h%1)*60);
  const ap=hh<12?"am":"pm", d=hh%12===0?12:hh%12;
  return `${d}:${String(mm).padStart(2,"0")}${ap}`;
}
function phaseLabel(h){
  if(isNight(h)) return h>=DUSK?"Night":"Night";
  if(h<7.5) return "Dawn";
  if(h<12) return "Morning";
  if(h<17) return "Afternoon";
  return "Evening";
}
/* is an ingredient workable at this hour */
function ingInSeason(ing,day){
  const sn=ING[ing]&&ING[ing].seasons;
  if(!sn) return true;
  return sn.includes(seasonOf(day));
}
function ingOpen(ing,h){
  const w=ING[ing]&&ING[ing].when;
  if(!w||w==="any") return true;
  return w==="night" ? isNight(h) : !isNight(h);
}
/* which harvest window a node belongs to, so plants regrow on their own schedule */
function windowOf(ing,day,h){
  const w=(ING[ing]&&ING[ing].when)||"any";
  if(w==="day")   return `d${day}`;
  if(w==="night") return h>=DUSK ? `n${day}` : `n${day-1}`;
  return `a${day}`;
}
const MAXSTAM=8, SAVE_KEY="witchgame:v11";

export default function WitchGame(){
  const grid=useMemo(buildGrid,[]);
  const byId=useMemo(()=>Object.fromEntries(grid.map(t=>[t.id,t])),[grid]);

  const [loaded,setLoaded]=useState(false);
  const [screen,setScreen]=useState("create");
  const witch="Éri";
  const familiar="Lazlo";
  const [prof,setProf]=useState("herbalism");   // herbalism is what she arrives with
  const [skills,setSkills]=useState({herbalism:{xp:0,trained:1},stonecraft:{xp:0,trained:1},fortune:{xp:0,trained:1}});

  const [pos,setPos]=useState(START);
  const [seen,setSeen]=useState(()=>{const s=new Set([START]);const[c,r]=START.split(",").map(Number);neighbors(c,r).forEach(([nc,nr])=>s.add(`${nc},${nr}`));return s;});
  const [day,setDay]=useState(1);
  const [hour,setHour]=useState(7);
  const [showClock,setShowClock]=useState(false);
  const [soundOn,setSoundOn]=useState(false);
  const [soundErr,setSoundErr]=useState(null);
  const [stamina,setStamina]=useState(MAXSTAM);
  const [coin,setCoin]=useState(12);
  const [rep,setRep]=useState(0);
  const [bag,setBag]=useState({});
  const [goods,setGoods]=useState({});
  const [homeTown,setHomeTown]=useState(null);
  const [customers,setCustomers]=useState([]);
  const [custDay,setCustDay]=useState(0);
  const [served,setServed]=useState([]);
  const [selected,setSelected]=useState(null);
  const [travelling,setTravelling]=useState(null);
  const [settlePrompt,setSettlePrompt]=useState(null);
  const [log,setLog]=useState(["The road north is unfamiliar. That is rather the point of it."]);
  const [unsettled,setUnsettled]=useState(0);
  const [siteMem,setSiteMem]=useState({});
  const [wear,setWear]=useState({});
  const [site,setSite]=useState(null);
  const [tw,setTw]=useState(null);      // {pos, fam, walking, note, pending}
  const [inTown,setInTown]=useState(null);   // which town she's currently standing in
  const [room,setRoom]=useState(null);       // {key,pos,walking,note,pending}
  const [ipanel,setIpanel]=useState(null);   // what the room panel is showing
  const [scraps,setScraps]=useState({});      // id -> {sol, knownSlot, attempts:[], solved:bool}
  const [openScrap,setOpenScrap]=useState(null);
  const [foundFirst,setFoundFirst]=useState(false);
  const [bench,setBench]=useState(null);
  const [bonds,setBonds]=useState({});
  const [usedEnc,setUsedEnc]=useState([]);
  const [lastEncDay,setLastEncDay]=useState(-99);
  const [activeEnc,setActiveEnc]=useState(null);
  const [encOutcome,setEncOutcome]=useState(null);
  const [picks,setPicks]=useState([]);
  const [pickSlot,setPickSlot]=useState(null);
  const timer=useRef(null), stepTimer=useRef(null);
  const siteBox=useRef(null);
  const [appActive,setAppActive]=useState(true);
  const [birdFlight,setBirdFlight]=useState(0);   // bumped each time one crosses
  const [front,setFront]=useState(null);          // {kind, until}
  useEffect(()=>{
    const vis=()=>setAppActive(!document.hidden);
    document.addEventListener("visibilitychange",vis);
    return()=>document.removeEventListener("visibilitychange",vis);
  },[]);
  useEffect(()=>{
    if(!homeTown) return;
    if(custDay!==day) rollDayCustomers(day);
  },[day,homeTown,custDay]);
  const season = seasonOf(day);
  useEffect(()=>{
    if(!front || day>=front.until){
      /* she leaves under a full moon and a clear sky — the weather holds for a few days */
      if(day<=3){ setFront({kind:"clear",until:4}); return; }
      const kind=rollWeather(season);
      const len=1+Math.floor(Math.random()*3);      // fronts last one to three days
      setFront({kind,until:day+len});
    }
  },[day,season,front]);
  const weather = front?front.kind:"fair";
  const nightNow=isNight(hour);
  useEffect(()=>{ Sound.setMood(season,nightNow,weather); },[season,nightNow,weather]);
  useEffect(()=>{ if(Sound.ready) Sound.mute(!soundOn||!appActive); },[soundOn,appActive]);
  async function toggleSound(){
    if(!soundOn){
      const ok=await Sound.init();
      if(ok){ Sound.setMood(season,isNight(hour),weather); Sound.mute(false); setSoundOn(true); setSoundErr(null); }
      else setSoundErr(Sound.lastError||"the browser wouldn't start audio");
    } else { Sound.mute(true); setSoundOn(false); }
  }
  const sfx=k=>{ if(soundOn) Sound.play(k); };
  useEffect(()=>{                       // a saved preference still needs a tap to take effect
    if(soundOn&&!Sound.ready){
      const go=async()=>{ const ok=await Sound.init();
        if(ok){ Sound.setMood(season,isNight(hour),weather); Sound.mute(false); }
        window.removeEventListener("pointerdown",go); };
      window.addEventListener("pointerdown",go);
      return()=>window.removeEventListener("pointerdown",go);
    }
  },[soundOn,season,nightNow,weather]);
  const clockRuns = appActive && (screen==="site"||screen==="town"||screen==="townmap"||screen==="room");
  /* one bird crosses now and then, rather than a permanent loop */
  useEffect(()=>{
    if(screen!=="site"||!appActive) return;
    let t1,t2,alive=true;
    const schedule=()=>{
      t1=setTimeout(()=>{
        if(!alive)return;
        setBirdFlight(n=>n+1);
        t2=setTimeout(()=>{ if(alive) setBirdFlight(0); }, 22000);
        schedule();
      }, 45000+Math.random()*60000);
    };
    schedule();
    return()=>{alive=false;clearTimeout(t1);clearTimeout(t2);};
  },[screen,appActive]);
  useEffect(()=>{
    if(!clockRuns) return;
    const step=200;                                  // 200ms of real time
    const id=setInterval(()=>{
      setHour(h=>{
        const nh=h+(step/HOUR_MS);
        if(nh>=24){ setDay(d=>d+1); return nh-24; }
        return nh;
      });
    },step);
    return()=>clearInterval(id);
  },[clockRuns]);
  const [viewSize,setViewSize]=useState({w:360,h:300});
  useEffect(()=>{
    const measure=()=>{ if(!siteBox.current)return;
      const w=siteBox.current.clientWidth;
      setViewSize({w, h:Math.min(SITEH, Math.round(w*0.82))}); };
    measure();
    window.addEventListener("resize",measure);
    const t=setTimeout(measure,60);
    return()=>{window.removeEventListener("resize",measure);clearTimeout(t);};
  },[screen]);

  const trainedOf = p => { const t=skills[p].trained; return t===true?2:(t===false?1:(t||1)); };
  const tierOf = p => { const xp=skills[p].xp, tr=trainedOf(p);
    if (xp>=TIER_NEED[3] && tr>=3) return 3;
    if (xp>=TIER_NEED[2] && tr>=2) return 2;
    return 1; };
  const xpCapOf = p => { const tr=trainedOf(p); return tr>=3 ? Infinity : TIER_NEED[tr+1]; };
  const myTier = tierOf(prof);

  useEffect(()=>{(async()=>{
    try{const r=await window.storage.get(SAVE_KEY);
      if(r?.value){const s=JSON.parse(r.value);
        setProf(s.prof||"herbalism");setSkills(s.skills||skills);
        setPos(s.pos);setSeen(new Set(s.seen));setDay(s.day);setHour(s.hour??7);setStamina(s.stamina);setCoin(s.coin);setRep(s.rep);
        setBag(s.bag);setGoods(s.goods||{});setHomeTown(s.homeTown);setCustomers(s.customers||[]);setCustDay(s.custDay||0);setServed(s.served||[]);setLog(s.log||[]);
        setUnsettled(s.unsettled||0);setSiteMem(s.siteMem||{});setWear(s.wear||{});setScraps(s.scraps||{});setBench(s.bench||null);setFoundFirst(!!s.foundFirst);setInTown(s.inTown||null);setFront(s.front||null);setSoundOn(!!s.soundOn);setBonds(s.bonds||{});setUsedEnc(s.usedEnc||[]);setLastEncDay(s.lastEncDay??-99);
        setScreen((s.screen==="site"||s.screen==="encounter"||s.screen==="townmap"||s.screen==="room")?"map":s.screen);}
    }catch(e){}
    setLoaded(true);
  })();},[]);

  useEffect(()=>{
    if(!loaded||screen==="create")return;
    const s={prof,skills,pos,seen:[...seen],day,hour,stamina,coin,rep,bag,goods,homeTown,customers,custDay,served,log,unsettled,siteMem,wear,scraps,bench,foundFirst,front,soundOn,inTown,bonds,usedEnc,lastEncDay,screen:(screen==="site"||screen==="encounter"||screen==="townmap"||screen==="room")?"map":screen};
    window.storage.set(SAVE_KEY,JSON.stringify(s)).catch(()=>{});
  },[loaded,prof,skills,pos,seen,day,hour,stamina,coin,rep,bag,goods,homeTown,customers,custDay,served,log,unsettled,siteMem,wear,scraps,bench,foundFirst,front,soundOn,inTown,bonds,usedEnc,lastEncDay,screen]);

  const now = day*24 + hour;
  const advance = hrs => {
    let h=hour+hrs, d=day;
    while(h>=24){ h-=24; d+=1; }
    setHour(h); setDay(d);
    return d*24+h;
  };
  const say=t=>setLog(l=>[t,...l].slice(0,6));
  const siteKey=`${pos}:${day}`;
  const wearOf=(hexId)=>{ const w=wear[hexId]; if(!w)return 0;
    const t=w.t ?? (w.day!==undefined ? w.day*24 : 0);
    return Math.max(0, w.v-Math.floor((now-t)/24)); };
  const bumpWear=(hexId)=>setWear(wr=>{ const w=wr[hexId];
    const t=w?(w.t ?? (w.day!==undefined?w.day*24:0)):0;
    const cur=w?Math.max(0,w.v-Math.floor((now-t)/24)):0;
    return {...wr,[hexId]:{v:Math.min(9,cur+1),t:now}}; });
  const addXP=(p,amt)=>setSkills(sk=>{
    const tr=sk[p].trained===true?2:(sk[p].trained===false?1:(sk[p].trained||1));
    const cap=tr>=3?Infinity:TIER_NEED[tr+1];
    return {...sk,[p]:{...sk[p],xp:Math.min(cap,sk[p].xp+amt)}};
  });
  const knownRecipes = Object.values(scraps).filter(s=>s.solved);

  /* ---- travel ---- */
  const route=useMemo(()=>(!selected||selected===pos)?null:findPath(pos,selected,byId,seen),[selected,pos,byId,seen]);
  function revealFrom(id,s){const[c,r]=id.split(",").map(Number);s.add(id);neighbors(c,r).forEach(([nc,nr])=>s.add(`${nc},${nr}`));
    if(byId[id]?.terrain==="hills")neighbors(c,r).forEach(([nc,nr])=>neighbors(nc,nr).forEach(([xc,xr])=>s.add(`${xc},${xr}`)));return s;}
  function tapHex(tile){
    if(selected===tile.id){                    // second tap on the same hex: go
      if(tile.id===pos){ setSelected(null); return; }
      if(tile.terrain==="water"){ setSelected(null); return; }
      const r=findPath(pos,tile.id,byId,seen);
      if(r){ Sound.play("tap"); setTravelling({steps:[...r.path],i:0}); setSelected(null); }
      return;
    }
    Sound.play("tap");
    setSelected(tile.id);
  }
  function beginTravel(){if(!route)return;if(byId[selected]?.terrain==="water")return;setTravelling({steps:[...route.path],i:0});setSelected(null);}
  useEffect(()=>{
    if(!travelling)return;
    if(travelling.i>=travelling.steps.length){setTravelling(null);return;}
    timer.current=setTimeout(()=>{
      const id=travelling.steps[travelling.i],tile=byId[id];
      setPos(id);advance(TERRAIN[tile.terrain].cost);setSeen(prev=>revealFrom(id,new Set(prev)));
      const last=travelling.i===travelling.steps.length-1,place=tile.place?PLACES[tile.place]:null;
      if(place&&place.settle&&!homeTown){say(`You find ${place.label}. ${place.blurb}`);setSettlePrompt(tile.place);}
      else if(place)say(`${place.label}. ${place.blurb}`);
      else if(last)say(`You set down in the ${TERRAIN[tile.terrain].name.toLowerCase()}.`);
      setTravelling(t=>t&&{...t,i:t.i+1});
    },360);
    return()=>clearTimeout(timer.current);
  },[travelling,byId,homeTown]);

  /* ---- site ---- */
  function canAfford(o){
    if(!o.need)return true;
    if(o.need.coin!==undefined&&coin<o.need.coin)return false;
    if(o.need.good&&(goods[o.need.good]||0)<1)return false;
    if(o.need.ing&&(bag[o.need.ing]||0)<1)return false;
    return true;
  }
  function chooseEnc(o){
    const fx=o.fx||{};
    if(fx.coin)setCoin(c=>c+fx.coin);
    if(fx.rep)setRep(r=>Math.max(0,r+fx.rep));
    if(fx.hours)advance(fx.hours);
    if(fx.ing)setBag(b=>{const nb={...b};Object.entries(fx.ing).forEach(([k,n])=>{nb[k]=Math.max(0,(nb[k]||0)+n);});return nb;});
    if(fx.good)setGoods(g=>{const ng={...g};Object.entries(fx.good).forEach(([k,n])=>{ng[k]=Math.max(0,(ng[k]||0)+n);});return ng;});
    if(fx.bond)setBonds(bd=>{const nb={...bd};Object.entries(fx.bond).forEach(([k,n])=>{nb[k]=(nb[k]||0)+n;});return nb;});
    if(fx.scrap)grantScrap(fx.scrap);
    setEncOutcome(o.out);
    say(o.out);
  }
  function rollEncounter(terrain){
    if(day-lastEncDay<3)return null;
    if(Math.random()>=0.05)return null;
    const pool=ENCOUNTERS.filter(e=>!usedEnc.includes(e.id)&&(!e.terrain||e.terrain.includes(terrain)));
    if(!pool.length)return null;
    return pool[Math.floor(Math.random()*pool.length)];
  }
  const townDef = inTown ? TOWNS[inTown] : null;
  const townHereKey = (()=>{ const t=byId[pos];
    return (t&&(t.place==="town"||t.place==="village")) ? t.place : null; })();
  function townSolid(t,x,y){
    if(x<0||y<0||x>=t.w||y>=t.h) return true;
    const ch=t.ground[y][x];
    if(ch==="~"||ch==="T"||ch==="#"||ch==="w") return true;
    return t.buildings.some(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);
  }
  function townPath(t,from,to){
    const prev={},seen=new Set([from]),q=[from];
    while(q.length){
      const cur=q.shift(); if(cur===to) break;
      const [x,y]=cur.split(",").map(Number);
      for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
        const id=`${nx},${ny}`;
        if(seen.has(id)||townSolid(t,nx,ny)) continue;
        seen.add(id); prev[id]=cur; q.push(id);
      }
    }
    if(!seen.has(to)) return null;
    const path=[]; let c=to;
    while(c!==from){ path.unshift(c); c=prev[c]; }
    return path;
  }
  const roomDef = room ? INTERIORS[room.key] : null;
  function roomSolid(r,x,y){
    if(x<0||y<0||x>=r.w||y>=r.h) return true;
    if(r.plan[y][x]==="#") return true;
    return r.objects.some(o=>x>=o.x&&x<o.x+o.w&&y>=o.y&&y<o.y+o.h);
  }
  function roomPath(r,from,to){
    const prev={},seen=new Set([from]),q=[from];
    while(q.length){
      const cur=q.shift(); if(cur===to) break;
      const [x,y]=cur.split(",").map(Number);
      for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
        const id=`${nx},${ny}`;
        if(seen.has(id)||roomSolid(r,nx,ny)) continue;
        seen.add(id); prev[id]=cur; q.push(id);
      }
    }
    if(!seen.has(to)) return null;
    const path=[]; let c=to;
    while(c!==from){ path.unshift(c); c=prev[c]; }
    return path;
  }
  function openRoom(key){
    const r=INTERIORS[key]; if(!r) return;
    sfx("page");
    setRoom({key,pos:`${r.entry[0]},${r.entry[1]}`,walking:null,note:null,pending:null});
    setIpanel(null);
    setScreen("room");
  }
  function tapRoom(x,y){
    const r=roomDef; if(!r||!room||room.walking) return;
    const id=`${x},${y}`;
    if(r.exit&&x===r.exit.x&&y===r.exit.y){ leaveRoom(); return; }
    if(id===room.pos) return;
    let dest=id, act=null;
    const o=r.objects.find(o=>x>=o.x&&x<o.x+o.w&&y>=o.y&&y<o.y+o.h);
    if(o){ if(!o.stand) return; dest=`${o.stand[0]},${o.stand[1]}`; act={kind:"obj",id:o.id}; }
    else if(r.npc&&r.npc.at[0]===x&&r.npc.at[1]===y){
      const adj=[[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(([a,b])=>!roomSolid(r,a,b));
      if(!adj.length) return;
      dest=`${adj[0][0]},${adj[0][1]}`; act={kind:"npc"};
    } else if(roomSolid(r,x,y)) return;
    const path=roomPath(r,room.pos,dest);
    if(!path) return;
    setRoom(w=>({...w,walking:{steps:path,i:0},pending:act,note:null}));
    setIpanel(null);
  }
  function leaveRoom(){
    const r=roomDef; if(!r) return;
    if(r.exit.to==="townmap"){ setRoom(null); setIpanel(null); setScreen("townmap"); }
    else openRoom(r.exit.to);
  }
  function resolveRoom(act){
    const r=roomDef; if(!r) return;
    if(act.kind==="npc"){
      sfx("tap");
      setRoom(w=>w&&({...w,note:`${r.npc.name}\n"${r.npc.line}"`}));
      return;
    }
    const o=r.objects.find(x=>x.id===act.id); if(!o) return;
    const a=o.act||"";
    if(a.startsWith("go:")){ openRoom(a.slice(3)); return; }
    if(a.startsWith("look:")){ setRoom(w=>w&&({...w,note:a.slice(5)})); return; }
    if(a==="bench"){ sfx("page"); setScreen("workshop"); return; }
    if(a==="counter"||a==="make"||a==="satchel"||a==="bed"){ setIpanel(a); setRoom(w=>w&&({...w,note:null})); return; }
    setRoom(w=>w&&({...w,note:o.label}));
  }
  useEffect(()=>{
    if(!room?.walking||!roomDef) return;
    if(room.walking.i>=room.walking.steps.length){
      const act=room.pending;
      setRoom(w=>w&&({...w,walking:null,pending:null}));
      if(act) resolveRoom(act);
      return;
    }
    const id=setTimeout(()=>{
      setRoom(w=>{
        if(!w?.walking) return w;
        const step=w.walking.steps[w.walking.i];
        if(w.walking.i%2===0) sfx("step");
        return {...w,pos:step,walking:{...w.walking,i:w.walking.i+1}};
      });
    },140);
    return()=>clearTimeout(id);
  },[room,roomDef]);

  function enterTown(key){
    const k=key||townHereKey; if(!k||!TOWNS[k]) return;
    const t=TOWNS[k];
    const e=`${t.entry[0]},${t.entry[1]}`;
    setInTown(k);
    setTw({pos:e,fam:e,walking:null,note:null,pending:null});
    setScreen("townmap");
  }
  function tapTown(x,y){
    const t=townDef; if(!t||!tw||tw.walking) return;
    const id=`${x},${y}`;
    if(id===tw.pos) return;
    let dest=id, action=null;
    if(townSolid(t,x,y)){
      const b=t.buildings.find(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);
      if(!b) return;
      dest=`${b.door[0]},${b.door[1]}`; action={kind:"building",id:b.id};
      if(townSolid(t,b.door[0],b.door[1])) return;
    } else {
      const folk=(TOWNSFOLK[inTown]||[]).find(n=>{
        const p=npcAt(n,hour); return p&&p[0]===x&&p[1]===y; });
      if(folk) action={kind:"npc",name:folk.name};
    }
    const path=townPath(t,tw.pos,dest);
    if(!path) return;
    setTw(w=>({...w,walking:{steps:path,i:0},pending:action,note:null}));
  }
  function enterSite(){
    const tile=byId[pos],mem=siteMem[siteKey];

    const gen=genSite(pos,day,tile.terrain,tile.place,wearOf(pos),hour);
    const taken=mem?.taken||{},revealed=new Set(mem?.revealed||[]);
    gen.cells.forEach(c=>{
      if(c.node&&taken[c.id]!==undefined){
        const rec=taken[c.id];
        const left = (typeof rec==="object") ? rec.left : rec;
        const win  = (typeof rec==="object") ? rec.win  : null;
        const cur  = windowOf(c.node.ing, day, hour);
        if(win===null || win===cur){                 // same window — still picked over
          if(left<=0){ c.node=null; c.blocked=false; } else c.node.picks=left;
        }                                            // different window — it has come back
      }
      if(c.hidden&&revealed.has(c.id))c.hidden=false;
      if((c.curio||c.greed)&&taken[c.id]===0){c.curio=null;c.greed=null;c.blocked=false;}
    });
    if(!mem){setSiteMem(m=>({...m,[siteKey]:{taken:{},revealed:[]}}));}
    setSite({cells:gen.cells,def:gen.def,art:gen.art,perm:gen.perm,worn:gen.worn,season:gen.season,worker:gen.worker,player:gen.entry,fam:famSpotFor(gen.entry,gen.cells),walking:null,pending:null,note:null,terrain:tile.terrain});
    if(!mem){
      const e=rollEncounter(tile.terrain);
      if(e){ setActiveEnc(e); setEncOutcome(null); setUsedEnc(u=>[...u,e.id]); setLastEncDay(day); setScreen("encounter"); return; }
    }
    if(gen.worn>=6) say("The ground here is picked over. You've been leaning on this place.");
    else if(gen.worn>=3) say("This ground has seen you lately. It's thinner than it was.");
    setScreen("site");
  }
  const isMine = n => n && n.prof===prof;
  function famTarget(cells){
    const good=cells.filter(c=>(c.hidden&&isMine(c.node))||c.curio||c.greed);
    return good.length?good[0].id:null;
  }
  function stepToward(fromId,toId,cells){
    const p=sitePath(fromId,toId,cells);
    if(!p||!p.length)return fromId;
    const next=p[0];const[x,y]=next.split(",").map(Number);
    return cells[y*SW+x].blocked?fromId:next;
  }
  function famSpotFor(playerId,cells,current){
    const[x,y]=playerId.split(",").map(Number);
    const opts=[[x-1,y],[x+1,y],[x,y+1],[x,y-1]]
      .filter(([a,b])=>a>=0&&b>=0&&a<SW&&b<SH&&!cells[b*SW+a].blocked)
      .map(([a,b])=>`${a},${b}`);
    if(!opts.length)return playerId;
    if(!current)return opts[0];
    const[cx,cy]=current.split(",").map(Number);
    let best=opts[0],bd=Infinity;
    opts.forEach(o=>{const[a,b]=o.split(",").map(Number);
      const d=Math.abs(a-cx)+Math.abs(b-cy); if(d<bd){bd=d;best=o;}});
    return best;
  }
  function tapSiteTile(cell){
    if(!site||site.walking)return;
    const target=cell.id;
    if(target===site.player)return;
    let dest=target,action=null;
    if(site.worker&&site.worker.at===target){
      const [wx,wy]=target.split(",").map(Number);
      const adj=[[wx+1,wy],[wx-1,wy],[wx,wy+1],[wx,wy-1]]
        .filter(([a,b])=>a>=0&&b>=0&&a<SW&&b<SH&&!site.cells[b*SW+a].blocked)
        .map(([a,b])=>`${a},${b}`);
      let best=null,bl=Infinity;
      adj.forEach(id=>{const p=sitePath(site.player,id,site.cells);if(p&&p.length<bl){bl=p.length;best=id;}});
      if(best){ const path=sitePath(site.player,best,site.cells);
        if(path){ setSite(s2=>({...s2,walking:{steps:path,i:0},pending:"__greet",note:null})); return; } }
      greet(); return;
    }
    if(cell.blocked){
      const interactive = isMine(cell.node)||cell.curio||cell.greed||cell.landmark;
      if(!interactive)return;
      const[x,y]=target.split(",").map(Number);
      const adj=[[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(([ax,ay])=>ax>=0&&ay>=0&&ax<SW&&ay<SH).map(([ax,ay])=>`${ax},${ay}`)
        .filter(id=>{const[cx,cy]=id.split(",").map(Number);return !site.cells[cy*SW+cx].blocked;});
      if(!adj.length)return;
      let best=null,bl=Infinity;
      adj.forEach(id=>{const p=sitePath(site.player,id,site.cells);if(p&&p.length<bl){bl=p.length;best=id;}});
      if(!best)return;
      dest=best;action=target;
    }
    const path=sitePath(site.player,dest,site.cells);
    if(!path)return;
    setSite(s=>({...s,walking:{steps:path,i:0},pending:action,note:null}));
  }
  useEffect(()=>{
    if(!site?.walking)return;
    if(site.walking.i>=site.walking.steps.length){
      const act=site.pending;
      setSite(s=>s&&({...s,walking:null,pending:null}));
      if(act==="__greet") greet(); else if(act) doHarvest(act);
      return;
    }
    stepTimer.current=setTimeout(()=>{
      const s=site; if(!s?.walking)return;
      const id=s.walking.steps[s.walking.i];
      if(s.walking.i%2===0) sfx("step");
      const cells=s.cells.map(c=>({...c}));
      const[px,py]=id.split(",").map(Number);
      const newly=[];
      cells.forEach(c=>{ if(c.hidden){const[cx,cy]=c.id.split(",").map(Number);
        if(Math.abs(cx-px)<=1&&Math.abs(cy-py)<=1){c.hidden=false;newly.push(c.id);}}});
      if(newly.length)setSiteMem(m=>{const p=m[siteKey]||{taken:{},revealed:[]};return{...m,[siteKey]:{...p,revealed:[...(p.revealed||[]),...newly]}};});
      const tgt=famTarget(cells);
      const famNext=tgt?stepToward(s.fam,tgt,cells):famSpotFor(id,cells,s.fam);
      setSite(cur=>cur&&({...cur,cells,player:id,fam:famNext,walking:cur.walking?{...cur.walking,i:cur.walking.i+1}:null,
        note:newly.length?"Something in the undergrowth catches your eye.":cur.note}));
    },150);
    return()=>clearTimeout(stepTimer.current);
  },[site,siteKey,prof]);

  useEffect(()=>{
    if(!tw?.walking||!townDef) return;
    if(tw.walking.i>=tw.walking.steps.length){
      const act=tw.pending;
      setTw(w=>w&&({...w,walking:null,pending:null}));
      if(act) resolveTown(act);
      return;
    }
    const id=setTimeout(()=>{
      setTw(w=>{
        if(!w?.walking) return w;
        const step=w.walking.steps[w.walking.i];
        if(w.walking.i%2===0) sfx("step");
        const [x,y]=step.split(",").map(Number);
        const opts=[[x-1,y],[x+1,y],[x,y+1],[x,y-1]]
          .filter(([a,b])=>!townSolid(townDef,a,b)).map(([a,b])=>`${a},${b}`);
        const fam=opts.length?opts[0]:w.fam;
        return {...w,pos:step,fam,walking:{...w.walking,i:w.walking.i+1}};
      });
    },150);
    return()=>clearTimeout(id);
  },[tw,townDef]);

  function resolveTown(act){
    if(act.kind==="npc"){
      const n=(TOWNSFOLK[inTown]||[]).find(x=>x.name===act.name);
      if(n){ sfx("tap"); setTw(w=>w&&({...w,note:`${n.name}${n.role?" · "+n.role:""}\n"${n.line}"`})); }
      return;
    }
    const b=townDef.buildings.find(x=>x.id===act.id);
    if(!b) return;
    if(b.enter==="shop"){
      if(homeTown&&inTown===homeTown.key){ openRoom("shop"); return; }
      setTw(w=>w&&({...w,note:"An empty shopfront, shutters closed. A card in the window gives a name — Ivo Marchant — and says enquiries welcome."}));
      return;
    }
    if(b.enter==="store"){ openRoom("store"); return; }
    if(b.enter==="furniture"){ openRoom("furniture"); return; }
    if(b.enter==="chapel"){ openRoom("chapel"); return; }
    setTw(w=>w&&({...w,note:`${b.name}. The door is shut.`}));
  }

  function greet(){
    const w=site&&site.worker; if(!w) return;
    sfx("tap");
    const line=w.lines[Math.floor(Math.random()*w.lines.length)];
    setSite(s2=>s2&&({...s2,note:`${w.name}${w.role?" · "+w.role:""}\n"${line}"`}));
  }
  function doHarvest(id){
    if(!site)return;
    const cells=site.cells.map(c=>({...c,node:c.node?{...c.node}:null}));
    const c=cells.find(x=>x.id===id); if(!c)return;
    let note=null; const gained={}; let gainedCoin=0; let takenLeft=null; let harvestWin=null;

    if(c.node){
      if(c.node.prof!==prof) return;
      const ing=c.node.ing, nodeTier=c.node.tier;
      harvestWin = windowOf(ing, day, hour);
      if(!ingInSeason(ing,day)){
        note=`${ING[ing].name} — not at this time of year.`;
        setSite(s2=>s2&&({...s2,note}));
        return;
      }
      if(!ingOpen(ing,hour)){
        const w=ING[ing].when;
        note = w==="night"
          ? `${ING[ing].name} — shut tight against the sun. Come back after dark.`
          : `${ING[ing].name} — no use cut in the dark. It wants daylight.`;
        sfx("fail"); setSite(s2=>s2&&({...s2,note}));
        return;
      }
      if(nodeTier<=myTier && stamina<1){
        note=`You could pick it, but your hands have had enough for one day.`;
        setSite(s2=>s2&&({...s2,note}));
        return;
      }
      if(nodeTier>myTier){
        note=`${ING[ing].name} — you turn it over and put it back. You can't make sense of this one yet.`;
        say(`${ING[ing].name}. Not yet — you don't know it well enough.`); sfx("fail");
        setSite(s2=>s2&&({...s2,note}));
        return;                                   // no harvest, no learning, and it stays where it grew
      } else {
        setStamina(v=>v-1); sfx("gather");
        const left=c.node.picks-1;
        gained[ing]=1; note=`${ING[ing].name} — gathered cleanly.`;
        addXP(prof,0.25); bumpWear(pos);          // four clean harvests make a point
        if(left<=0){c.node=null;c.blocked=false;c.deco=site.def.scatter[0];takenLeft=0;}
        else{c.node.picks=left;takenLeft=left;}
      }
    } else if(c.curio){
      const cu=c.curio; note=`${cu.name}. ${cu.text}`;
      if(cu.gift?.coin)gainedCoin+=cu.gift.coin;
      if(cu.gift?.ing)gained[cu.gift.ing]=(gained[cu.gift.ing]||0)+1;
      c.curio=null;c.blocked=false;takenLeft=0; say(cu.text);
    } else if(c.landmark==="perm"&&c.perm){
      setSite(s2=>s2&&({...s2,note:`${c.perm.name}. ${c.perm.note}`}));
      say(`${c.perm.name}. ${c.perm.note}`);
      return;
    } else if(c.landmark){
      const pl=PLACES[c.landmark];
      setSite(s2=>s2&&({...s2,note:`${pl.label}. ${pl.blurb}`}));
      say(`${pl.label}. ${pl.blurb}`);
      return;
    } else if(c.greed){
      const kind=c.greed;
      (kind==="nest"?["heartroot","inkcap"]:["moonbell","lavender"]).forEach(g=>{gained[g]=(gained[g]||0)+1;});
      const got=Object.keys(gained).map(k=>ING[k].name).join(" and ");
      note=(kind==="nest"?"You take what's in the nest — "+got+". The parent birds circle, calling, and do not come down."
                         :"You take the offerings from the shrine — "+got+". The candle gutters as you turn away.")
           +" (−2 reputation, and three poor nights.)";
      say(kind==="nest"?"You robbed a nest. It sits badly with you.":"You took from a shrine. Somebody left those for a reason.");
      setRep(r=>Math.max(0,r-2)); setUnsettled(3);
      c.greed=null;c.blocked=false;takenLeft=0;
    } else return;

    const keys=Object.keys(gained);
    if(keys.length)setBag(b=>{const nb={...b};keys.forEach(k=>{nb[k]=(nb[k]||0)+gained[k];});return nb;});
    if(gainedCoin)setCoin(v=>v+gainedCoin);
    if(takenLeft!==null)setSiteMem(m=>{const p=m[siteKey]||{taken:{},revealed:[]};
      const win = harvestWin;
      return{...m,[siteKey]:{...p,taken:{...(p.taken||{}),[id]:{left:takenLeft,win}}}};});
    setSite(s=>s&&({...s,cells,note}));
  }
  function leaveSite(){setSite(null);setScreen("map");}

  /* ---- town ---- */
  function grantScrap(id){
    if(scraps[id])return;
    const sc=SCRAPS[id]; const {sol,knownSlot}=makeSolution(sc);
    setScraps(s=>({...s,[id]:{id,sol,knownSlot,attempts:[],solved:false}}));
    say(sc.found);
  }
  function settle(placeKey){
    setHomeTown({key:placeKey,tile:pos});setSettlePrompt(null);
    const t=TOWNS[placeKey];const e=`${t.entry[0]},${t.entry[1]}`;
    setInTown(placeKey);
    setTw({pos:e,fam:e,walking:null,note:null,pending:null});setScreen("townmap");
    say(`You take the empty shopfront at ${PLACES[placeKey].label}. It smells of dust and old rope.`);
  }
  function customerCount(){
    let n=1;
    if(rep>=10)n++; if(rep>=25)n++; if(rep>=45)n++;
    return n;
  }
  function rollDayCustomers(forDay){
    const known=Object.values(scraps).filter(x=>x.solved);
    const n=customerCount();
    const picked=[]; const used=new Set();
    for(let i=0;i<n;i++){
      let person=CUSTOMERS[Math.floor(Math.random()*CUSTOMERS.length)];
      let guard=0;
      while(used.has(person.name)&&guard++<12) person=CUSTOMERS[Math.floor(Math.random()*CUSTOMERS.length)];
      used.add(person.name);
      const bonus=Math.max(0,bonds[person.name]||0)*2;
      const arrive=8+Math.random()*9;                 // somewhere between 8am and 5pm
      const stay=2+Math.random()*2;                   // 2 to 4 hours
      let c;
      if(known.length&&Math.random()<0.55){
        const k=known[Math.floor(Math.random()*known.length)], sc=SCRAPS[k.id];
        c={person,kind:"good",id:sc.id,name:sc.name,pay:sc.value+bonus+Math.floor(Math.random()*6)};
      }else{
        const ing=TIER1[Math.floor(Math.random()*TIER1.length)];
        c={person,kind:"ing",id:ing,name:ING[ing].name,pay:5+bonus+Math.floor(Math.random()*4)};
      }
      const stormy = front && (front.kind==="storm");
      if(stormy && Math.random()<0.5) continue;      // some stay home in weather like this
      picked.push({...c,from:forDay*24+arrive,to:forDay*24+arrive+stay});
    }
    setCustomers(picked); setCustDay(forDay); setServed([]);
  }
  function craftKnown(scrapState){
    const sc=SCRAPS[scrapState.id];
    if(bench){say("The bench is already occupied.");return;}
    if(stamina<1){say("You've not the hands left for careful work today.");return;}
    const need={}; scrapState.sol.forEach(i=>need[i]=(need[i]||0)+1);
    const short=Object.entries(need).filter(([k,n])=>(bag[k]||0)<n)
      .map(([k,n])=>`${ING[k]?ING[k].name:k} (need ${n}, have ${bag[k]||0})`);
    if(short.length){say(`Not enough for a ${sc.name}: ${short.join(", ")}.`);return;}
    setBag(b=>{const nb={...b};Object.entries(need).forEach(([k,n])=>{nb[k]-=n;});return nb;});
    setStamina(v=>Math.max(0,v-1));
    setBench({kind:"craft",scrapId:sc.id,readyAt:now+1,hrs:1});
    say(`You set a ${sc.name} to work. An hour, near enough.`);
  }
  function collectCraft(){
    if(!bench||bench.kind!=="craft"||now<bench.readyAt)return;
    const sc=SCRAPS[bench.scrapId];
    setGoods(g=>({...g,[sc.id]:(g[sc.id]||0)+1}));
    say(`The ${sc.name} is done and bottled.`); sfx("done");
    setBench(null);
  }
  function serve(c){
    if(!c)return;
    const have=c.kind==="good"?(goods[c.id]||0):(bag[c.id]||0);
    if(have<1)return;
    if(c.kind==="good")setGoods(g=>({...g,[c.id]:g[c.id]-1}));
    else setBag(b=>({...b,[c.id]:b[c.id]-1}));
    setCoin(v=>v+c.pay);setRep(r=>r+1); sfx("coin");
    setServed(sv=>[...sv,c.person.name]);
    say(`${c.person.name} takes the ${c.name} and pays ${c.pay} coin.`);
  }
  const atOwnBed = homeTown && pos===homeTown.tile;
  const sleepRate = () => atOwnBed ? (unsettled>0?0.75:1) : (unsettled>0?0.6:0.833);
  const sleepGain = hrs => Math.min(MAXSTAM-stamina, Math.max(0,Math.round(hrs*sleepRate())));
  function sleep(hrs){
    const gain=sleepGain(hrs);
    setStamina(v=>Math.min(MAXSTAM,v+gain));
    advance(hrs);
    if(unsettled>0){ setUnsettled(u=>u-1); say(`Thin dreams, and you wake tired. ${gain} back.`); }
    else if(atOwnBed) say(`You sleep in your own bed. ${gain} back.`);
    else say(`You make camp and sleep rough. ${gain} back.`);
    setSite(null);
    if(screen==="site") setScreen("map");
  }
  function trainUp(){
    const cost=60;
    if(coin<cost)return;
    setCoin(c=>c-cost);
    setSkills(sk=>{const tr=sk[prof].trained===true?2:(sk[prof].trained===false?1:(sk[prof].trained||1));return {...sk,[prof]:{...sk[prof],trained:Math.max(2,tr+1)}};});
    say("The herb-woman walks you through it, twice, and makes you do it a third time yourself. Something settles into place.");
    grantScrap("tincture");
  }
  function startWorking(full){
    const st=scraps[openScrap], sc=SCRAPS[openScrap];
    if(!st||bench)return;
    if(stamina<1){say("You've not the hands left for careful work today.");return;}
    const need={}; full.forEach(i=>need[i]=(need[i]||0)+1);
    const short=Object.entries(need).filter(([k,n])=>(bag[k]||0)<n)
      .map(([k,n])=>`${ING[k]?ING[k].name:k} (need ${n}, have ${bag[k]||0})`);
    if(short.length){say(`You haven't the makings: ${short.join(", ")}.`);return;}
    const {exact,present}=score(full,st.sol);
    setBag(b=>{const nb={...b};Object.entries(need).forEach(([k,n])=>{nb[k]-=n;});return nb;});
    const hrs = sc.repeats ? 10 : 6;
    setStamina(v=>Math.max(0,v-1));
    setBench({kind:"research",scrapId:openScrap,picks:full,exact,present,readyAt:now+hrs,hrs});
    setPicks(Array(sc.slots).fill(null)); setPickSlot(null);
    say(`You set the ${sc.name} to work and leave it be. It'll want a day.`);
  }
  function collectBench(){
    if(!bench||now<bench.readyAt||bench.kind!=="research")return;
    const sc=SCRAPS[bench.scrapId];
    const solvedNow=bench.exact===sc.slots;
    setScraps(s=>({...s,[bench.scrapId]:{...s[bench.scrapId],
      attempts:[{picks:bench.picks,exact:bench.exact,present:bench.present},...s[bench.scrapId].attempts],
      solved:solvedNow||s[bench.scrapId].solved}}));
    sfx("done");
    say(solvedNow?`You crack it. ${sc.name} is yours.`:feedbackText(bench.exact,bench.present,sc.slots,bench.picks,scraps[bench.scrapId].sol,sc.repeats,scraps[bench.scrapId].attempts.length));
    if(solvedNow) setRep(r=>r+2);
    setBench(null);
  }

  async function reset(){try{await window.storage.delete(SAVE_KEY);}catch(e){}window.location.reload();}

  /* ============ RENDER ============ */
  if(!loaded)return <div style={{background:C.bg,minHeight:"100vh",color:C.faint,padding:40,fontFamily:"Georgia,serif"}}>Lighting the lamp…</div>;
  const wrap={minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Iowan Old Style','Palatino Linotype',Georgia,serif",padding:"14px 12px 28px",boxSizing:"border-box"};

  if(screen==="create"){
    return(<div style={wrap}>
      <div style={{textAlign:"center",padding:"44px 0 26px"}}>
        <svg viewBox="-30 -30 60 60" style={{width:88,height:88}}><g transform="scale(1.25)">{WITCH}</g></svg>
        <div style={{fontSize:10,letterSpacing:5,color:C.violet,textTransform:"uppercase",marginTop:12}}>A Cozy Witch Game</div>
        <h1 style={{fontSize:31,fontWeight:"normal",margin:"8px 0 0",color:"#f0e6c8"}}>Somewhere To Land</h1>
      </div>

      <Panel style={{marginBottom:14}}>
        <div style={{fontSize:14,color:C.dim,lineHeight:1.85}}>
          Éri Linnet is seventeen, which is the age a witch leaves.
          <br/><br/>
          Her mother keeps the garden and knows every plant on the hill by name, and has taught her
          most of them. Her father keeps the rest of the farm. It is a good farm. Staying would have
          been the waste.
          <br/><br/>
          She has a broom, a bag with too many pockets, a blank tome off her mother's shelf that she
          did not exactly ask for — and Lazlo, who has opinions.
        </div>
      </Panel>

      <Panel style={{marginBottom:14}}>
        <div style={{fontSize:10,letterSpacing:3,color:"#8f7bb0",textTransform:"uppercase",marginBottom:8}}>Tonight</div>
        <div style={{fontSize:13.5,color:C.faint,lineHeight:1.7,fontStyle:"italic"}}>
          The moon is full. Spring, the first day of it. Somewhere out past the hill there is a town
          that hasn't got a witch, and she means to find it.
        </div>
      </Panel>

      <Panel style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div>
            <div style={{fontSize:14,color:C.text}}>Sound</div>
            <div style={{fontSize:12,color:C.faint,marginTop:2}}>Music and small noises. You can turn it off any time.</div>
          </div>
          <button onClick={toggleSound} style={{padding:"9px 14px",borderRadius:8,fontSize:13,fontFamily:"inherit",
            cursor:"pointer",background:soundOn?"#33284a":"#1b1626",color:soundOn?C.gold:C.faint,
            border:`1px solid ${soundOn?C.violet:"#2e2740"}`,whiteSpace:"nowrap"}}>
            {soundOn?"On":"Off"}
          </button>
        </div>
        {soundErr&&<div style={{fontSize:11.5,color:"#d8a0a8",marginTop:9,lineHeight:1.5}}>
          Sound didn't start: {soundErr}
        </div>}
      </Panel>

      <Btn tone="gold" onClick={()=>{setScreen("map");say("You lift off from the garden gate. Lazlo shifts inside your coat and tells you your grip is wrong.");}}>
        Leave home
      </Btn>
      <div style={{textAlign:"center",marginTop:16}}>
        <button onClick={reset} style={{background:"none",border:"none",color:"#4a4060",fontSize:11,fontFamily:"inherit",cursor:"pointer",letterSpacing:1}}>start over</button>
      </div>
    </div>);
  }

  const L=lightAt(hour,{moon:moonLit(day),weather});
  const StatusBar=()=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.panel,border:`1px solid ${C.line}`,borderRadius:10,padding:"9px 14px",marginBottom:12,gap:8}}>
      <div onClick={()=>setShowClock(v=>!v)} style={{cursor:"pointer",minWidth:76}}>
        <div style={{fontSize:9,letterSpacing:2,color:"#8f7bb0",textTransform:"uppercase"}}>
          {SEASONS[season]} {dayOfMonth(day)}
        </div>
        <div style={{fontSize:15,color:isNight(hour)?"#b9c4e8":C.text}}>
          {showClock?clockLabel(hour):phaseLabel(hour)}
        </div>
        <div style={{fontSize:10,color:C.faint,marginTop:1}}>
          {showClock?`${moonName(day)} · yr ${yearOf(day)}`:(WEATHER[weather]||{}).name}
        </div>
      </div>
      <div style={{flexShrink:0,border:`1px solid ${C.line}`,borderRadius:6,overflow:"hidden",lineHeight:0}}>
        <SkyStrip h={hour} day={day} weather={weather}/>
      </div>
      <div style={{textAlign:"center",flex:1}}>
        <div style={{fontSize:9,letterSpacing:2,color:"#8f7bb0",textTransform:"uppercase"}}>Stamina</div>
        <div style={{fontSize:15}}>{"◆".repeat(Math.max(0,Math.round(stamina)))}<span style={{color:C.line}}>{"◇".repeat(Math.max(0,MAXSTAM-Math.round(stamina)))}</span></div>
      </div>
      <div style={{textAlign:"right",minWidth:64}}>
        <div style={{fontSize:9,letterSpacing:2,color:"#8f7bb0",textTransform:"uppercase"}}>Coin · Rep</div>
        <div style={{fontSize:16,color:C.gold}}>{coin} · {rep}</div>
      </div>
      <div onClick={toggleSound} style={{cursor:"pointer",padding:"4px 2px",flexShrink:0}}>
        <svg viewBox="0 0 20 20" style={{width:18,height:18,display:"block"}}>
          <path d="M3,8 L6,8 L10,4 L10,16 L6,12 L3,12 Z" fill={soundOn?C.gold:"#4a4060"}/>
          {soundOn
            ? <><path d="M12.5,7 q2.2,3 0,6" stroke={C.gold} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                <path d="M15,5.2 q3.6,4.8 0,9.6" stroke={C.gold} strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7"/></>
            : <path d="M12.5,7 L17,13 M17,7 L12.5,13" stroke="#4a4060" strokeWidth="1.4" strokeLinecap="round"/>}
        </svg>
      </div>
    </div>);
  const Journal=()=>(
    <div style={{background:C.panel2,border:"1px solid #2e2740",borderRadius:10,padding:"12px 14px",marginTop:12}}>
      <Label>Journal</Label>
      {log.map((line,i)=>(<div key={i} style={{fontSize:13,lineHeight:1.6,color:i===0?"#c9bcda":"#6f6288",marginBottom:6,fontStyle:i===0?"normal":"italic"}}>{line}</div>))}
    </div>);

  /* ---- ENCOUNTER ---- */
  if(screen==="encounter"&&activeEnc){
    const e=activeEnc;
    return(<div style={wrap}>
      <StatusBar/>
      <div style={{textAlign:"center",margin:"18px 0 14px"}}>
        <div style={{fontSize:10,letterSpacing:5,color:C.violet,textTransform:"uppercase"}}>Something happens</div>
        <div style={{fontSize:23,color:"#f0e6c8",marginTop:6}}>{e.title}</div>
      </div>
      <Panel style={{marginBottom:12}}>
        <div style={{fontSize:14,color:C.dim,lineHeight:1.75}}>{e.text}</div>
      </Panel>
      {!encOutcome?(
        <div>
          {e.options.map((o,i)=>{const ok=canAfford(o);
            return(<div key={i} style={{marginBottom:9}}>
              <Btn disabled={!ok} onClick={()=>chooseEnc(o)}>{o.label}{!ok?" — you can't":""}</Btn>
            </div>);})}
        </div>
      ):(
        <>
          <Panel style={{marginBottom:12,borderColor:C.gold}}>
            <div style={{fontSize:14,color:C.text,lineHeight:1.75}}>{encOutcome}</div>
          </Panel>
          <Btn tone="gold" onClick={()=>{setActiveEnc(null);setEncOutcome(null);setScreen("site");}}>Get on with the day</Btn>
        </>
      )}
      <Journal/>
    </div>);
  }

  /* ---- A ROOM ---- */
  if(screen==="room"&&room&&roomDef){
    const r=roomDef;
    const RW=r.w*T, RH=r.h*T;
    const [px,py]=room.pos.split(",").map(Number);
    const vw=viewSize.w, vh=Math.min(RH+2, viewSize.h);
    const camX=Math.min(Math.max(0,RW-vw),Math.max(0,px*T+T/2-vw/2));
    const camY=Math.min(Math.max(0,RH-vh),Math.max(0,py*T+T/2-vh/2));
    const boards=r.floor==="stone";
    const lamp=isNight(hour)?0.34:0.10;
    const mine=homeTown&&inTown===homeTown.key;
    const here=customers.filter(c=>now>=c.from&&now<c.to&&!served.includes(c.person.name));
    const bagList=Object.entries(bag).filter(([k,n])=>n>0&&ING[k]);
    const goodsList=Object.entries(goods).filter(([,n])=>n>0);
    const knownRecipes2=Object.values(scraps).filter(x=>x.solved);
    return(<div style={wrap}>
      <StatusBar/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,padding:"0 2px"}}>
        <div style={{fontSize:16,color:C.text}}>{r.name}</div>
        {r.npc&&<div style={{fontSize:11.5,color:C.faint,fontStyle:"italic"}}>{r.npc.name} is in</div>}
        {!r.npc&&here.length>0&&room.key==="shop"&&<div style={{fontSize:11.5,color:C.gold,fontStyle:"italic"}}>someone at the counter</div>}
      </div>
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden",marginBottom:10}}>
        <div ref={siteBox} style={{position:"relative",width:"100%",height:vh,overflow:"hidden",background:"#2a2130"}}>
          <div style={{position:"absolute",width:RW,height:RH,
            transform:`translate(${-camX}px, ${-camY}px)`,transition:"transform 0.16s linear"}}>
            <svg width={RW} height={RH} viewBox={`0 0 ${RW} ${RH}`} style={{display:"block"}}>
              {r.plan.map((row,y)=>row.split("").map((ch,x)=>{
                const alt=((x*7)^(y*13))%2===0;
                const wall=ch==="#";
                return <rect key={`f${x},${y}`} x={x*T} y={y*T} width={T} height={T}
                  fill={wall?"#3b3040":boards?(alt?"#8e8578":"#948b7e"):(alt?"#7a5f42":"#82663f")}/>;
              }))}
              {!boards&&r.plan.map((row,y)=>row.split("").map((ch,x)=>ch==="#"?null:(
                <path key={`p${x},${y}`} d={`M${x*T},${y*T+T} L${x*T+T},${y*T+T}`} stroke="#6b5236" strokeWidth="1" opacity="0.5"/>)))}
              {r.exit&&(<g transform={`translate(${r.exit.x*T},${r.exit.y*T})`} onClick={leaveRoom} style={{cursor:"pointer"}}>
                <rect x="0" y="0" width={T} height={T} fill="#3b3040"/>
                <rect x="7" y="6" width={T-14} height={T-6} rx="3" fill="#5a4430"/>
                <circle cx={T-16} cy={T*0.6} r="2" fill="#c9a86a"/>
                <text x={T/2} y={T-4} textAnchor="middle" fontSize="8" fill="#c9bcda" fontFamily="Georgia,serif">out</text>
              </g>)}
              {r.objects.map(o=>(
                <g key={o.id} transform={`translate(${o.x*T},${o.y*T})`}
                   onClick={()=>tapRoom(o.x,o.y)} style={{cursor:"pointer"}}>
                  <Furniture o={o} T={T}/>
                </g>))}
              {r.npc&&(
                <g transform={`translate(${r.npc.at[0]*T+T/2},${r.npc.at[1]*T+T/2})`}
                   onClick={()=>tapRoom(r.npc.at[0],r.npc.at[1])} style={{cursor:"pointer"}}>
                  {NPC_SPRITE(r.npc.hue)}
                </g>)}
              {r.plan.map((row,y)=>row.split("").map((ch,x)=>(
                <rect key={`t${x},${y}`} x={x*T} y={y*T} width={T} height={T} fill="transparent"
                  onClick={()=>tapRoom(x,y)} style={{cursor:"pointer"}}/>)))}
              <rect x="0" y="0" width={RW} height={RH} fill="#1a1428" opacity={lamp} style={{pointerEvents:"none"}}/>
              <g transform={`translate(${px*T+T/2},${py*T+T/2+2}) scale(0.86)`}>{WITCH}</g>
            </svg>
          </div>
        </div>
      </div>

      {/* what she's standing at */}
      {ipanel==="counter"&&(
        <Panel style={{marginBottom:10}}>
          <Label>At the counter</Label>
          {here.length===0
            ? <div style={{fontSize:13,color:C.faint,fontStyle:"italic",lineHeight:1.6}}>
                {isNight(hour)?"Nobody at this hour.":"Nobody just now."}
              </div>
            : here.map(c=>{
                const can=c.kind==="good"?(goods[c.id]||0)>0:(bag[c.id]||0)>0;
                return(<div key={c.person.name} style={{marginBottom:10}}>
                  <div style={{fontSize:16,color:C.gold}}>{c.person.name}</div>
                  <div style={{fontSize:13,color:C.dim,fontStyle:"italic",margin:"4px 0 8px",lineHeight:1.6}}>"{c.person.line}"</div>
                  <div style={{fontSize:13.5,color:C.text,marginBottom:10}}>Wants: <span style={{color:C.gold}}>{c.name}</span> · pays {c.pay} coin</div>
                  <Btn disabled={!can} onClick={()=>serve(c)}>{can?"Hand it over":"You don't have one"}</Btn>
                </div>);})}
        </Panel>)}

      {ipanel==="make"&&(
        <Panel style={{marginBottom:10}}>
          <Label>Make</Label>
          {knownRecipes2.length===0&&<div style={{fontSize:13,color:C.faint,fontStyle:"italic"}}>You don't know any recipes yet.</div>}
          {knownRecipes2.map(x=>{const d=SCRAPS[x.id];
            const need={};x.sol.forEach(i=>need[i]=(need[i]||0)+1);
            const can=Object.entries(need).every(([k,n])=>(bag[k]||0)>=n);
            return(<div key={x.id} onClick={()=>craftKnown(x)} style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",gap:10,padding:"10px 12px",marginBottom:7,borderRadius:7,
              background:can?"#2a2140":"#1b1626",border:`1px solid ${can?"#4d3f6b":"#282236"}`,cursor:"pointer",opacity:can?1:0.6}}>
              <div><div style={{fontSize:14,color:can?C.text:C.faint}}>{d.name}</div>
                <div style={{fontSize:11.5,color:C.faint,marginTop:2}}>
                  {Object.entries(need).map(([k,n],ix)=>(<span key={k} style={{color:(bag[k]||0)>=n?C.faint:"#d8a0a8"}}>
                    {ix?" + ":""}{ING[k]?ING[k].name:k}{n>1?` ×${n}`:""} ({bag[k]||0})</span>))}
                </div></div>
              <div style={{fontSize:12,color:C.gold}}>{goods[d.id]?`×${goods[d.id]}`:""} ▸</div>
            </div>);})}
        </Panel>)}

      {ipanel==="satchel"&&(
        <Panel style={{marginBottom:10}}>
          <Label>Satchel</Label>
          {bagList.length===0&&goodsList.length===0&&<div style={{fontSize:13,color:C.faint,fontStyle:"italic"}}>Empty.</div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {bagList.map(([k,n])=>(<div key={k} style={{background:"#1b1626",border:"1px solid #2e2740",borderRadius:6,padding:"6px 10px",fontSize:12.5}}>
              <span style={{color:ING[k].color,marginRight:5}}>{ING[k].icon}</span><span style={{color:C.dim}}>{ING[k].name}</span><span style={{color:C.faint}}> ×{n}</span></div>))}
            {goodsList.map(([k,n])=>{const d=SCRAPS[k];if(!d)return null;
              return(<div key={k} style={{background:"#2a2140",border:"1px solid #4d3f6b",borderRadius:6,padding:"6px 10px",fontSize:12.5,color:C.gold}}>{d.name} ×{n}</div>);})}
          </div>
        </Panel>)}

      {ipanel==="bed"&&(
        <Panel style={{marginBottom:10}}>
          <Label>Your own bed</Label>
          <div style={{fontSize:12.5,color:C.faint,lineHeight:1.55,marginBottom:10}}>
            {unsettled>0?"You'll not sleep well tonight.":"A proper night restores you fully."}
          </div>
          <div style={{display:"flex",gap:7}}>
            {[8,6,4].map(h=>(
              <button key={h} onClick={()=>{sleep(h);setIpanel(null);}} style={{flex:1,padding:"10px 4px",borderRadius:8,
                fontFamily:"inherit",fontSize:13,cursor:"pointer",background:"#4a3a6b",color:"#f0e6ff",border:"1px solid #6b559b"}}>
                {h}h<div style={{fontSize:10.5,color:"#c9bcda",marginTop:2}}>+{sleepGain(h)} ◆</div>
              </button>))}
          </div>
        </Panel>)}

      {!ipanel&&(
        <Panel style={{marginBottom:10,minHeight:70}}>
          <div style={{fontSize:13.5,color:room.note?C.text:C.faint,lineHeight:1.65,
            fontStyle:room.note?"normal":"italic",whiteSpace:"pre-line"}}>
            {room.note||"Tap to walk. Tap the furniture to use it, or the door to go out."}
          </div>
        </Panel>)}

      {ipanel&&<Btn onClick={()=>setIpanel(null)}>Step back</Btn>}
      {!ipanel&&bench&&room.key==="workshop"&&<Btn tone="gold" onClick={()=>setScreen("workshop")}>
        {now>=bench.readyAt?"Something's ready on the bench":"The bench is working"}</Btn>}
      <Journal/>
    </div>);
  }

  /* ---- TOWN MAP ---- */
  if(screen==="townmap"&&tw&&townDef){
    const t=townDef;
    const TW=t.w*T, TH=t.h*T;
    const [px,py]=tw.pos.split(",").map(Number);
    const [fx,fy]=tw.fam.split(",").map(Number);
    const vw=viewSize.w, vh=viewSize.h;
    const camX=Math.min(Math.max(0,TW-vw),Math.max(0,px*T+T/2-vw/2));
    const camY=Math.min(Math.max(0,TH-vh),Math.max(0,py*T+T/2-vh/2));
    const folk=(TOWNSFOLK[inTown]||[])
      .map((n,i)=>({...n,hue:NPC_HUES[i%NPC_HUES.length],at:npcAt(n,hour)}))
      .filter(n=>n.at);
    const g1=season===3?"#8e9aa0":season===2?"#8a8a46":"#7d9454";
    const g2=season===3?"#97a2a8":season===2?"#948f4e":"#869c5a";
    return(<div style={wrap}>
      <StatusBar/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,padding:"0 2px"}}>
        <div style={{fontSize:16,color:C.text}}>{t.name}</div>
        <div style={{fontSize:11.5,color:C.faint,fontStyle:"italic"}}>
          {isNight(hour)?"Everyone's indoors":`${folk.length} about`}
        </div>
      </div>
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden",marginBottom:10}}>
        <div ref={siteBox} style={{position:"relative",width:"100%",height:vh,overflow:"hidden",background:g1}}>
          <div style={{position:"absolute",width:TW,height:TH,
            transform:`translate(${-camX}px, ${-camY}px)`,transition:"transform 0.18s linear"}}>
            <svg width={TW} height={TH} viewBox={`0 0 ${TW} ${TH}`} style={{display:"block"}}>
              {t.ground.map((row,y)=>row.split("").map((ch,x)=>{
                const water=ch==="~"||ch==="=";
                const lane=ch===".";
                const alt=((x*73856093)^(y*19349663))%3===0;
                return <rect key={`g${x},${y}`} x={x*T} y={y*T} width={T} height={T}
                  fill={ch==="="?"#7a5f42":water?"#31505c":lane?(alt?"#9a8f7a":"#a39880"):(alt?g2:g1)}/>;
              }))}
              {t.ground.map((row,y)=>row.split("").map((ch,x)=>{
                const cx=x*T+T/2, cy=y*T+T/2;
                if(ch==="T") return <g key={`t${x},${y}`} transform={`translate(${cx},${cy})`}>{SEASONAL.tree(season)}</g>;
                if(ch==="w") return (<g key={`w${x},${y}`} transform={`translate(${cx},${cy})`}>{S.oldWell}</g>);
                return null;
              }))}
              {t.boats&&t.boats.map(([bx,by],i)=>(
                <g key={`b${i}`} transform={`translate(${bx*T+T/2},${by*T+T/2})`}>
                  <path d="M-15,4 q15,9 30,0 L26,-3 L-11,-3 Z" fill="#6b503a"/>
                  <path d="M-11,-3 L26,-3 L24,-6 L-9,-6 Z" fill="#8a6a4a"/>
                  <path d="M6,-6 L6,-24" stroke="#8a6a4a" strokeWidth="2"/>
                  <path d="M6,-22 q12,6 0,12 Z" fill="#d8cdb4"/>
                </g>))}
              {t.buildings.map(b=>(
                <g key={b.id} transform={`translate(${b.x*T},${b.y*T})`}
                   onClick={()=>tapTown(b.x,b.y)} style={{cursor:"pointer"}}>
                  <Building b={b} T={T} season={season}/>
                </g>))}
              {folk.map(n=>(
                <g key={n.name} transform={`translate(${n.at[0]*T+T/2},${n.at[1]*T+T/2})`}
                   onClick={()=>tapTown(n.at[0],n.at[1])} style={{cursor:"pointer"}}>
                  {NPC_SPRITE(n.hue)}
                </g>))}
              {t.ground.map((row,y)=>row.split("").map((ch,x)=>(
                <rect key={`tap${x},${y}`} x={x*T} y={y*T} width={T} height={T} fill="transparent"
                  onClick={()=>tapTown(x,y)} style={{cursor:"pointer"}}/>)))}
              <rect x="0" y="0" width={TW} height={TH} fill={L.rgb} opacity={L.alpha}
                style={{pointerEvents:"none"}}/>
              {isNight(hour)&&t.buildings.map(b=>(
                <g key={`lit${b.id}`} style={{pointerEvents:"none"}}>
                  <circle cx={b.x*T+b.w*T/2} cy={b.y*T+b.h*T*0.7} r={b.w*T*0.5} fill="#ffd98a" opacity="0.10"/>
                </g>))}
              <g transform={`translate(${fx*T+T/2},${fy*T+T/2+6})`} style={{transition:"transform 0.15s linear"}}>{FAMILIAR}</g>
              <g transform={`translate(${px*T+T/2},${py*T+T/2+2}) scale(0.86)`}>{WITCH}</g>
            </svg>
          </div>
          <WeatherLayer kind={weather}/>
        </div>
      </div>
      <Panel style={{marginBottom:10,minHeight:76}}>
        <div style={{fontSize:13.5,color:tw.note?C.text:C.faint,lineHeight:1.65,
          fontStyle:tw.note?"normal":"italic",whiteSpace:"pre-line"}}>
          {tw.note||"Tap to walk. Tap a door to go in, or a neighbour to say something."}
        </div>
      </Panel>
      <Btn tone="gold" onClick={()=>{setTw(null);setInTown(null);setScreen("map");}}>Out to the map</Btn>
      <Journal/>
    </div>);
  }

  /* ---- SITE ---- */
  if(screen==="site"&&site){
    const terr=TERRAIN[site.terrain];
    const[px,py]=site.player.split(",").map(Number);
    const[fx,fy]=site.fam.split(",").map(Number);
    const art=site.art||{g1:"#33583c",g2:"#2e5038"};
    const vw=viewSize.w, vh=viewSize.h;
    const camX=Math.min(Math.max(0,SITEW-vw),Math.max(0,px*T+T/2-vw/2));
    const camY=Math.min(Math.max(0,SITEH-vh),Math.max(0,py*T+T/2-vh/2));
    const jit=(x,y)=>((x*73856093)^(y*19349663))%7-3;
    return(<div style={wrap}>
      <StatusBar/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,padding:"0 2px"}}>
        <div style={{fontSize:16,color:C.text}}>{terr.name}</div>
        <div style={{fontSize:11.5,color:site.worn>=6?"#d8a0a8":site.worn>=3?"#c9b06a":C.faint,fontStyle:"italic",textAlign:"right"}}>
          {site.worker&&<div style={{color:C.gold}}>{site.worker.name} is out here</div>}
          {site.perm?site.perm.name:""}
          {site.worn>=3&&<div>{site.worn>=6?"Picked over":"Well worked"}</div>}
        </div>
      </div>
      <div style={{border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden",marginBottom:10}}>
      <div ref={siteBox} style={{position:"relative",width:"100%",height:vh,overflow:"hidden",
        background:art.g1}}>
        <div style={{position:"absolute",width:SITEW,height:SITEH,
          transform:`translate(${-camX}px, ${-camY}px)`,transition:"transform 0.18s linear"}}>
        <svg width={SITEW} height={SITEH} viewBox={`0 0 ${SITEW} ${SITEH}`} style={{display:"block"}}>
          <style>{`
            .sway { transform-box: fill-box; transform-origin: 50% 100%;
                    animation: swayA 4.8s ease-in-out infinite; }
            .sway2 { transform-box: fill-box; transform-origin: 50% 100%;
                     animation: swayB 6.6s ease-in-out infinite; }
            @keyframes swayA { 0%,100%{transform:rotate(-1.6deg)} 50%{transform:rotate(1.6deg)} }
            @keyframes swayB { 0%,100%{transform:rotate(1.2deg)} 50%{transform:rotate(-1.2deg)} }
            .shimmer { animation: shim 5.2s ease-in-out infinite; }
            @keyframes shim { 0%,100%{opacity:.28; transform:translateX(-2px)}
                              50%{opacity:.6; transform:translateX(3px)} }
            .drift { animation: drift 21s linear 1 forwards; will-change: transform; }
            @keyframes drift { 0%{transform:translate(-70px,0)} 100%{transform:translate(${SITEW+70}px,-50px)} }
            .bob { animation: bob 3.1s ease-in-out infinite; }
            @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(9px)} }
            .wingL { transform-box: fill-box; transform-origin: 100% 100%;
                     animation: wingL 0.52s ease-in-out infinite; }
            .wingR { transform-box: fill-box; transform-origin: 0% 100%;
                     animation: wingR 0.52s ease-in-out infinite; }
            @keyframes wingL { 0%,100%{transform:rotate(-26deg)} 50%{transform:rotate(24deg)} }
            @keyframes wingR { 0%,100%{transform:rotate(26deg)} 50%{transform:rotate(-24deg)} }
            .chop { transform-box: fill-box; animation: chopk 1.7s ease-in-out infinite; }
            @keyframes chopk { 0%,55%,100%{transform:rotate(0deg)} 25%{transform:rotate(-52deg)} 40%{transform:rotate(14deg)} }
            .tend { transform-box: fill-box; animation: tendk 2.6s ease-in-out infinite; }
            @keyframes tendk { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-16deg)} }
            .rainA { animation: rainfall 0.6s linear infinite; }
            .rainB { animation: rainfall 0.95s linear infinite; }
            @keyframes rainfall { from{background-position:0 0} to{background-position:-34px 132px} }
            .snowA { animation: snowfall 11s linear infinite; }
            .snowB { animation: snowfall 16s linear infinite; }
            @keyframes snowfall { from{background-position:0 0} to{background-position:34px 300px} }
            .fogA { animation: fogdrift 46s ease-in-out infinite alternate; }
            .fogB { animation: fogdrift2 62s ease-in-out infinite alternate; }
            @keyframes fogdrift { 0%{transform:translateX(-6%)} 100%{transform:translateX(6%)} }
            @keyframes fogdrift2 { 0%{transform:translateX(5%)} 100%{transform:translateX(-5%)} }
            @media (prefers-reduced-motion: reduce) {
              .sway,.sway2,.shimmer,.drift,.bob,.wingL,.wingR,.rainA,.rainB,.snowA,.snowB,.fogA,.fogB,.chop,.tend { animation: none; }
            }
          `}</style>
          {site.cells.map(c=>(<rect key={`g${c.id}`} x={c.x*T} y={c.y*T} width={T} height={T}
            fill={c.water?"#31505c":c.trampled?"#5e5540":c.tint?art.g2:art.g1}/>))}
          {site.cells.filter(c=>c.water&&((c.x*5+c.y*3)%3===0)).map(c=>(
            <g key={`w${c.id}`} transform={`translate(${c.x*T+T/2},${c.y*T+T/2})`}>
              <g className="shimmer" style={{animationDelay:`${((c.x*3+c.y*5)%11)*0.42}s`}}>
              <path d="M-13,-6 q5,-3 10,0 t10,0" fill="none" stroke="#7fb4cf" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M-13,4 q5,-3 10,0 t10,0" fill="none" stroke="#7fb4cf" strokeWidth="1.2" strokeLinecap="round"/>
              </g>
            </g>))}
          {site.cells.map(c=>{
            const j=jit(c.x,c.y);
            const cx=c.x*T+T/2+(c.landmark||c.cross?0:j), cy=c.y*T+T/2+(c.landmark||c.cross?0:(j%3));
            const mineNode=isMine(c.node);
            const locked=mineNode&&c.node.tier>myTier;
            const tappable=!c.blocked||mineNode||c.curio||c.greed||c.landmark;
            return(<g key={c.id} onClick={()=>tapSiteTile(c)} style={{cursor:tappable?"pointer":"default"}}>
              <rect x={c.x*T} y={c.y*T} width={T} height={T} fill="transparent"/>
              {c.landmark==="perm"&&c.perm&&(<g transform={`translate(${cx},${cy})`}>{S[c.perm.k]||S.stone}</g>)}
              {c.landmark&&c.landmark!=="perm"&&(<g transform={`translate(${cx},${cy}) scale(1.5)`}>{PLACE_GLYPH[c.landmark]}</g>)}
              {c.deco&&!c.node&&!c.curio&&!c.greed&&!c.landmark&&(S[c.deco]||SEASONAL[c.deco])&&(
                <g transform={`translate(${cx},${cy})`}>
                  {SWAYS.has(c.deco)&&((c.x*3+c.y)%2===0)
                    ? <g className={(c.x+c.y)%2?"sway":"sway2"} style={{animationDelay:`${((c.x*5+c.y*3)%9)*0.5}s`}}>{SEASONAL[c.deco]?SEASONAL[c.deco](site.season):S[c.deco]}</g>
                    : (SEASONAL[c.deco]?SEASONAL[c.deco](site.season):S[c.deco])}
                </g>)}
              {c.node&&!mineNode&&(S[c.node.k]||SEASONAL[c.node.k])&&(<g transform={`translate(${cx},${cy})`} opacity="0.9">{SEASONAL[c.node.k]?SEASONAL[c.node.k](site.season):S[c.node.k]}</g>)}
              {mineNode&&(c.hidden
                ? <g transform={`translate(${cx},${cy})`} opacity="0.9">{S[(site.art&&site.art.scatter&&site.art.scatter[0])||"tuft"]||S.tuft}</g>
                : <g transform={`translate(${cx},${cy})`}>
                    <g opacity={locked?0.95:(ingOpen(c.node.ing,hour)?1:0.55)} className={NODE_SWAY.has(c.node.k)?((c.x+c.y)%2?"sway":"sway2"):undefined} style={NODE_SWAY.has(c.node.k)?{animationDelay:`${((c.x*7+c.y)%8)*0.55}s`}:undefined}>{SEASONAL[c.node.k]?SEASONAL[c.node.k](site.season):(S[c.node.k]||S.stone)}</g>
                    {locked
                      ? <><circle cx={13} cy={-13} r={7} fill="#171320" opacity="0.8"/><text x={13} y={-9.6} textAnchor="middle" fontSize="10" fill="#d8a0a8" fontFamily="Georgia,serif">!</text></>
                      : !ingOpen(c.node.ing,hour)
                        ? <><circle cx={13} cy={-13} r={6.5} fill="#171320" opacity="0.8"/>
                            <text x={13} y={-9.6} textAnchor="middle" fontSize="9" fill="#8f9ac4" fontFamily="Georgia,serif">
                              {ING[c.node.ing].when==="night"?"☾":"☀"}</text></>
                        : <><circle cx={13} cy={-13} r={6} fill="#171320" opacity="0.75"/><text x={13} y={-9.5} textAnchor="middle" fontSize="9" fill={C.gold} fontFamily="Georgia,serif">{c.node.picks}</text></>}
                  </g>)}
              {c.curio&&<g transform={`translate(${cx},${cy})`}>{CURIO_GLYPH[c.curio.k]}<circle cx="0" cy="0" r="16" fill="#f0d890" opacity="0.08"/></g>}
              {c.greed&&<g transform={`translate(${cx},${cy})`}>{S[c.greed]}</g>}
            </g>);
          })}
          {birdFlight>0&&(
            <g key={`bird${birdFlight}`} className="drift" style={{pointerEvents:"none"}}>
              <g className="bob">
                <g transform={`translate(0,${T*2.4})`} opacity="0.6">
                  <ellipse cx="0" cy="0" rx="4.6" ry="2.8" fill="#241d33"/>
                  <circle cx="4.2" cy="-1.4" r="2.1" fill="#241d33"/>
                  <path d="M6.1,-1.4 L9.4,-0.7 L6.1,0 Z" fill="#3a3050"/>
                  <path d="M-4.4,0.4 L-10,2.2 L-4.4,2 Z" fill="#241d33"/>
                  <g className="wingL"><path d="M-1,-1 q-6,-7 -10,-8 q3,6 8,9 Z" fill="#2b2340"/></g>
                  <g className="wingR"><path d="M1,-1 q-4,-8 0,-11 q4,6 3,11 Z" fill="#332a4a"/></g>
                </g>
              </g>
            </g>)}
          {site.worker&&(()=>{const [wx,wy]=site.worker.at.split(",").map(Number);
            return (<g transform={`translate(${wx*T+T/2},${wy*T+T/2})`}
              onClick={()=>tapSiteTile(site.cells[wy*SW+wx])} style={{cursor:"pointer"}}>
              <Worker w={site.worker}/>
            </g>);})()}
          <rect x="0" y="0" width={SITEW} height={SITEH} fill={L.rgb} opacity={L.alpha}
            style={{pointerEvents:"none"}}/>
          {isNight(hour)&&site.cells.filter(c=>c.node&&(c.node.ing==="ghostcap"||c.node.ing==="lanternmoss")&&!c.hidden).map(c=>{
            const j=jit(c.x,c.y);
            return (<g key={`glow${c.id}`} transform={`translate(${c.x*T+T/2+j},${c.y*T+T/2})`} style={{pointerEvents:"none"}}>
              <circle r="27" fill={c.node.ing==="lanternmoss"?"#ffe9a8":"#cfe0ff"} opacity="0.10"/>
              <circle r="15" fill={c.node.ing==="lanternmoss"?"#fff0c0":"#e4ecff"} opacity="0.14"/>
              {c.node.ing==="lanternmoss"?S.lanternMoss:S.ghostcapCluster}
            </g>);})}
          <g transform={`translate(${fx*T+T/2},${fy*T+T/2+6})`} style={{transition:"transform 0.15s linear"}}>{FAMILIAR}</g>
          <g transform={`translate(${px*T+T/2},${py*T+T/2+2}) scale(0.86)`}>{WITCH}</g>
        </svg>
        </div>
        <WeatherLayer kind={weather}/>
      </div>
      </div>
      <Panel style={{marginBottom:10,minHeight:70}}>
        <div style={{fontSize:13.5,color:site.note?C.text:C.faint,lineHeight:1.65,fontStyle:site.note?"normal":"italic"}}>
          {site.note||(site.worker?`Tap to walk. ${site.worker.name} is working over there — you could say something.`:`Tap to walk. A red ! means you can't work it yet; a sun or moon means it's the wrong hour. Lazlo wanders toward whatever he thinks you've missed.`)}
        </div>
      </Panel>
      <Btn tone="gold" onClick={leaveSite}>Back to the map</Btn>
      <Journal/>
    </div>);
  }

  /* ---- MAP ---- */
  if(screen==="map"){
    const width=HW*7+HW/2+8,height=VS*8+SIZE*2+8;
    const sel=selected?byId[selected]:null,selPlace=sel?.place?PLACES[sel.place]:null;
    const routeSet=new Set(route?.path||[]),busy=!!travelling;
    const hereTile=byId[pos];
    return(<div style={wrap}>
      <StatusBar/>
      <div style={{border:`1px solid ${C.line}`,borderRadius:12,overflow:"hidden",marginBottom:12}}>
      <div style={{background:"radial-gradient(ellipse at 50% 30%, #241d33 0%, #14101d 100%)",padding:6,position:"relative"}}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{width:"100%",display:"block"}}>
          {route&&!busy&&(<polyline points={[pos,...route.path].map(id=>{const t=byId[id];const{x,y}=center(t.c,t.r);return `${x},${y}`;}).join(" ")} fill="none" stroke={C.gold} strokeWidth="2.4" strokeDasharray="5 5" strokeLinecap="round" opacity="0.75"/>)}
          {grid.map(tile=>{
            const{x,y}=center(tile.c,tile.r);
            const known=seen.has(tile.id),here=tile.id===pos,onRoute=routeSet.has(tile.id),t=TERRAIN[tile.terrain];
            const isSel=selected===tile.id,isHome=homeTown&&homeTown.tile===tile.id;
            return(<g key={tile.id} onClick={()=>!busy&&known&&tapHex(tile)} style={{cursor:known&&!busy?"pointer":"default"}}>
              <polygon points={hexPath(x,y)} fill={known?((HEX_FILL[tile.terrain]||[])[season]||t.fill):"#1e1a29"}
                stroke={isSel?C.gold:here?"#e8c87a":isHome?"#c8a0d8":onRoute?"#c9b06a":known?t.edge:"#262133"}
                strokeWidth={isSel||here?2.6:isHome?2:onRoute?1.8:1}/>
              {known&&<g transform={`translate(${x},${y})`}>{tile.place?PLACE_GLYPH[tile.place]:G[tile.terrain]}</g>}
              {here&&<g transform={`translate(${x},${y-2})`}>{WITCH}</g>}
            </g>);})}
          {/* the same light as the ground below */}
          <rect x="0" y="0" width={width} height={height} fill={L.rgb} opacity={L.alpha*0.82}
            style={{pointerEvents:"none"}}/>
          {/* lit windows in the settlements after dark */}
          {isNight(hour)&&grid.filter(t=>seen.has(t.id)&&(t.place==="town"||t.place==="village"||t.place==="home"||t.place==="camp")).map(t=>{
            const{x,y}=center(t.c,t.r);
            return(<g key={`lit${t.id}`} style={{pointerEvents:"none"}}>
              <circle cx={x} cy={y} r="15" fill="#ffd98a" opacity="0.12"/>
              <circle cx={x} cy={y+1} r="6" fill="#ffe6a8" opacity="0.22"/>
            </g>);})}
        </svg>
        <WeatherLayer kind={weather} strength={0.55}/>
      </div>
      </div>
      {settlePrompt?(
        <Panel>
          <div style={{fontSize:17,color:C.gold,marginBottom:6}}>{PLACES[settlePrompt].label}</div>
          <div style={{fontSize:13.5,color:C.dim,lineHeight:1.65,marginBottom:14}}>There's an empty shopfront on the lane. It would be yours, if you wanted it. Do you stop here?</div>
          <Btn tone="gold" onClick={()=>settle(settlePrompt)}>Settle in {PLACES[settlePrompt].label}</Btn>
          <div style={{height:8}}/>
          <Btn onClick={()=>{setSettlePrompt(null);say("Not this one. You keep flying.");}}>Keep looking</Btn>
        </Panel>
      ):(
        <Panel style={{minHeight:100}}>
          {busy&&<div style={{color:"#c9bcda",fontSize:14,fontStyle:"italic"}}>Flying…</div>}
          {!busy&&!sel&&(<>
            <div style={{fontSize:15,color:C.text,marginBottom:4}}>{hereTile.place?PLACES[hereTile.place].label:TERRAIN[hereTile.terrain].name}</div>
            <div style={{fontSize:13,color:C.faint,lineHeight:1.6,marginBottom:12}}>Tap any explored hex to plot a route.</div>
            {hereTile.terrain==="water"
              ? <div style={{fontSize:12.5,color:"#8fb4cf",fontStyle:"italic",lineHeight:1.6,marginBottom:4}}>You're over open water. Pick a shore to make for.</div>
              : <Btn onClick={enterSite}>Set down and look around</Btn>}
            {townHereKey&&(<><div style={{height:8}}/>
              <Btn tone="gold" onClick={()=>enterTown(townHereKey)}>
                Enter {PLACES[townHereKey].label}{homeTown&&homeTown.key===townHereKey?"":" (visiting)"}
              </Btn></>)}
          </>)}
          {!busy&&sel&&(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10}}>
              <div style={{fontSize:17,color:selPlace?C.gold:C.text}}>{selPlace?selPlace.label:TERRAIN[sel.terrain].name}</div>
              {route&&<div style={{fontSize:11,color:"#8f7bb0",whiteSpace:"nowrap"}}>{route.path.length} hex · {route.cost}h</div>}
            </div>
            <div style={{fontSize:13,color:C.dim,lineHeight:1.65,margin:"6px 0 12px"}}>{selPlace?selPlace.blurb:TERRAIN[sel.terrain].blurb}</div>
            {sel.id===pos?(
                sel.terrain==="water"
                ? <div style={{fontSize:12.5,color:"#8fb4cf",fontStyle:"italic"}}>Open water — nowhere to set down.</div>
                : <>
                    <Btn onClick={enterSite}>Set down and look around</Btn>
                    {townHereKey&&(<><div style={{height:8}}/>
                      <Btn tone="gold" onClick={()=>enterTown(townHereKey)}>
                        Enter {PLACES[townHereKey].label}{homeTown&&homeTown.key===townHereKey?"":" (visiting)"}
                      </Btn></>)}
                  </>)
              :!route?<div style={{fontSize:12,color:"#6b5d80",fontStyle:"italic"}}>No known route — explore closer first.</div>
              :sel.terrain==="water"?<div style={{fontSize:12.5,color:"#8fb4cf",fontStyle:"italic",lineHeight:1.6}}>Open water — nowhere to set down. You can cross it, but not stop on it.</div>
              :<Btn onClick={beginTravel}>{`Fly here · ${route.cost} ${route.cost===1?"hour":"hours"}`}</Btn>}
          </>)}
        </Panel>
      )}
      {!busy&&!settlePrompt&&(
        <Panel style={{marginTop:8}}>
          <Label>{atOwnBed?"Your own bed":"Make camp"}</Label>
          <div style={{fontSize:12.5,color:C.faint,lineHeight:1.55,marginBottom:10}}>
            {atOwnBed?"A proper night restores you fully.":"Sleeping rough gives back less than a bed would."}
          </div>
          <div style={{display:"flex",gap:7}}>
            {[8,6,4].map(h=>(
              <button key={h} onClick={()=>sleep(h)} style={{flex:1,padding:"10px 4px",borderRadius:8,
                fontFamily:"inherit",fontSize:13,cursor:"pointer",background:"#4a3a6b",color:"#f0e6ff",
                border:"1px solid #6b559b"}}>
                {h}h<div style={{fontSize:10.5,color:"#c9bcda",marginTop:2}}>+{sleepGain(h)} ◆</div>
              </button>))}
          </div>
        </Panel>)}
      <Journal/>
    </div>);
  }

  /* ---- WORKSHOP ---- */
  if(screen==="workshop"){
    if(homeTown&&!scraps.poultice&&!foundFirst){
      return(<div style={wrap}>
        <div style={{textAlign:"center",padding:"30px 0 20px"}}>
          <div style={{fontSize:10,letterSpacing:5,color:C.violet,textTransform:"uppercase"}}>The back room</div>
          <div style={{fontSize:22,color:"#f0e6c8",marginTop:6}}>Behind a loose board</div>
        </div>
        <Panel style={{marginBottom:14}}>
          <div style={{fontSize:14,color:C.dim,lineHeight:1.8}}>
            The back room has not been swept in a long while. You work at it until the light goes,
            and somewhere in the middle of it a board comes away from the wall and a folded page
            drops out onto the floor.
            <br/><br/>
            It is a water-stained recipe in someone else's hand. Most of it has survived. Not all of it.
          </div>
        </Panel>
        <Btn tone="gold" onClick={()=>{sfx("page");setFoundFirst(true);grantScrap("poultice");}}>Pick it up</Btn>
      </div>);
    }
    const st=openScrap?scraps[openScrap]:null;
    const sc=openScrap?SCRAPS[openScrap]:null;
    const unsolved=Object.values(scraps).filter(s=>!s.solved);
    const solved=Object.values(scraps).filter(s=>s.solved);
    return(<div style={wrap}>
      <div style={{textAlign:"center",marginBottom:10}}>
        <div style={{fontSize:10,letterSpacing:4,color:C.violet,textTransform:"uppercase"}}>Workshop</div>
        <div style={{fontSize:20,color:"#f0e6c8"}}>{st?sc.name:"Back room"}</div>
      </div>
      <StatusBar/>
      {!st&&(<>
        {bench&&(()=>{const d=SCRAPS[bench.scrapId];const ready=now>=bench.readyAt;
          const left=Math.max(0,bench.readyAt-now);
          return(<Panel style={{marginBottom:12,borderColor:ready?C.gold:C.line}}>
            <Label>On the bench</Label>
            <div style={{fontSize:15,color:ready?C.gold:C.text}}>{d?d.name:"Something"}</div>
            <div style={{fontSize:12.5,color:C.dim,marginTop:4,lineHeight:1.55}}>
              {bench.kind==="craft"?"Being made.":bench.picks?bench.picks.map(i=>ING[i]?ING[i].name:i).join(" → "):""}
            </div>
            <div style={{fontSize:12.5,color:C.faint,fontStyle:"italic",margin:"8px 0 12px",lineHeight:1.6}}>
              {ready?"Done. Whatever it became, it's become."
                    :`Still working — about ${left<1?"an hour":Math.round(left)+" hours"} to go. Nothing to watch.`}
            </div>
            <Btn tone="gold" disabled={!ready} onClick={bench.kind==="craft"?collectCraft:collectBench}>
              {ready?"See how it turned out":"Not yet"}
            </Btn>
          </Panel>);})()}
        <Panel style={{marginBottom:12}}>
          <Label>Unsolved scraps</Label>
          {unsolved.length===0&&<div style={{fontSize:13,color:C.faint,fontStyle:"italic"}}>Nothing to puzzle over right now.</div>}
          {unsolved.map(s=>{const d=SCRAPS[s.id];const busy=bench&&bench.scrapId===s.id;return(
            <div key={s.id} onClick={()=>{setOpenScrap(s.id);setPicks(Array(d.slots).fill(null));setPickSlot(null);}}
              style={{padding:"11px 13px",marginBottom:8,borderRadius:8,cursor:"pointer",background:"#2a2140",border:"1px solid #4d3f6b"}}>
              <div style={{fontSize:14.5,color:C.text}}>{d.name}{busy?" ·":""}<span style={{color:C.gold,fontSize:12}}>{busy?(now>=bench.readyAt?" ready":" working"):""}</span></div>
              <div style={{fontSize:11.5,color:C.faint,marginTop:3}}>{d.slots} parts · {s.attempts.length} attempt{s.attempts.length===1?"":"s"} so far</div>
              <div style={{fontSize:11,color:d.repeats?"#c9b06a":C.faint,marginTop:3,fontStyle:"italic"}}>
                {d.repeats?"A component may be called for more than once.":"Four parts, each a different thing.".replace("Four",String(d.slots))}
              </div>
            </div>);})}
        </Panel>
        {solved.length>0&&(<Panel style={{marginBottom:12}}>
          <Label>Recipes you know</Label>
          {solved.map(s=>{const d=SCRAPS[s.id];return(
            <div key={s.id} style={{padding:"9px 12px",marginBottom:6,borderRadius:7,background:"#1b1626",border:"1px solid #2e2740"}}>
              <div style={{fontSize:14,color:C.gold}}>{d.name}</div>
              <div style={{fontSize:11.5,color:C.faint,marginTop:2}}>{s.sol.map(i=>ING[i].name).join(" → ")}</div>
            </div>);})}
        </Panel>)}
        <Btn onClick={()=>{ if(room&&room.key==="workshop") setScreen("room"); else openRoom("workshop"); }}>Back to the bench room</Btn>
      </>)}
      {st&&(<>
        <Panel style={{marginBottom:12}}>
          <Label>The working</Label>
          <div style={{fontSize:11.5,color:sc.repeats?"#c9b06a":C.faint,fontStyle:"italic",marginBottom:10,lineHeight:1.5}}>
            {sc.repeats
              ? "The page is emphatic that a thing may be wanted twice over."
              : `${sc.slots} parts, and no two of them the same.`}
          </div>
          <div style={{display:"flex",gap:7,marginBottom:12}}>
            {Array.from({length:sc.slots}).map((_,i)=>{
              const known=i===st.knownSlot;
              const val=known?st.sol[i]:picks[i];
              return(<div key={i} onClick={()=>!known&&setPickSlot(pickSlot===i?null:i)}
                style={{flex:1,minHeight:58,borderRadius:8,padding:"8px 4px",textAlign:"center",cursor:known?"default":"pointer",
                  background:known?"#33284a":pickSlot===i?"#3d3060":"#1b1626",
                  border:`1px solid ${known?"#7a63a8":pickSlot===i?C.violet:"#2e2740"}`}}>
                <div style={{fontSize:17,color:(val&&ING[val])?ING[val].color:"#4a4060"}}>{(val&&ING[val])?ING[val].icon:"·"}</div>
                <div style={{fontSize:9.5,color:val?C.dim:"#4a4060",marginTop:3,lineHeight:1.2}}>{(val&&ING[val])?ING[val].name:"?"}</div>
                {known&&<div style={{fontSize:8,color:"#8f7bb0",letterSpacing:1,marginTop:2}}>KNOWN</div>}
              </div>);})}
          </div>
          {pickSlot!==null&&(
            <div style={{background:"#171320",border:`1px solid ${C.line}`,borderRadius:8,padding:"10px",marginBottom:10}}>
              <div style={{fontSize:11,color:C.faint,marginBottom:8}}>Put in slot {pickSlot+1}:</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {sc.pool.filter(k=>ING[k]).map(k=>{
                  const owned=bag[k]||0;
                  const usedElsewhere=picks.filter((v,i)=>i!==pickSlot&&v===k).length
                    + (st.sol[st.knownSlot]===k?1:0);
                  const n=owned-usedElsewhere;
                  return(<div key={k} onClick={()=>{if(n<1)return;const p=[...picks];p[pickSlot]=k;setPicks(p);setPickSlot(null);}}
                    style={{padding:"7px 10px",borderRadius:6,fontSize:12,cursor:n?"pointer":"default",opacity:n?1:0.35,
                      background:"#231c33",border:"1px solid #362c4d"}}>
                    <span style={{color:ING[k].color,marginRight:5}}>{ING[k].icon}</span>
                    <span style={{color:C.dim}}>{ING[k].name}</span><span style={{color:C.faint}}> ×{n}</span>
                  </div>);})}
              </div>
            </div>)}
          <Btn disabled={!!bench||picks.filter((p,i)=>i!==st.knownSlot).some(p=>!p)}
            onClick={()=>{ if(bench)return;
              startWorking(picks.map((p,i)=>i===st.knownSlot?st.sol[i]:p));
              setOpenScrap(null);
            }}>{bench?"The bench is occupied":`Set it working · ${sc.repeats?10:6} hours · 1 ◆`}</Btn>
        </Panel>
        <Panel style={{marginBottom:12}}>
          <Label>Your notes</Label>
          {st.attempts.length===0&&<div style={{fontSize:13,color:C.faint,fontStyle:"italic"}}>No attempts yet.</div>}
          {st.attempts.map((a,i)=>(
            <div key={i} style={{padding:"9px 11px",marginBottom:6,borderRadius:7,background:"#1b1626",border:"1px solid #2e2740"}}>
              <div style={{fontSize:12.5,color:C.dim}}>{a.picks.map(p=>ING[p].name).join(" → ")}</div>
              <div style={{fontSize:11.5,color:C.gold,marginTop:4}}>{a.exact} right · {a.present} misplaced</div>
            </div>))}
        </Panel>
        <Btn onClick={()=>{setOpenScrap(null);setPickSlot(null);}}>Set it aside</Btn>
      </>)}
      <Journal/>
    </div>);
  }

  /* ---- TOWN ---- */
  const bagList=Object.entries(bag).filter(([k,n])=>n>0&&ING[k]);
  const goodsList=Object.entries(goods).filter(([,n])=>n>0);
  const sk=skills[prof], nextNeed=TIER_NEED[Math.min(3,myTier+1)];
  const trainedLvl = trainedOf(prof);
  const teacherReady = prof==="herbalism" && trainedLvl<2 && sk.xp>=TIER_NEED[2];
  return(<div style={wrap}>
    <div style={{textAlign:"center",marginBottom:10}}>
      <div style={{fontSize:10,letterSpacing:4,color:C.violet,textTransform:"uppercase"}}>{PROFS[prof].label} · {["","Forager","Herbalist","Potioner"][myTier]}</div>
      <div style={{fontSize:21,color:"#f0e6c8"}}>Éri's shop</div>
      <div style={{fontSize:12,color:C.faint}}>{PLACES[homeTown.key].label}</div>
    </div>
    <StatusBar/>

    <Panel style={{marginBottom:12}}>
      <Label>Skill</Label>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
        <div style={{fontSize:14,color:C.text}}>{["","Forager","Herbalist","Potioner"][myTier]}</div>
        <div style={{fontSize:11.5,color:sk.xp>=xpCapOf(prof)?C.gold:C.faint}}>{Math.floor(sk.xp)} / {nextNeed}</div>
      </div>
      <div style={{height:6,background:"#171320",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${Math.min(100,(sk.xp/nextNeed)*100)}%`,background:sk.xp>=xpCapOf(prof)?C.gold:C.violet}}/>
      </div>
      {sk.xp>=xpCapOf(prof)&&(
        <div style={{fontSize:12,color:C.gold,marginTop:8,fontStyle:"italic",lineHeight:1.55}}>
          You've gone as far as practice alone will take you. Nothing more is sinking in.
        </div>)}
      {teacherReady&&(
        <div style={{marginTop:12,padding:"11px 13px",borderRadius:8,background:"#2e2640",border:`1px solid ${C.violet}`}}>
          <div style={{fontSize:14,color:C.gold,marginBottom:4}}>The herb-woman</div>
          <div style={{fontSize:12.5,color:C.dim,lineHeight:1.6,marginBottom:10}}>
            She's watched you working. "You've gone as far as guessing takes you," she says. "The rest I'd have to show you." She names a price.
          </div>
          <Btn disabled={coin<60} onClick={trainUp}>{coin<60?"60 coin — you're short":"Pay 60 coin and learn"}</Btn>
        </div>)}
      {!teacherReady&&trainedLvl>=2&&sk.xp>=TIER_NEED[3]&&myTier<3&&(
        <div style={{fontSize:12,color:C.faint,marginTop:10,fontStyle:"italic"}}>The herb-woman says there's a thing she'd have you fetch before she teaches you the rest. She hasn't said what yet.</div>)}
    </Panel>

    {unsettled>0&&(
      <div style={{background:"#2e1d24",border:"1px solid #5a3540",borderRadius:9,padding:"10px 14px",marginBottom:12,fontSize:12.5,color:"#d8a0a8",lineHeight:1.55}}>
        Unsettled — something you took is sitting badly. Rest is poor for {unsettled} more night{unsettled===1?"":"s"}.
      </div>)}

    {Object.keys(bonds).length>0&&(
      <Panel style={{marginBottom:12}}>
        <Label>Standing</Label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {Object.entries(bonds).sort((a,b)=>b[1]-a[1]).map(([n,v])=>(
            <div key={n} style={{background:"#1b1626",border:"1px solid #2e2740",borderRadius:6,padding:"6px 10px",fontSize:12.5}}>
              <span style={{color:C.dim}}>{n}</span>
              <span style={{color:v>0?"#9ec48a":v<0?"#d8a0a8":C.faint,marginLeft:6}}>{v>0?"+"+v:v}</span>
            </div>))}
        </div>
      </Panel>)}
    <Panel style={{marginBottom:12}}>
      <Label>At the counter</Label>
      {(()=>{
        const here=customers.filter(c=>now>=c.from&&now<c.to&&!served.includes(c.person.name));
        const later=customers.filter(c=>now<c.from&&!served.includes(c.person.name));
        if(!here.length) return (
          <div style={{fontSize:13,color:C.faint,fontStyle:"italic",lineHeight:1.6}}>
            {later.length
              ? (isNight(hour)
                  ? `Nobody at this hour. ${later.length===1?"Someone is":`${later.length} people are`} expected once it's light.`
                  : `Nobody just now. ${later.length===1?"One more":`${later.length} more`} expected later today.`)
              : "The lane is quiet. Nobody else is coming today."}
          </div>);
        return here.map(c=>{
          const can=c.kind==="good"?(goods[c.id]||0)>0:(bag[c.id]||0)>0;
          const leaves=Math.max(0,c.to-now);
          return (
            <div key={c.person.name} style={{marginBottom:12,paddingBottom:12,borderBottom:here.length>1?"1px solid #2a2338":"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
                <div style={{fontSize:16,color:C.gold}}>{c.person.name}</div>
                <div style={{fontSize:11,color:C.faint,whiteSpace:"nowrap"}}>
                  {leaves<1?"leaving soon":`here ~${Math.round(leaves)}h`}
                </div>
              </div>
              <div style={{fontSize:13,color:C.dim,fontStyle:"italic",margin:"4px 0 10px",lineHeight:1.6}}>"{c.person.line}"</div>
              <div style={{fontSize:13.5,color:C.text,marginBottom:12}}>Wants: <span style={{color:C.gold}}>{c.name}</span> · pays {c.pay} coin</div>
              <Btn disabled={!can} onClick={()=>serve(c)}>{can?"Hand it over":"You don't have one"}</Btn>
            </div>);
        });
      })()}
    </Panel>

    <Panel style={{marginBottom:12}}>
      <Label>Make</Label>
      {knownRecipes.length===0&&<div style={{fontSize:13,color:C.faint,fontStyle:"italic"}}>You don't know any recipes yet. Work on a scrap in the back room.</div>}
      {knownRecipes.map(s=>{const d=SCRAPS[s.id];
        const need={};s.sol.forEach(i=>need[i]=(need[i]||0)+1);
        const can=Object.entries(need).every(([k,n])=>(bag[k]||0)>=n);
        return(<div key={s.id} onClick={()=>craftKnown(s)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",marginBottom:7,borderRadius:7,
          background:can?"#2a2140":"#1b1626",border:`1px solid ${can?"#4d3f6b":"#282236"}`,cursor:"pointer",opacity:can?1:0.6}}>
          <div><div style={{fontSize:14,color:can?C.text:C.faint}}>{d.name}</div>
            <div style={{fontSize:11.5,color:C.faint,marginTop:2}}>
              {Object.entries(need).map(([k,n],ix)=>(
                <span key={k} style={{color:(bag[k]||0)>=n?C.faint:"#d8a0a8"}}>
                  {ix?" + ":""}{ING[k]?ING[k].name:k}{n>1?` ×${n}`:""} ({bag[k]||0})
                </span>))}
            </div></div>
          <div style={{fontSize:12,color:C.gold,whiteSpace:"nowrap"}}>{goods[d.id]?`×${goods[d.id]}`:""} {can?"▸":""}</div>
        </div>);})}
    </Panel>

    <Panel style={{marginBottom:12}}>
      <Label>Satchel</Label>
      {bagList.length===0&&goodsList.length===0&&<div style={{fontSize:13,color:C.faint,fontStyle:"italic"}}>Empty. Fly out and gather something.</div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
        {bagList.map(([k,n])=>(<div key={k} style={{background:"#1b1626",border:"1px solid #2e2740",borderRadius:6,padding:"6px 10px",fontSize:12.5}}>
          <span style={{color:ING[k].color,marginRight:5}}>{ING[k].icon}</span><span style={{color:C.dim}}>{ING[k].name}</span><span style={{color:C.faint}}> ×{n}</span></div>))}
        {goodsList.map(([k,n])=>{const d=SCRAPS[k];if(!d)return null;
          return(<div key={k} style={{background:"#2a2140",border:"1px solid #4d3f6b",borderRadius:6,padding:"6px 10px",fontSize:12.5,color:C.gold}}>{d.name} ×{n}</div>);})}
      </div>
    </Panel>

    <Btn tone={bench&&now>=bench.readyAt?"gold":"violet"} onClick={()=>{sfx("page");setScreen("workshop");}}>
      {bench?(now>=bench.readyAt?`The ${SCRAPS[bench.scrapId]?.name||"work"} is ready · look`:"Into the back room · still working"):"Into the back room"}
    </Btn>
    <div style={{height:8}}/>
    <Btn onClick={()=>{ if(!tw||inTown!==homeTown.key){const t=TOWNS[homeTown.key];const e=`${t.entry[0]},${t.entry[1]}`;
        setInTown(homeTown.key);
        setTw({pos:e,fam:e,walking:null,note:null,pending:null});}
      setScreen("townmap"); }}>Out to the street</Btn>
    <div style={{height:8}}/>
    <Btn onClick={()=>{setSelected(null);setTw(null);setInTown(null);setScreen("map");}}>Fly out to gather</Btn>
    <div style={{height:8}}/>
    <Btn tone="gold" onClick={()=>sleep(8)}>Close up · end day</Btn>
    <Journal/>
    <div style={{textAlign:"center",marginTop:18}}>
      <button onClick={reset} style={{background:"none",border:"none",color:"#4a4060",fontSize:11,fontFamily:"inherit",cursor:"pointer",letterSpacing:1}}>start over</button>
    </div>
  </div>);
}
