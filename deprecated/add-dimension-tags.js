const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'data', 'studygraph.db'));

// Dimension tag mapping based on content/title patterns
const DIMENSION_RULES = [
  { match: /科举|三省六部|殿试|中央集权|杯酒|相权|通判|变法|行省|中书省|政治|制度|政策|重文轻武|陈桥兵变/, tag: '政治制度' },
  { match: /安史之乱|战争|军事|抗金|岳飞|灭辽|灭北宋|靖康|澶渊|兵权|火药/, tag: '军事战争' },
  { match: /经济|农业|手工业|商业|曲辕犁|筒车|交子|纸币|市舶司|海外贸易|占城稻|景德镇|造船|丝|棉|瓷|陶|坊|市|经济重心/, tag: '经济发展' },
  { match: /民族|吐蕃|契丹|党项|女真|天可汗|文成公主|回纥|渤海|南诏/, tag: '民族关系' },
  { match: /遣唐使|鉴真|玄奘|东渡|西行|天竺|日本|对外/, tag: '对外交流' },
  { match: /印刷|指南针|赵州桥|大运河|科技|发明/, tag: '科技发明' },
  { match: /诗|词|曲|书法|画|文学|李白|杜甫|白居易|苏轼|辛弃疾|李清照|关汉卿|吴道子|颜真卿|柳公权|资治通鉴|司马光/, tag: '文化艺术' },
  { match: /瓦子|勾栏|都市|长安|夜市|生活/, tag: '社会生活' },
  { match: /台湾|西藏|澎湖|宣政院|边疆/, tag: '边疆管辖' },
  { match: /统一|灭陈|建立|盛世|衰亡|灭亡/, tag: '朝代兴衰' },
];

const PERSON_RULES = [
  { match: /隋文帝|杨坚/, tag: '人物' },
  { match: /隋炀帝/, tag: '人物' },
  { match: /唐太宗|李世民/, tag: '人物' },
  { match: /武则天/, tag: '人物' },
  { match: /唐玄宗/, tag: '人物' },
  { match: /赵匡胤|宋太祖/, tag: '人物' },
  { match: /王安石/, tag: '人物' },
  { match: /岳飞/, tag: '人物' },
  { match: /忽必烈/, tag: '人物' },
];

const entries = db.prepare('SELECT * FROM entries').all();
let updated = 0;

for (const e of entries) {
  const tags = JSON.parse(e.tags);
  const text = e.title + ' ' + e.content;
  const newTags = new Set(tags);

  for (const rule of DIMENSION_RULES) {
    if (rule.match.test(text)) newTags.add(rule.tag);
  }
  let hasPerson = false;
  for (const rule of PERSON_RULES) {
    if (rule.match.test(text)) hasPerson = true;
  }
  if (hasPerson) newTags.add('人物');

  const newTagsArr = [...newTags];
  if (newTagsArr.length !== tags.length) {
    db.prepare('UPDATE entries SET tags = ? WHERE id = ?').run(JSON.stringify(newTagsArr), e.id);
    console.log(`${e.title}: +${newTagsArr.length - tags.length} tags (${newTagsArr.filter(t => !tags.includes(t)).join(', ')})`);
    updated++;
  }
}

db.close();
console.log(`\nUpdated ${updated} / ${entries.length} entries with dimension tags`);
