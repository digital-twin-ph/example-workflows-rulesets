// Writes manual.json: the steps that build this example's four workflows in Fieldwork from an empty canvas.
// Nothing is random; running it again gives the same file. Usage: node scripts/make-manual.mjs <data commit>
import {writeFileSync} from 'node:fs';

const COMMIT=process.argv[2];
if(!/^[0-9a-f]{40}$/.test(COMMIT??''))throw new Error('Give the full commit the data files are read from.');
const RAW=`https://raw.githubusercontent.com/digital-twin-ph/example-workflows-rulesets/${COMMIT}/data/`;
const predicate=column=>`fwa:${column.replace(/[^A-Za-z0-9]+(.)/g,(_,c)=>c.toUpperCase()).replace(/[^A-Za-z0-9]/g,'')}`;
const RULES='Apply ruleset';

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
  rulesOn:({as,from,units,columns,records='table',port='subjects'})=>[
    {add:'apply_ruleset',as},{select:as},
    // CONFIGURE… OFFERS RULES WRITTEN HERE beside the published rulesets (Fieldwork experiments 186 and 192).
    {click:'#configure-step',label:'Configure\u2026',opens:RULES},
    {choose:'ruleset-choice',label:'Ruleset',value:'authored',shown:'Write rules for this step',dialog:RULES},
    {click:'#ruleset-config #config-apply',label:'Apply',dialog:RULES},
    {choose:'ruleset-records',label:'Records arrive as',value:records,shown:records==='table'?'A table':'Points',dialog:RULES},
    {click:'#rule-editor #config-apply',label:'Apply',dialog:RULES},
    {connect:{from,to:as,port}},
    {select:as},
    // The rules dialog takes the connected records' ${columns} columns, and each number they read is given its unit.
    {click:'#configure-step',label:'Configure\u2026',opens:RULES},
    ...Object.entries(units).map(([column,unit])=>({fill:`[aria-label="Unit for ${column}"]`,label:`Unit for ${column}`,value:unit,dialog:RULES}))],
  keep:()=>[{click:'#rule-editor #config-apply',label:'Apply',dialog:RULES}],
  output:({as,from,label})=>[
    {add:'table_output',as},
    {connect:{from,to:as,port:'table'}},
    {run:true}],
};

/** One rule's controls, named as the dialog names them. */
const at=(r,part,extra='')=>`[data-rule="${r}"]${extra}[data-part="${part}"]`;
const cond=(r,c,g=0)=>`[data-group="${g}"][data-condition="${c}"]`;
/** One condition. `concluded` names a column another rule gave a value, read by the name the rule gave it; `group` is the
 *  alternative it belongs to, the first by default. */
const condition=(r,c,{field,comparator,value,setting,shown,concluded=false,group=0})=>[
  ...(c?[{click:at(r,'add-condition',`[data-group="${group}"]`),label:'+ and'}]:[]),
  {choose:at(r,'field',cond(r,c,group)),label:'Field',value:concluded?`fwa:${field}`:predicate(field),shown:field},
  {choose:at(r,'comparator',cond(r,c,group)),label:'Comparator',value:comparator,shown},
  ...(setting?[{choose:at(r,'value-source',cond(r,c,group)),label:'Compared against',value:setting}]:[]),
  ...(value!==undefined?[{fill:at(r,'value',cond(r,c,group)),label:'Value',value:String(value)}]:[])];
/** An alternative: "or", then its conditions. */
const or=r=>[{click:at(r,'add-group'),label:'+ or'}];
/** A column's otherwise, the i-th: the column and the value a record takes where no rule gave it one. */
const otherwise=(i,column,value)=>[
  {click:'#rule-editor-add-otherwise',label:'+ Add an otherwise'},
  {choose:`[data-otherwise="${i}"][data-otherwise-part="column"]`,label:'Column the otherwise gives a value to',value:`fwa:${column}`,shown:column},
  {fill:`[data-otherwise="${i}"][data-otherwise-part="value"]`,label:'Value where no rule gave one',value}];
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

