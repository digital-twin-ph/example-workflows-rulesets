// Writes manual.json: the steps that build this example's four workflows in Fieldwork from an empty canvas.
// Nothing is random; running it again gives the same file. Usage: node scripts/make-manual.mjs <data commit>
import {writeFileSync} from 'node:fs';

const COMMIT=process.argv[2];
if(!/^[0-9a-f]{40}$/.test(COMMIT??''))throw new Error('Give the full commit the data files are read from.');
const RAW=`https://raw.githubusercontent.com/digital-twin-ph/example-workflows-rulesets/${COMMIT}/data/`;
const predicate=column=>`fwa:${column.replace(/[^A-Za-z0-9]+(.)/g,(_,c)=>c.toUpperCase()).replace(/[^A-Za-z0-9]/g,'')}`;
const RULES='Rules';

const steps={
  newProject:()=>[
    {click:'#new-project',label:'New project',opens:'New project'},
    {fill:'project-name-input',label:'Name',value:'Rules on synthetic data',dialog:'New project'},
    {fill:'project-subject-input',label:'Subject',value:'Every feature of Apply ruleset, on data made to reach each one',dialog:'New project'},
    {click:'#project-create',label:'Create project',dialog:'New project'}],
  newWorkflow:()=>[{click:'#add-workflow',label:'Add workflow',view:'workflow'}],
  name:question=>[{fill:'workflow-name-edit',view:'project',label:'This workflow’s name — the question it answers',value:question}],
  importTable:({as,file,shape,keys,values,value,unit})=>[
    {add:'table_input',as},{select:as},
    {click:'#open-table',label:'Configure\u2026',opens:'Tabular data'},
    {click:'#table-remote summary',label:'Or fetch from a URL',dialog:'Tabular data'},
    {fill:'table-url',label:'URL of a CSV, Stata file or zip',value:RAW+file,dialog:'Tabular data'},
    {click:'#table-fetch',label:'Fetch',dialog:'Tabular data'},
    ...(shape==='long'
      ?[{choose:'table-shape',label:'Shape of the file',value:'long',shown:'Long',dialog:'Tabular data'},
        {choose:'table-value',label:'Value column',value,dialog:'Tabular data'}]
      :[]),
    {tick:'table-keys',label:'Key columns',values:keys,dialog:'Tabular data'},
    ...(shape==='wide'?[{tick:'table-values',label:'Value columns',values,dialog:'Tabular data'}]:[]),
    ...(unit?[{fill:'table-unit',label:'Unit of the value (entered by you)',value:unit,dialog:'Tabular data'}]:[]),
    {click:'#table-save',label:'Apply',dialog:'Tabular data'}],
  // A STEP WHOSE RULES ARE WRITTEN HERE, reading the table, each number it reads given its unit.
  rulesOn:({as,from,units,columns})=>[
    {add:'apply_ruleset',as},{select:as},
    {click:'#author-rules',label:'Write rules for this step',opens:RULES},
    {click:'#rule-editor-cancel',label:'Close without keeping'},
    {choose:'ruleset-records',label:'Records arrive as',value:'table',shown:'A table'},
    {connect:{from,to:as,port:'subjects'}},
    {select:as},
    {click:'#use-columns',label:`Use these ${columns} columns`},
    ...Object.entries(units).map(([column,unit])=>({fill:`[aria-label="Unit for ${column}"]`,label:`Unit for ${column}`,value:unit})),
    {click:'#edit-rules',label:'Edit these rules'}],
  keep:()=>[{click:'#rule-editor-keep',label:'Keep these rules'}],
  output:({as,from,label})=>[
    {add:'table_output',as},
    {connect:{from,to:as,port:'table'}},
    {run:true}],
};

