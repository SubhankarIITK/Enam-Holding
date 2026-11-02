import {createElement as h} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Make verified [N] references part of the Markdown tree, so they work inside
// paragraphs, bold text, lists and tables without injecting raw HTML.
function sourceReferences({sourceIds}) {
  return tree => {
    function walk(node) {
      if (!node.children || ['link','linkReference','code','inlineCode','html'].includes(node.type)) return;
      node.children = node.children.flatMap(child => {
        if (child.type !== 'text') {walk(child);return [child];}
        const pieces=[];let start=0;
        for (const match of child.value.matchAll(/\[(\d+)\]/g)) {
          const id=Number(match[1]);
          if(!sourceIds.has(id)) continue;
          if(match.index>start) pieces.push({type:'text',value:child.value.slice(start,match.index)});
          pieces.push({type:'link',url:`#finn-source-${id}`,children:[{type:'text',value:match[0]}]});
          start=match.index+match[0].length;
        }
        if(start<child.value.length) pieces.push({type:'text',value:child.value.slice(start)});
        return pieces.length?pieces:[child];
      });
    }
    walk(tree);
  };
}

export default function ResearchMarkdown({text,sources=[],onSource=()=>{}}) {
  const sourceIds=new Set(sources.map(source=>source.citation));
  return h('div',{className:'research-markdown'},h(ReactMarkdown,{
    remarkPlugins:[remarkGfm,[sourceReferences,{sourceIds}]],
    skipHtml:true,
    components:{
      h1:({children})=>h('h3',null,children),
      h2:({children})=>h('h3',null,children),
      h3:({children})=>h('h3',null,children),
      table:({children})=>h('div',{className:'markdown-table'},h('table',null,children)),
      a:({href,children})=>{
        const match=href?.match(/^#finn-source-(\d+)$/);
        const source=match&&sources.find(s=>s.citation===Number(match[1]));
        if(source) return h('button',{type:'button',className:'citation','aria-label':`Read source ${source.citation}`,onClick:()=>onSource(source)},children);
        // Research evidence is opened through the verified source list.
        return h('span',null,children);
      },
      // Do not load images from model-generated URLs.
      img:({alt})=>alt?h('span',{className:'muted'},alt):null
    }
  },text||''));
}