// 5. RULES ALL OF ONE KIND, CATEGORIES, which the N3 reasoner runs: no value is computed, so nothing is evaluated directly.
workflows.push({name:'Which visits had a fever? Rules the reasoner runs',steps:[
  ...steps.newWorkflow(),
  ...steps.name('Which visits had a fever? Rules the reasoner runs'),
  {note:'The same twelve visits, and rules that only band them. Rules that conclude categories and compute nothing are compiled to N3 and run by the reasoner, which records each conclusion in the evidence.'},
  {reuse:'table_input',from:'Which visits are under five, which had a fever, and what dose?',as:'visits'},
  ...steps.rulesOn({as:'rules',from:'visits',units:{age_years:'years',temperature_c:'degrees Celsius'},columns:6}),
  {click:'#rule-editor-add-setting',label:'+ Add a setting'},
  {fill:'[data-setting="0"][data-setting-part="name"]',label:'Setting name',value:'fever'},
  {fill:'[data-setting="0"][data-setting-part="value"]',label:'Setting value',value:'38'},
  {fill:'[data-setting="0"][data-setting-part="unit"]',label:'Setting unit',value:'degrees Celsius'},
  ...addRule(0),...condition(0,0,{field:'temperature_c',comparator:'greaterThan',shown:'is more than',setting:'fever'}),...category(0,'fever','Yes'),
  ...addRule(1),...condition(1,0,{field:'temperature_c',comparator:'notGreaterThan',shown:'is at most',setting:'fever'}),...category(1,'fever','No'),
  ...addRule(2),...condition(2,0,{field:'temperature_c',comparator:'__notRecorded',shown:'is not recorded'}),...category(2,'fever','NotMeasured'),
  ...addRule(3),...condition(3,0,{field:'age_years',comparator:'lessThan',shown:'is less than',value:5}),...category(3,'band','UnderFive'),
  ...addRule(4),...condition(4,0,{field:'age_years',comparator:'notLessThan',shown:'is at least',value:5}),...category(4,'band','FiveOrOver'),
  ...steps.keep(),
  ...steps.output({as:'shown',from:'rules'}),
  {see:'the same bands and fevers as the first workflow, concluded by the reasoner',check:'NotMeasured'}]});

// 6. RULES OVER POINTS, ON A MAP, and counts stored as text: read as numbers in Data quality, one left unread.
workflows.push({name:'Which clinics have the most cases?',steps:[
  ...steps.newWorkflow(),
  ...steps.name('Which clinics have the most cases?'),
  {note:'Seven made-up clinics, placed in open sea near 0° N, 0° E so that none looks real. The file stores each count as text: "34", not 34.'},
  {add:'point_input',as:'clinics'},{select:'clinics'},
  {click:'#edit-input-data',label:'Prepare input data',opens:'Input data'},
  {choose:'input-mode',label:'Input method',value:'geojson',shown:'Import GeoJSON'},
  {file:'input-file',label:'Local file \u00b7 5 MB maximum',path:'data/clinic-locations.geojson'},
  {click:'#input-apply',label:'Save Edits'},
  // The counts are offered as a category, because the file stores them as text. Say what they are.
  ...steps.rulesOn({as:'rules',from:'clinics',units:{},columns:2,records:'points'}),
  {choose:'[aria-label="Kind of cases"]',label:'Kind of cases',value:'number',shown:'number',dialog:RULES},
  {fill:'[aria-label="Unit for cases"]',label:'Unit for cases',value:'cases',dialog:RULES},
  ...addRule(0),...condition(0,0,{field:'cases',comparator:'lessThan',shown:'is less than',value:10}),...category(0,'burden','Low'),
  ...addRule(1),...condition(1,0,{field:'cases',comparator:'notLessThan',shown:'is at least',value:10}),
  ...condition(1,1,{field:'cases',comparator:'lessThan',shown:'is less than',value:30}),...category(1,'burden','Medium'),
  ...addRule(2),...condition(2,0,{field:'cases',comparator:'notLessThan',shown:'is at least',value:30}),...category(2,'burden','High'),
  ...steps.keep(),
  {note:'A map places points inside, on or outside an area: a box around the clinics, 10 by 8 km.'},
  {add:'study_area',as:'area'},{select:'area'},
  {click:'#edit-study-area',label:'Select area on map'},
  {click:'#area-sized-box summary',label:'Set a shape by centre coordinates'},
  {choose:'area-box-shape',label:'Shape',value:'rectangle'},
  {fill:'area-box-lon',label:'Centre longitude',value:'0.031'},
  {fill:'area-box-lat',label:'Centre latitude',value:'0.0175'},
  {fill:'area-box-width',label:'Width (metres)',value:'10000'},
  {fill:'area-box-height',label:'Height (metres)',value:'8000'},
  {click:'#area-box-create',label:'Use sized boundary'},
  {click:'#area-apply',label:'Apply study area'},
  {add:'map_output',as:'map'},
  {connect:{from:'area',to:'map',port:'area'}},
  {connect:{from:'rules',to:'map',port:'points'}},
  {note:'Colour each clinic by the burden its rules concluded.'},
  {select:'map'},
  {choose:'[data-pin-class]',label:'Pin class for Apply ruleset',value:'burden'},
  {run:true},
  {see:'every count unread: stored as text, so no rule could read it',within:'#toast',check:'7 records could not be read as declared'},
  {note:'Read the counts as numbers, where they are: open the clinics\u2019 rows.'},
  {select:'clinics'},
  {click:'[data-records-quicklook]',label:'Quick look'},
  {click:'[data-repair]',label:'Read 6 values as numbers'},
  {run:true},
  {see:'one count still unread: "about 5" is not a number, and no repair guesses one',within:'#toast',check:'1 record could not be read as declared'},
  {see:'the clinics coloured by burden on the map, its key naming each band',check:'Medium'}]});