/** One rule's controls, named as the dialog names them. */
const at=(r,part,extra='')=>`[data-rule="${r}"]${extra}[data-part="${part}"]`;
const cond=(r,c)=>`[data-group="0"][data-condition="${c}"]`;
const condition=(r,c,{field,comparator,value,setting,shown})=>[
  ...(c?[{click:at(r,'add-condition','[data-group="0"]'),label:'+ and'}]:[]),
  {choose:at(r,'field',cond(r,c)),label:'Field',value:predicate(field),shown:field},
  {choose:at(r,'comparator',cond(r,c)),label:'Comparator',value:comparator,shown},
  ...(setting?[{choose:at(r,'value-source',cond(r,c)),label:'Compared against',value:setting}]:[]),
  ...(value!==undefined?[{fill:at(r,'value',cond(r,c)),label:'Value',value:String(value)}]:[])];
const category=(r,name,value)=>[
  {fill:at(r,'predicate','[data-then="0"]'),label:'Conclusion name',value:name},
  {fill:at(r,'conclusion','[data-then="0"]'),label:'Conclusion value',value}];
const operand=(r,side,o)=>typeof o==='number'
  ?[{choose:at(r,`${side}-source`,'[data-then="0"]'),label:side==='left'?'First value':'Second value',value:'',shown:'a number'},
    {fill:at(r,`${side}-number`,'[data-then="0"]'),label:side==='left'?'First number':'Second number',value:String(o)}]
  :[{choose:at(r,`${side}-source`,'[data-then="0"]'),label:side==='left'?'First value':'Second value',
    value:o.computed?`fwa:c_${o.computed.replace(/[^A-Za-z0-9]+/g,'_')}`:o.previous?`previous:${predicate(o.previous)}`:predicate(o.column),
    shown:o.computed??(o.previous?`${o.previous} in the previous row`:o.column)}];
const OPERATOR={'-':'minus','+':'plus','*':'times','/':'dividedBy'};
const computed=(r,column,left,op,right,{kindFirst=false,unit}={})=>[
  ...(kindFirst?[{choose:at(r,'then-kind','[data-then="0"]'),label:'Kind of conclusion',value:'computed',shown:'a computed value'}]:[]),
  {fill:at(r,'column','[data-then="0"]'),label:'New column',value:column},
  ...operand(r,'left',left),
  {choose:at(r,'operator','[data-then="0"]'),label:'Operation',value:OPERATOR[op]},
  ...operand(r,'right',right),
  // The new column's unit, stated where the column is made.
  ...(unit?[{fill:at(r,'unit','[data-then="0"]'),label:'Unit of the new column',value:unit}]:[])];
const addRule=r=>[{note:`Rule ${r+1}.`},{click:'#rule-editor-add',label:'+ Add a rule'}];
const addEvery=r=>[{note:`Rule ${r+1}, for every record.`},{click:'#rule-editor-add-every',label:'+ Add a value computed for every record'}];

const workflows=[];

