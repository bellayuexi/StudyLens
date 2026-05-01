const storage = require('./core/storage');

const entries = [
  // 隋唐 - 政治
  { title: '隋朝统一全国', content: '589年，隋文帝杨坚灭陈，结束长期分裂局面，顺应民族交融趋势。', subject: '历史-隋唐', tags: ['隋朝','统一','隋文帝'], source_type: 'text' },
  { title: '大运河', content: '隋炀帝开凿，以洛阳为中心，北抵涿郡（今北京），南至余杭（今杭州），沟通五大水系（海河、黄河、淮河、长江、钱塘江），促进南北政治经济交流。', subject: '历史-隋唐', tags: ['隋朝','大运河','隋炀帝','交通'], source_type: 'text' },
  { title: '科举制创立', content: '隋文帝开始用分科考试选拔官员；隋炀帝正式设置进士科，标志科举制正式确立。', subject: '历史-隋唐', tags: ['科举制','隋朝','制度创新'], source_type: 'text' },
  { title: '贞观之治', content: '唐太宗吸取隋亡教训，虚心纳谏（魏征），完善三省六部制，增加科举考试科目，减轻百姓负担。', subject: '历史-隋唐', tags: ['唐朝','唐太宗','贞观之治','盛世'], source_type: 'text' },
  { title: '女皇武则天', content: '中国历史上唯一的女皇帝。创立殿试制度，继续推行减轻百姓负担的政策，为"开元盛世"奠定基础（"政启开元，治宏贞观"）。', subject: '历史-隋唐', tags: ['唐朝','武则天','殿试'], source_type: 'text' },
  { title: '开元盛世', content: '唐玄宗时期，唐朝国力达到顶峰。政治清明，经济空前繁荣。', subject: '历史-隋唐', tags: ['唐朝','唐玄宗','开元盛世','盛世'], source_type: 'text' },
  { title: '安史之乱', content: '755-763年，安禄山、史思明发动。导致唐朝由盛转衰，形成藩镇割据局面。', subject: '历史-隋唐', tags: ['唐朝','安史之乱','衰落','藩镇割据'], source_type: 'text' },
  { title: '唐朝灭亡', content: '907年，朱温建立后梁，唐朝灭亡。', subject: '历史-隋唐', tags: ['唐朝','灭亡','五代十国'], source_type: 'text' },

  // 隋唐 - 经济
  { title: '唐朝农业创新', content: '发明并推广曲辕犁（耕地）和筒车（灌溉），大幅提高农业生产效率。', subject: '历史-隋唐', tags: ['唐朝','农业','曲辕犁','筒车'], source_type: 'text' },
  { title: '唐朝手工业', content: '陶瓷业发达：越窑青瓷（如冰如玉）、邢窑白瓷（类银类雪）、唐三彩（造型精美，色彩亮丽）。', subject: '历史-隋唐', tags: ['唐朝','手工业','陶瓷','唐三彩'], source_type: 'text' },
  { title: '唐都长安', content: '当时中国政治、经济、文化中心，也是国际性大都市。城内分为"坊"（居民区）和"市"（商业区）。', subject: '历史-隋唐', tags: ['唐朝','长安','商业','都城'], source_type: 'text' },

  // 隋唐 - 民族关系
  { title: '唐朝民族政策', content: '唐朝实行开明民族政策，唐太宗被尊称为"天可汗"。体现"和同为一家"的理念。', subject: '历史-隋唐', tags: ['唐朝','民族关系','天可汗'], source_type: 'text' },
  { title: '文成公主入藏', content: '唐太宗时文成公主入藏嫁给松赞干布；唐中宗时金城公主入藏。促进了吐蕃（藏族祖先）经济和社会发展。', subject: '历史-隋唐', tags: ['唐朝','吐蕃','文成公主','民族交融'], source_type: 'text' },

  // 隋唐 - 对外交流
  { title: '遣唐使', content: '日本派遣使节来华学习，仿效唐朝制度进行改革。', subject: '历史-隋唐', tags: ['唐朝','日本','对外交流'], source_type: 'text' },
  { title: '鉴真东渡', content: '唐玄宗时期，鉴真六次东渡日本，传授佛经，传播中国文化（建筑、医药等），设计唐招提寺。', subject: '历史-隋唐', tags: ['唐朝','鉴真','日本','佛教'], source_type: 'text' },
  { title: '玄奘西行', content: '唐太宗时期，玄奘前往天竺（印度）取经，回国后口述完成《大唐西域记》，是研究中外交流史的珍贵文献。', subject: '历史-隋唐', tags: ['唐朝','玄奘','天竺','大唐西域记'], source_type: 'text' },

  // 隋唐 - 科技文化
  { title: '赵州桥', content: '隋朝李春设计，世界上现存最古老的石拱桥。', subject: '历史-隋唐', tags: ['隋朝','赵州桥','建筑','李春'], source_type: 'text' },
  { title: '雕版印刷术', content: '隋唐时期发明雕版印刷术，唐朝印制的《金刚经》是世界上现存最早的、标有确切日期的雕版印刷品。', subject: '历史-隋唐', tags: ['唐朝','印刷术','金刚经','科技'], source_type: 'text' },
  { title: '唐诗三大家', content: '李白（诗仙）：豪迈奔放，代表作《早发白帝城》《蜀道难》。杜甫（诗圣）：反映社会现实，代表作"三吏""三别"。白居易：通俗易懂，代表作《秦中吟》《新乐府》。', subject: '历史-隋唐', tags: ['唐朝','唐诗','李白','杜甫','白居易'], source_type: 'text' },
  { title: '唐朝书画艺术', content: '"画圣"吴道子（《送子天王图》）；颜真卿和柳公权的书法（"颜筋柳骨"）。', subject: '历史-隋唐', tags: ['唐朝','书画','吴道子','颜真卿','柳公权'], source_type: 'text' },

  // 宋朝 - 政治
  { title: '北宋建立', content: '960年，赵匡胤（宋太祖）发动陈桥兵变（黄袍加身），建立北宋，定都东京（今开封）。', subject: '历史-宋朝', tags: ['北宋','赵匡胤','陈桥兵变'], source_type: 'text' },
  { title: '北宋强化中央集权', content: '军事：杯酒释兵权，兵不识将将不识兵。行政：分化事权削弱相权，派文臣任知州设通判。财政：设转运使收归地方财税。', subject: '历史-宋朝', tags: ['北宋','中央集权','杯酒释兵权'], source_type: 'text' },
  { title: '重文轻武政策', content: '北宋抑制武将，提升文官地位，改革科举制。有利于政权稳固，但导致军队战斗力减弱。', subject: '历史-宋朝', tags: ['北宋','重文轻武','科举'], source_type: 'text' },
  { title: '王安石变法', content: '宋神宗时期，旨在富国强兵（如募役法、方田均税法），但因触犯大官僚利益而失败。', subject: '历史-宋朝', tags: ['北宋','王安石','变法','改革'], source_type: 'text' },

  // 宋朝 - 民族政权并立
  { title: '辽（契丹）', content: '契丹族耶律阿保机建立，都城上京。与北宋签订澶渊之盟（宋给岁币，保持和平）。', subject: '历史-宋朝', tags: ['辽','契丹','澶渊之盟','耶律阿保机'], source_type: 'text' },
  { title: '西夏（党项）', content: '党项族元昊建立，都城兴庆。宋夏议和（元昊称臣，宋给岁币）。', subject: '历史-宋朝', tags: ['西夏','党项','元昊'], source_type: 'text' },
  { title: '金（女真）', content: '女真族完颜阿骨打建立，都城会宁。1125年灭辽，1127年灭北宋（靖康之耻）。', subject: '历史-宋朝', tags: ['金','女真','靖康之耻','完颜阿骨打'], source_type: 'text' },
  { title: '南宋建立与宋金对峙', content: '赵构建立南宋，都城临安（杭州）。岳飞抗金（郾城大捷）；宋金和议（南宋称臣，划界淮水至大散关）。', subject: '历史-宋朝', tags: ['南宋','赵构','岳飞','宋金和议'], source_type: 'text' },

  // 宋朝 - 经济
  { title: '经济重心南移', content: '从唐朝中期开始，到南宋时期最后完成。核心特征：南方经济超过北方。', subject: '历史-宋朝', tags: ['经济重心南移','南宋','经济'], source_type: 'text' },
  { title: '宋代农业发展', content: '引入占城稻（越南），水稻产量跃居粮食作物首位。"苏湖熟，天下足"表明太湖流域成为粮仓。棉花种植推广到长江流域。', subject: '历史-宋朝', tags: ['宋朝','农业','占城稻','太湖流域'], source_type: 'text' },
  { title: '宋代手工业', content: '景德镇发展为著名瓷都。造船业世界领先：广州、泉州、明州；北宋东京郊外建有世界最早船坞；海船配备指南针。', subject: '历史-宋朝', tags: ['宋朝','手工业','景德镇','造船'], source_type: 'text' },
  { title: '交子（最早纸币）', content: '北宋前期，四川地区出现"交子"，是世界上最早的纸币。', subject: '历史-宋朝', tags: ['北宋','交子','纸币','金融创新'], source_type: 'text' },
  { title: '宋代商业繁荣', content: '打破"坊""市"界限，出现早市和夜市。设立市舶司管理海外贸易；广州、泉州是大商港。', subject: '历史-宋朝', tags: ['宋朝','商业','市舶司','海外贸易'], source_type: 'text' },

  // 宋元 - 科技文化
  { title: '活字印刷术', content: '北宋毕昇发明，比欧洲早约400年。', subject: '历史-宋元', tags: ['北宋','毕昇','活字印刷','四大发明'], source_type: 'text' },
  { title: '指南针用于航海', content: '北宋时开始用于航海，促进了海外贸易和航海事业发展。', subject: '历史-宋元', tags: ['北宋','指南针','航海','四大发明'], source_type: 'text' },
  { title: '火药广泛应用', content: '唐朝发明火药，宋元时期广泛用于战争。', subject: '历史-宋元', tags: ['火药','军事','四大发明'], source_type: 'text' },
  { title: '宋词', content: '豪放派：苏轼、辛弃疾。婉约派：李清照。宋词是宋代文学的最高成就。', subject: '历史-宋元', tags: ['宋词','苏轼','辛弃疾','李清照'], source_type: 'text' },
  { title: '元曲', content: '关汉卿《窦娥冤》是元曲代表作。', subject: '历史-宋元', tags: ['元曲','关汉卿','窦娥冤'], source_type: 'text' },
  { title: '资治通鉴', content: '北宋司马光主持编写，是一部编年体通史巨著（从战国到五代）。', subject: '历史-宋元', tags: ['北宋','司马光','资治通鉴','史学'], source_type: 'text' },
  { title: '宋代都市生活', content: '开封和临安城内有"瓦子"（娱乐兼营商业场所），里面有"勾栏"（专供演出的圈子）。', subject: '历史-宋元', tags: ['宋朝','瓦子','勾栏','都市生活'], source_type: 'text' },

  // 元朝
  { title: '元朝建立', content: '1271年，忽必烈（元世祖）改国号为元，定都大都（今北京）。', subject: '历史-宋元', tags: ['元朝','忽必烈','大都'], source_type: 'text' },
  { title: '行省制度', content: '元朝在中央设中书省，地方设行中书省。是中国省制的开端。', subject: '历史-宋元', tags: ['元朝','行省制','中书省','制度'], source_type: 'text' },
  { title: '元朝边疆管辖', content: '台湾：设澎湖巡检司（中央政府首次在台湾正式建立行政机构）。西藏：由宣政院直接统辖，正式成为中央直接管辖的行政区域。', subject: '历史-宋元', tags: ['元朝','台湾','西藏','边疆管辖'], source_type: 'text' },
];

// Build connection map based on shared tags
function findRelatedPairs(allEntries) {
  const connections = [];
  for (let i = 0; i < allEntries.length; i++) {
    for (let j = i + 1; j < allEntries.length; j++) {
      const shared = allEntries[i].tags.filter(t => allEntries[j].tags.includes(t));
      if (shared.length >= 2 || (shared.length === 1 && allEntries[i].subject === allEntries[j].subject && shared[0] !== '唐朝' && shared[0] !== '北宋' && shared[0] !== '宋朝')) {
        connections.push({ from: i, to: j, relation: `共同标签: ${shared.join(', ')}` });
      }
    }
  }
  return connections;
}

// Insert all
const created = entries.map(e => storage.addEntry(e));
console.log(`Added ${created.length} knowledge entries`);

const connections = findRelatedPairs(entries);
let connCount = 0;
for (const c of connections) {
  storage.addConnection(created[c.from].id, created[c.to].id, c.relation);
  connCount++;
}
console.log(`Added ${connCount} connections`);

process.exit(0);
