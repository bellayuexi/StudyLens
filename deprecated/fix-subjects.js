const storage = require('./core/storage');

// Fix all entries: normalize subjects to individual dynasties
const entries = storage.getAllEntries();
let fixed = 0;

for (const e of entries) {
  let newSubject = e.subject;
  let newTags = [...e.tags];

  // Split "历史-隋唐" into proper dynasty
  if (e.subject === '历史-隋唐') {
    const content = e.content + ' ' + e.title + ' ' + e.tags.join(' ');
    const isSui = content.includes('隋') && !content.includes('唐');
    const isTang = content.includes('唐') && !content.includes('隋');
    const hasBoth = content.includes('隋') && content.includes('唐');

    if (isSui || e.tags.includes('隋朝')) {
      newSubject = '历史-隋朝';
      newTags = newTags.filter(t => t !== '隋唐').concat(newTags.includes('隋朝') ? [] : ['隋朝']);
    } else if (isTang || e.tags.includes('唐朝')) {
      newSubject = '历史-唐朝';
      newTags = newTags.filter(t => t !== '隋唐').concat(newTags.includes('唐朝') ? [] : ['唐朝']);
    } else if (hasBoth) {
      // Check more context: if 隋 is the main subject
      if (e.title.includes('隋') || (e.content.indexOf('隋') < e.content.indexOf('唐'))) {
        newSubject = '历史-隋朝';
      } else {
        newSubject = '历史-唐朝';
      }
    }
  }

  // Split "历史-宋元" into proper dynasty
  if (e.subject === '历史-宋元') {
    const content = e.content + ' ' + e.title + ' ' + e.tags.join(' ');
    if (e.tags.includes('元朝') || e.title.includes('元朝') || e.title.includes('行省')) {
      newSubject = '历史-元朝';
    } else if (e.tags.includes('北宋') || content.includes('北宋') || content.includes('毕昇')) {
      newSubject = '历史-北宋';
    } else if (content.includes('宋词') || content.includes('宋')) {
      newSubject = '历史-宋朝';
    } else {
      newSubject = '历史-宋朝';
    }
  }

  // Split "历史-宋朝" more precisely
  if (e.subject === '历史-宋朝') {
    const content = e.content + ' ' + e.title + ' ' + e.tags.join(' ');
    if (e.tags.includes('南宋') || content.includes('南宋')) {
      newSubject = '历史-南宋';
    } else if (e.tags.includes('北宋') || content.includes('北宋') || content.includes('赵匡胤')) {
      newSubject = '历史-北宋';
    }
    // entries about 辽/西夏/金
    if (e.tags.includes('辽') || e.tags.includes('契丹')) newSubject = '历史-辽';
    if (e.tags.includes('西夏') || e.tags.includes('党项')) newSubject = '历史-西夏';
    if (e.tags.includes('金') || e.tags.includes('女真')) newSubject = '历史-金';
  }

  if (newSubject !== e.subject || JSON.stringify(newTags) !== JSON.stringify(e.tags)) {
    const db = require('./core/storage');
    // Direct DB update
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbInst = new Database(path.join(__dirname, 'data', 'studygraph.db'));
    dbInst.prepare('UPDATE entries SET subject = ?, tags = ? WHERE id = ?')
      .run(newSubject, JSON.stringify(newTags), e.id);
    dbInst.close();
    console.log(`Fixed: "${e.title}" :: ${e.subject} -> ${newSubject}`);
    fixed++;
  }
}

console.log(`\nTotal fixed: ${fixed} / ${entries.length}`);