// 1. CLINIC VISITS: categories under conditions, a value computed under one, every comparison, and a setting.
workflows.push({name:'Which visits are under five, which had a fever, and what dose?',steps:[
  ...steps.newProject(),
  ...steps.name('Which visits are under five, which had a fever, and what dose?'),
  {note:'Twelve made-up clinic visits. Ages 4, 5 and 6 sit either side of the under-5 rule and on it; one temperature is exactly 38.0 °C, on the fever threshold; two weights and two temperatures were not recorded.'},
  ...steps.importTable({as:'visits',file:'clinic-visits.csv',shape:'wide',keys:['id','clinic','visit_date'],
    values:['age_years','weight_kg','temperature_c']}),
  ...steps.rulesOn({as:'rules',from:'visits',units:{age_years:'years',weight_kg:'kilograms',temperature_c:'degrees Celsius'},columns:6}),
  {note:'The fever threshold is a setting of this step, so it can be changed without rewriting a rule. Give it the wrong unit first, to see it refused.'},
  {click:'#rule-editor-add-setting',label:'+ Add a setting'},
  {fill:'[data-setting="0"][data-setting-part="name"]',label:'Setting name',value:'fever'},
  {fill:'[data-setting="0"][data-setting-part="value"]',label:'Setting value',value:'100.4'},
  {fill:'[data-setting="0"][data-setting-part="unit"]',label:'Setting unit',value:'degrees Fahrenheit'},
  ...addRule(0),...condition(0,0,{field:'temperature_c',comparator:'greaterThan',shown:'is more than',setting:'fever'}),
  ...category(0,'fever','Yes'),
  {see:'a refusal: temperature_c is in degrees Celsius and the fever setting in degrees Fahrenheit',within:'#rule-editor [role="alert"]',
    check:'temperature_c is measured in degrees Celsius and the fever setting is in degrees Fahrenheit'},
  {fill:'[data-setting="0"][data-setting-part="value"]',label:'Setting value',value:'38'},
  {fill:'[data-setting="0"][data-setting-part="unit"]',label:'Setting unit',value:'degrees Celsius'},
  ...addRule(1),...condition(1,0,{field:'temperature_c',comparator:'notGreaterThan',shown:'is at most',setting:'fever'}),
  ...category(1,'fever','No'),
  ...addRule(2),...condition(2,0,{field:'temperature_c',comparator:'__notRecorded',shown:'is not recorded'}),
  ...category(2,'fever','NotMeasured'),
  ...addRule(3),...condition(3,0,{field:'age_years',comparator:'lessThan',shown:'is less than',value:5}),
  ...category(3,'band','UnderFive'),
  ...addRule(4),...condition(4,0,{field:'age_years',comparator:'notLessThan',shown:'is at least',value:5}),
  ...category(4,'band','FiveOrOver'),
  {note:'A value computed under a condition: a dose of 15 mg per kilogram, for a child under five whose weight was recorded.'},
  ...addRule(5),...condition(5,0,{field:'age_years',comparator:'lessThan',shown:'is less than',value:5}),
  ...condition(5,1,{field:'weight_kg',comparator:'__recorded',shown:'is recorded'}),
  ...computed(5,'dose mg',{column:'weight_kg'},'*',15,{kindFirst:true,unit:'milligrams'}),
  ...addRule(6),...condition(6,0,{field:'clinic',comparator:'equals',shown:'is',value:'Hillside'}),
  ...category(6,'site','North'),
  {see:'every visit banded, and the dose only for children under five with a weight',within:'#rule-editor .rule-live-summary',check:'12 records.'},
  ...steps.keep(),
  ...steps.output({as:'shown',from:'rules'}),
  {see:'V01 under five, a fever, a dose of 181.5 mg; V03 exactly 38.0 °C, no fever; V04 not measured',check:'181.5'},
  {see:'the six Hillside visits at site North',check:'North'}]});

// 2. DISTRICTS: a value for every row, one read by another, a division by zero, a conflict and rows no rule matches.
workflows.push({name:'Deaths per 10,000 houses, by district',steps:[
  ...steps.newWorkflow(),
  ...steps.name('Deaths per 10,000 houses, by district'),
  {note:'Five made-up districts. Harbour has no houses, so deaths per house divides by zero.'},
  ...steps.importTable({as:'districts',file:'districts.csv',shape:'wide',keys:['district'],values:['houses','deaths','population']}),
  ...steps.rulesOn({as:'rules',from:'districts',units:{houses:'houses',deaths:'deaths'},columns:4}),
  ...addEvery(0),...computed(0,'houses without a death',{column:'houses'},'-',{column:'deaths'},{unit:'houses'}),
  {note:'Read before it is computed: the order the rules are listed in does not matter.'},
  ...addEvery(1),...computed(1,'deaths per house',{column:'deaths'},'/',{column:'houses'},{unit:'deaths per house'}),
  ...addEvery(2),...computed(2,'deaths per 10000 houses',{computed:'deaths per house'},'*',10000,{unit:'deaths per 10,000 houses'}),
  {see:'Harbour named, its rate empty, from a division by zero',within:'#rule-editor .rule-live-summary',
    check:'1 record has an empty value, from a division by zero.'},
  {note:'Two rules that disagree: Southfield has more than 50 deaths and more than 5,000 houses.'},
  ...addRule(3),...condition(3,0,{field:'deaths',comparator:'greaterThan',shown:'is more than',value:50}),...category(3,'level','High'),
  ...addRule(4),...condition(4,0,{field:'houses',comparator:'greaterThan',shown:'is more than',value:5000}),...category(4,'level','Low'),
  {see:'Southfield given no level, both rules named',within:'#rule-editor .rule-live-summary',check:'because two rules gave different values'},
  ...steps.keep(),
  ...steps.output({as:'shown',from:'rules'}),
  {see:'Northgate 145.238…; Harbour no rate',check:'145.23809523809524'}]});

