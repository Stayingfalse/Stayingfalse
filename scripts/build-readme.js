#!/usr/bin/env node
'use strict';
// Generates README.md (the GitHub profile README) from content/profile.json.
// Run: npm run readme      Check only: npm run readme -- --check
const fs = require('fs');
const path = require('path');
const { loadLocal } = require('./content');

const README = path.join(__dirname, '..', 'README.md');

function link(text, url) {
  return url ? `[${text}](${url})` : text;
}

function render(p) {
  const out = [];
  out.push(`<!-- Generated from content/profile.json by scripts/build-readme.js. Edit that file, not this one. -->`);
  out.push('');
  out.push(`# Hi, I'm ${p.name} 👋`);
  out.push('');
  out.push(`> ${p.tagline}`);
  out.push('');
  if (p.socials.length) {
    out.push(p.socials.map((s) => `${s.emoji || ''} ${link(s.platform + (s.handle ? ` · **${s.handle}**` : ''), s.url)}`.trim()).join(' &nbsp;|&nbsp; '));
    out.push('');
  }
  for (const para of p.about) {
    out.push(para);
    out.push('');
  }
  if (p.site.url) {
    out.push(`🌐 **Full site:** ${p.site.url}`);
    out.push('');
  }

  if (p.highlights.length) {
    out.push('## ✨ What I do');
    out.push('');
    for (const h of p.highlights) {
      out.push(`### ${h.emoji || ''} ${link(h.title, h.url)}`.replace('###  ', '### '));
      out.push('');
      out.push(h.description);
      if (h.url) {
        out.push('');
        out.push(`👉 ${link(h.label || h.url, h.url)}`);
      }
      out.push('');
    }
  }

  const insta = p.socials.filter((s) => s.platform === 'Instagram');
  if (insta.length) {
    out.push('## 📸 On Instagram');
    out.push('');
    for (const s of insta) out.push(`- ${link('@' + s.handle, s.url)}${s.description ? `: ${s.description}` : ''}`);
    out.push('');
  }

  if (p.projectGroups.length) {
    out.push('## 🧰 Core repos');
    out.push('');
    for (const g of p.projectGroups) {
      out.push(`### ${g.emoji || ''} ${g.title}`.replace('###  ', '### '));
      out.push('');
      out.push('| Repo | What it does |');
      out.push('| --- | --- |');
      for (const pr of g.projects) {
        const name = `${pr.featured ? '⭐ ' : ''}${link(`**${pr.name}**`, pr.url)}`;
        out.push(`| ${name} | ${(pr.description || '').replace(/\|/g, '\\|')} |`);
      }
      out.push('');
    }
  }

  out.push('---');
  out.push('');
  out.push(`<sub>This profile and my website are built from the same file, [\`content/profile.json\`](content/profile.json), in [${p.handle}/${p.handle}](https://github.com/${p.handle}/${p.handle}).</sub>`);
  out.push('');
  return out.join('\n');
}

if (require.main === module) {
  const md = render(loadLocal());
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(README) ? fs.readFileSync(README, 'utf8') : '';
    if (current !== md) {
      console.error('README.md is out of date. Run: npm run readme');
      process.exit(1);
    }
    console.log('README.md is up to date.');
  } else {
    fs.writeFileSync(README, md);
    console.log('Wrote README.md');
  }
}

module.exports = { render };
