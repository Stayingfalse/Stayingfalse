'use strict';
// Shared loader for content/profile.json. Both the README generator and the
// website use this, so the repo has one source of truth.
const fs = require('fs');
const path = require('path');

const CONTENT_FILE = path.join(__dirname, '..', 'content', 'profile.json');

function normalise(raw) {
  const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!p || typeof p !== 'object') throw new Error('profile must be a JSON object');
  if (!p.name) throw new Error('profile.name is required');
  p.about = p.about || [];
  p.site = p.site || {};
  p.highlights = p.highlights || [];
  p.socials = (p.socials || []).filter((s) => s.enabled !== false);
  p.projectGroups = (p.projectGroups || []).map((g) => ({
    ...g,
    projects: (g.projects || []).map((pr) => ({
      ...pr,
      url: pr.url || (pr.repo ? `https://github.com/${pr.repo}` : ''),
    })),
  }));
  return p;
}

function loadLocal() {
  return normalise(fs.readFileSync(CONTENT_FILE, 'utf8'));
}

module.exports = { CONTENT_FILE, normalise, loadLocal };