// 7. A CASE DEFINITION IN STAGES (Fieldwork experiment 192): an ordered classification written as columns, each with an
// otherwise, and "is not" where a value must differ. The laboratory result, then a link to a confirmed case, then how the
// clinical definition was met, then the class read from all three. Then the classes counted, each with its share.
const is=(r,c,field,value,o={})=>condition(r,c,{field,comparator:'equals',shown:'is',value,...o});
const isNot=(r,c,field,value,o={})=>condition(r,c,{field,comparator:'notEquals',shown:'is not',value,...o});
const stage=(r,field,value,o)=>is(r,0,field,value,{concluded:true,...o});
workflows.push({name:'Which suspected cases meet the case definition?',steps:[
  ...steps.newWorkflow(),
  ...steps.name('Which suspected cases meet the case definition?'),
  {note:'Sixteen made-up suspected cases, shaped like a measles line list. A blank is a value not recorded, never a No. Each class below is reached, and each column’s otherwise is used.'},
  ...steps.importTable({as:'cases',file:'suspected-cases.csv',shape:'long',
    keys:['case_id','lab_result','contact','fever','rash','cough','coryza','conjunctivitis','clinician'],value:'age_years',unit:'years'}),
  ...steps.rulesOn({as:'rules',from:'cases',units:{},columns:10}),
  {note:'Stage 1, the laboratory result: positive, negative, or a result still awaited.'},
  ...addRule(0),...is(0,0,'lab_result','Positive'),...category(0,'lab','positive'),
  ...addRule(1),...is(1,0,'lab_result','Negative'),...category(1,'lab','negative'),
  ...addRule(2),...is(2,0,'lab_result','Pending'),...or(2),...is(2,0,'lab_result','Indeterminate',{group:1}),...category(2,'lab','awaiting'),
  {note:'Stage 2, a link to a confirmed case.'},
  ...addRule(3),...is(3,0,'contact','Yes'),...category(3,'link','linked'),
  {note:'Stage 3, how the clinical definition was met: fever and a rash, with cough, coryza or conjunctivitis, are three alternatives of one rule. A rash recorded as No fails it on the record itself.'},
  ...addRule(4),...is(4,0,'fever','Yes'),...is(4,1,'rash','Yes'),...is(4,2,'cough','Yes'),
  ...or(4),...is(4,0,'fever','Yes',{group:1}),...is(4,1,'rash','Yes',{group:1}),...is(4,2,'coryza','Yes',{group:1}),
  ...or(4),...is(4,0,'fever','Yes',{group:2}),...is(4,1,'rash','Yes',{group:2}),...is(4,2,'conjunctivitis','Yes',{group:2}),
  ...category(4,'definition','by symptoms'),
  ...addRule(5),...is(5,0,'rash','No'),...category(5,'definition','no rash'),
  {note:'Stage 4, the class, read from the three columns above. Every rule names what it reads, so no two can give one case two classes.'},
  ...addRule(6),...stage(6,'lab','positive'),...category(6,'class','Laboratory confirmed'),
  ...addRule(7),...stage(7,'lab','negative'),...category(7,'class','Discarded laboratory negative'),
  {note:'Is not: linked, and no positive or negative result. A result still awaited does not stop a link.'},
  ...addRule(8),...isNot(8,0,'lab','positive',{concluded:true}),...isNot(8,1,'lab','negative',{concluded:true}),
  ...is(8,2,'link','linked',{concluded:true}),...category(8,'class','Epidemiologically linked'),
  ...addRule(9),...stage(9,'lab','awaiting'),...is(9,1,'link','not linked',{concluded:true}),...category(9,'class','Awaiting a result'),
  ...addRule(10),...stage(10,'lab','none'),...is(10,1,'link','not linked',{concluded:true}),...is(10,2,'definition','by symptoms',{concluded:true}),
  ...category(10,'class','Clinically compatible'),
  ...addRule(11),...stage(11,'lab','none'),...is(11,1,'link','not linked',{concluded:true}),...is(11,2,'definition','no rash',{concluded:true}),
  ...category(11,'class','Discarded no rash'),
  ...addRule(12),...stage(12,'lab','none'),...is(12,1,'link','not linked',{concluded:true}),...is(12,2,'definition','not met',{concluded:true}),
  ...is(12,3,'clinician','Yes'),...category(12,'class','Clinically compatible by the clinician'),
  {note:'Each column’s otherwise: what a case takes where no rule gave the column a value. The class waits for the three it reads.'},
  ...otherwise(0,'lab','none'),...otherwise(1,'link','not linked'),...otherwise(2,'definition','not met'),
  ...otherwise(3,'class','Cannot be classified'),
  {see:'two cases took the class’s otherwise, named as a default and not a rule’s conclusion',within:'#rule-editor .rule-live-summary',
    check:"2 records took class's otherwise."},
  ...steps.keep(),
  {note:'Count the classes, each a share of all the cases.'},
  {add:'group_table',as:'classes'},
  {connect:{from:'rules',to:'classes',port:'records'}},
  {select:'classes'},
  {click:'#configure-step',label:'Configure…',opens:'Total within groups'},
  {tick:'group-keep',label:'Key columns to keep',values:['class'],dialog:'Total within groups'},
  {choose:'group-aggregate',label:'Aggregate',value:'count',shown:'Count rows',dialog:'Total within groups'},
  {click:'label:has(#group-share)',label:"Add each group's share, %",dialog:'Total within groups'},
  {click:'#config-apply',label:'Apply',dialog:'Total within groups'},
  ...steps.output({as:'shown',from:'classes'}),
  {see:'three clinically compatible by their symptoms, 18.8% of the sixteen',check:'18.8'},
  {see:'two that could not be classified',check:'Cannot be classified'}]});

writeFileSync(new URL('../manual.json',import.meta.url),JSON.stringify({
  schema:'fieldwork/worked-example-manual/1',example:'urn:fieldwork:example:workflows-rulesets',
  intro:'Each workflow reads a made-up table from this repository, at a fixed commit, and builds its rules in Apply ruleset’s dialog. Start from an empty canvas: Project, then New project.',
  workflows},null,1)+'\n');
console.log('wrote manual.json:',workflows.map(w=>`${w.name} (${w.steps.length} steps)`).join('; '));