// 3. CUMULATIVE CASES, LONG: the previous row, after a sort.
workflows.push({name:'New cases each week, from a cumulative count',steps:[
  ...steps.newWorkflow(),
  ...steps.name('New cases each week, from a cumulative count'),
  {note:'Four made-up places, ten weeks each, out of date order on purpose. North is clean; East has no row for 3 February; South’s count falls at week 7; West has 27 January twice.'},
  ...steps.importTable({as:'cumulative',file:'cumulative-cases-by-week.csv',shape:'long',value:'cumulative_cases',
    keys:['place','week_start'],unit:'cases'}),
  ...steps.rulesOn({as:'rules',from:'cumulative',units:{cumulative_cases:'cases'},columns:3}),
  ...addEvery(0),...computed(0,'new cases',{column:'cumulative_cases'},'-',{previous:'cumulative_cases'},{unit:'cases'}),
  {see:'the rule waiting for an order',within:'#rule-editor [role="alert"]',check:'A rule reads the previous row, so the records need an order'},
  {choose:'rule-order-by',label:'Sort by',value:'week_start',shown:'week_start (dates)'},
  {choose:'rule-order-previous',label:'The previous row is',value:'week',shown:'the week before'},
  {see:'Before, sorted and after: four first weeks, East’s missing week, West’s repeated week and the weeks after it',
    within:'#rule-editor .rule-live-summary',check:'13 records have no value, because there is no single previous row.'},
  ...steps.keep(),
  ...steps.output({as:'shown',from:'rules'}),
  {see:'South’s 17 February: −2, kept',check:'-2'}]});

// 4. CUMULATIVE CASES, WIDE: the same sum within one row.
workflows.push({name:'New cases in week 5, from one column per week',steps:[
  ...steps.newWorkflow(),
  ...steps.name('New cases in week 5, from one column per week'),
  {note:'The same counts, one column per week, so new cases are a difference within one row. East’s week 5 is empty.'},
  ...steps.importTable({as:'weeks',file:'cumulative-cases-wide.csv',shape:'wide',keys:['place'],
    values:Array.from({length:10},(_,i)=>`cum_w${String(i+1).padStart(2,'0')}`)}),
  ...steps.rulesOn({as:'rules',from:'weeks',units:{cum_w04:'cases',cum_w05:'cases'},columns:11}),
  ...addEvery(0),...computed(0,'new cases week 5',{column:'cum_w05'},'-',{column:'cum_w04'},{unit:'cases'}),
  {see:'East named: no value, its week 5 missing',within:'#rule-editor .rule-live-summary',
    check:'1 record has no value, because a value to compute from is missing.'},
  ...steps.keep(),
  ...steps.output({as:'shown',from:'rules'}),
  {see:'North 11, South 9',check:'new cases week 5'}]});

writeFileSync(new URL('../manual.json',import.meta.url),JSON.stringify({
  schema:'fieldwork/worked-example-manual/1',example:'urn:fieldwork:example:workflows-rulesets',
  intro:'Each workflow reads a made-up table from this repository, at a fixed commit, and builds its rules in Apply ruleset’s dialog. Start from an empty canvas: Project, then New project.',
  workflows},null,1)+'\n');
console.log('wrote manual.json:',workflows.map(w=>`${w.name} (${w.steps.length} steps)`).join('; '));
