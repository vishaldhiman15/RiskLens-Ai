const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'frontend/css/style.css');
const content = fs.readFileSync(cssPath, 'utf8');

const baseContent = [];
const layoutContent = [];
const componentsContent = [];
const animationsContent = [];
const remainingContent = [];

let currentSection = 'base';

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('/* ============ APP LAYOUT (CHAINX STYLE) ============ */') || 
      line.includes('/* SIDEBAR */') || 
      line.includes('/* MAIN CONTENT WITH TOPBAR */') ||
      line.includes('/* ============ DASHBOARD REDESIGN (CHAINX STYLE) ============ */')) {
    currentSection = 'layout';
  } else if (line.includes('/* ============ GLASS CARDS ============ */') ||
             line.includes('/* ============ NAVBAR ============ */') ||
             line.includes('/* ============ BUTTONS ============ */') ||
             line.includes('/* ============ INPUTS ============ */') ||
             line.includes('/* ============ SEARCH BAR ============ */') ||
             line.includes('/* ============ STOCK CARDS ============ */') ||
             line.includes('/* ============ SIGNAL BADGES ============ */') ||
             line.includes('/* ============ TABLE ============ */') ||
             line.includes('/* ============ TOAST ============ */') ||
             line.includes('/* ============ LOADING ============ */')) {
    currentSection = 'components';
  } else if (line.includes('/* ============ ANIMATED BACKGROUND ============ */')) {
    currentSection = 'animations';
  } else if (line.includes('/* ============ CHART CONTAINER ============ */') ||
             line.includes('/* ============ SCORE GAUGE ============ */') ||
             line.includes('/* ============ HERO / LANDING ============ */') ||
             line.includes('/* ============ TICKER BANNER ============ */') ||
             line.includes('/* ============ FEATURES SECTION ============ */') ||
             line.includes('/* ============ AUTH FORMS ============ */') ||
             line.includes('/* ============ DASHBOARD LAYOUT ============ */') ||
             line.includes('/* ============ MARKET TABS ============ */') ||
             line.includes('/* ============ ANALYSIS PANEL ============ */') ||
             line.includes('/* ============ FORECAST CARD ============ */') ||
             line.includes('/* ============ MISC ============ */') ||
             line.includes('/* ============ STATS GRID ============ */') ||
             line.includes('/* ============ NEWS CARD ============ */')) {
    currentSection = 'remaining';
  }

  // Optimize animations while copying
  let optimizedLine = line;
  if (currentSection === 'animations' && line.includes('filter: blur(80px);')) {
    optimizedLine = '  filter: blur(50px);\n  will-change: transform; /* OPTIMIZED */';
  }

  if (currentSection === 'base') {
    baseContent.push(optimizedLine);
  } else if (currentSection === 'layout') {
    layoutContent.push(optimizedLine);
  } else if (currentSection === 'components') {
    componentsContent.push(optimizedLine);
  } else if (currentSection === 'animations') {
    animationsContent.push(optimizedLine);
  } else if (currentSection === 'remaining') {
    remainingContent.push(optimizedLine);
  }
}

fs.writeFileSync(path.join(__dirname, 'frontend/css/base.css'), baseContent.join('\n'));
fs.writeFileSync(path.join(__dirname, 'frontend/css/layout.css'), layoutContent.join('\n'));
fs.writeFileSync(path.join(__dirname, 'frontend/css/components.css'), componentsContent.join('\n'));
fs.writeFileSync(path.join(__dirname, 'frontend/css/animations.css'), animationsContent.join('\n'));
fs.writeFileSync(cssPath, remainingContent.join('\n'));

console.log('CSS split successful.');
