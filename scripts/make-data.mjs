// Writes the synthetic data sets in data/ and the answers worked by hand in expected/.
// Nothing is random: every value is written below or computed from one, so running this again
// gives the same files byte for byte. Usage: node scripts/make-data.mjs
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(root+'data',{recursive:true});
mkdirSync(root+'expected',{recursive:true});
const csv=(columns,rows)=>[columns.join(','),...rows.map(r=>columns.map(c=>r[c]??'').join(','))].join('\n')+'\n';
const write=(path,columns,rows)=>writeFileSync(root+path,csv(columns,rows));

// 1. CLINIC VISITS: one row per visit, wide. Ages 4, 5 and 6 sit either side of an under-5 rule
// and on it; 38.0 sits on a fever threshold; two weights and two temperatures are not recorded.
const visits=[
  ['V01','Hillside',2,12.1,38.4,'2025-03-03'],['V02','Hillside',4,16.0,37.2,'2025-03-03'],
  ['V03','Hillside',5,18.2,38.0,'2025-03-04'],['V04','Hillside',6,20.5,'', '2025-03-04'],
  ['V05','Hillside',11,35.0,36.9,'2025-03-05'],['V06','Hillside',34,'',39.1,'2025-03-05'],
  ['V07','Riverbank',0.5,7.4,38.9,'2025-03-03'],['V08','Riverbank',3,14.3,37.9,'2025-03-04'],
  ['V09','Riverbank',5,'',37.0,'2025-03-04'],['V10','Riverbank',9,28.8,38.1,'2025-03-05'],
  ['V11','Riverbank',15,52.0,'', '2025-03-06'],['V12','Riverbank',70,61.5,38.6,'2025-03-06'],
].map(([id,clinic,age_years,weight_kg,temperature_c,visit_date])=>({id,clinic,age_years,weight_kg,temperature_c,visit_date}));
write('data/clinic-visits.csv',['id','clinic','age_years','weight_kg','temperature_c','visit_date'],visits);

// 2. DISTRICTS: one row per district, wide. Harbour has no houses, so a rate per house divides by zero.
const districts=[
  ['Northgate',4200,61,18900],['Eastmarsh',3150,12,13800],['Southfield',5020,118,23400],
  ['Westbury',2875,0,12100],['Harbour',0,0,340],
].map(([district,houses,deaths,population])=>({district,houses,deaths,population}));
write('data/districts.csv',['district','houses','deaths','population'],districts);
write('expected/districts.csv',['district','houses_without_a_death','deaths_per_10000_houses'],
  districts.map(d=>({district:d.district,houses_without_a_death:d.houses-d.deaths,
    deaths_per_10000_houses:d.houses===0?'':d.deaths/d.houses*10000})));

// 3. CUMULATIVE CASES: one row per place and week, long as many surveillance exports are.
// North is clean. East has no row for week 5. South falls at week 7, a correction in reporting.
// West has week 4 twice, with different values.
const weeks=Array.from({length:10},(_,i)=>{const d=new Date(Date.UTC(2025,0,6+7*i));return d.toISOString().slice(0,10);});
const series={
  North:[3,7,12,20,31,45,58,66,71,74],
  East:[1,4,9,15,null,30,41,49,53,55],
  South:[5,9,16,24,33,40,38,45,50,52],
  West:[2,5,8,[12,13],17,23,30,34,37,39],
};
const cumulative=[];
for(const [place,values] of Object.entries(series))
  values.forEach((v,i)=>{
    if(v===null)return;
    for(const x of [v].flat())cumulative.push({place,week_start:weeks[i],cumulative_cases:x});
  });
// NOT IN DATE ORDER, on purpose: latest week first, places interleaved. "The previous row" in file
// order is then the wrong row for every place, so a rule that reads it must sort by place and week
// first (Epi Info's SORT), and a rule that does not gives answers that are visibly wrong.
cumulative.sort((a,b)=>b.week_start.localeCompare(a.week_start)||Object.keys(series).indexOf(a.place)-Object.keys(series).indexOf(b.place));
write('data/cumulative-cases-by-week.csv',['place','week_start','cumulative_cases'],cumulative);

// The same counts, one column per week. West is left out: a week recorded twice has no single
// value to put in one cell. East's week 5 is an empty cell.
const wideColumns=weeks.map((_,i)=>`cum_w${String(i+1).padStart(2,'0')}`);
write('data/cumulative-cases-wide.csv',['place',...wideColumns],
  ['North','East','South'].map(place=>Object.fromEntries([['place',place],
    ...series[place].map((v,i)=>[wideColumns[i],v??''])])));

// 5. CLINIC LOCATIONS: one point per clinic, made up and placed in open sea near 0° N, 0° E so no place looks real.
// GeoJSON whose counts are stored as text -- "34", not 34 -- as many exports store them. A rule reading `cases` as a
// number finds none until the column is read as numbers in Data quality. One count is written "about 5", which no
// repair reads: it stays unread and is named. Bands: under 10, 10 to 29, 30 or more.
const clinics=[
  {clinic:'Hillside',longitude:'0.012',latitude:'0.021',cases:'34'},
  {clinic:'Riverbank',longitude:'0.031',latitude:'0.008',cases:'12'},
  {clinic:'Northgate',longitude:'0.044',latitude:'0.037',cases:'7'},
  {clinic:'Eastmarsh',longitude:'0.058',latitude:'0.015',cases:'30'},
  {clinic:'Southfield',longitude:'0.025',latitude:'-0.006',cases:'9'},
  {clinic:'Westbury',longitude:'-0.004',latitude:'0.029',cases:'about 5'},
  {clinic:'Harbour',longitude:'0.066',latitude:'0.041',cases:'10'},
];
writeFileSync(root+'data/clinic-locations.geojson',JSON.stringify({type:'FeatureCollection',features:clinics.map(c=>(
  {type:'Feature',properties:{clinic:c.clinic,cases:c.cases},geometry:{type:'Point',coordinates:[Number(c.longitude),Number(c.latitude)]}}))},null,1)+'\n');

// New cases, by hand, under each meaning of "previous". Previous ROW: the row before, whatever its
// week. Previous WEEK: the row seven days before, empty when there is none. West's two week-4 rows
// have no single previous or next, so they and every West row after them get no value.
const expected=[];
for(const [place,values] of Object.entries(series)){
  let lastRow=null,broken=false;
  values.forEach((v,i)=>{
    if(v===null)return;
    const prevWeek=values[i-1];
    for(const x of [v].flat()){
      const repeated=Array.isArray(v);
      if(repeated)broken=true;
      const byRow=broken||lastRow===null?'':x-lastRow;
      const byWeek=broken||i===0||prevWeek===null||prevWeek===undefined?'':x-prevWeek;
      expected.push({place,week_start:weeks[i],cumulative_cases:x,
        new_cases_previous_row:byRow,new_cases_previous_week:byWeek,
        says:repeated?'week recorded twice':broken?'after a week recorded twice':i===0?'first week':(prevWeek===null?'previous week missing':
          (byRow!==''&&byRow<0?'cumulative fell':''))});
    }
    lastRow=Array.isArray(v)?null:v;
  });
}
write('expected/new-cases.csv',['place','week_start','cumulative_cases','new_cases_previous_row',
  'new_cases_previous_week','says'],expected);
console.log(`clinic-visits ${visits.length}, districts ${districts.length}, cumulative ${cumulative.length} rows`);
