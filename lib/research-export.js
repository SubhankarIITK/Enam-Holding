export function researchMarkdown(analysis){
  const lines=[`# ${analysis.ticker} research`, '',analysis.question,'',analysis.answer,'','## Evidence',''];
  for(const source of analysis.sources||[]){lines.push(`[${source.citation}] ${source.title} — ${source.period}, page ${source.page}`);if(source.url)lines.push(`Source: ${source.url}`);lines.push('',String(source.text||'').split('\n').map(line=>'> '+line).join('\n'),'');}
  lines.push(`Generated: ${analysis.generatedAt||'not recorded'}`,'','Generated from primary-source excerpts. Check material claims against the original documents.');return lines.join('\n');
}
