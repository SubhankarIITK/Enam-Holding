import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ResearchMarkdown from '../components/ResearchMarkdown.js';

const render=text=>renderToStaticMarkup(createElement(ResearchMarkdown,{text,sources:[{citation:1,title:'Annual report',page:2}]}));

test('research renders bold labels, headings, lists and paragraph breaks',()=>{
  const html=render('## Financial snapshot\n\n**Revenue** — ₹164,000 cr. [1]\n\n- Cash generation improved.\n- **Debt:** ₹4,000 cr.\n\nA separate paragraph.');
  assert.match(html,/<h3>Financial snapshot<\/h3>/);
  assert.match(html,/<strong>Revenue<\/strong>/);
  assert.match(html,/<ul>/);
  assert.match(html,/<li>/);
  assert.match(html,/<strong>Debt:<\/strong>/);
  assert.match(html,/<p>A separate paragraph\.<\/p>/);
  assert.doesNotMatch(html,/\*\*Revenue\*\*/);
});

test('verified citations stay actionable inside bold text and tables',()=>{
  const html=render('**Evidence [1]**\n\n| Metric | Value |\n| --- | --- |\n| Revenue | 100 [1] |');
  assert.match(html,/<table>/);
  assert.match(html,/<th>Metric<\/th>/);
  assert.equal((html.match(/aria-label="Read source 1"/g)||[]).length,2);
  assert.match(html,/class="markdown-table"/);
  assert.doesNotMatch(render('Unknown source [9]'),/aria-label="Read source 9"/);
});

test('model output cannot inject HTML, scripts or remotely loaded images',()=>{
  const html=render('<script>alert(1)</script>\n\n![tracking](https://example.com/pixel.png)\n\n[unsafe](javascript:alert)\n\n`[1]`');
  assert.doesNotMatch(html,/<script|<img|javascript:|href=/);
  assert.match(html,/<code>\[1\]<\/code>/);
  assert.doesNotMatch(html,/aria-label="Read source 1"/);
});
