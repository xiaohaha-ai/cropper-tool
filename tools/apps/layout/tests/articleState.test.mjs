import test from 'node:test';
import assert from 'node:assert/strict';
import { copyArticle, sameArticle, reuseArticleBlocks } from '../src/articleState.ts';

const makeArticle = () => ({version:1,id:'article',title:'图文',description:'',author:'',link:'',cover:'',tags:['展览'],enhanced:false,theme:'',width:750,fontSize:16,lineHeight:1.5,letterSpacing:0,background:'#fff',updatedAt:1,
 blocks:[{id:'image',kind:'image',name:'图片',html:'<img src="data:image/png;base64,'+'a'.repeat(7_600_000)+'">',style:{padding:0},frame:{width:80,left:10,sourceWidth:700,sourceHeight:300,crop:{x:0,y:0,width:700,height:300}}},
 {id:'text',kind:'text',name:'正文',html:'<p>原文</p>',style:{fontSize:16}}]});

test('editable copies isolate tags, block order, style and nested crop from history', () => {
 const source=makeArticle(), snapshot=copyArticle(source), draft=copyArticle(source);
 draft.tags.push('新'); draft.blocks[0].style.padding=24; draft.blocks[0].frame.crop.x=30;
 draft.blocks[1].html='<p>修改</p>'; draft.blocks.reverse();
 assert.equal(sameArticle(source,snapshot),true);
 assert.equal(sameArticle(source,draft),false);
 assert.equal(source.tags.length,1);
 assert.equal(source.blocks[0].frame.crop.x,0);
});

test('editing text and reordering keep unchanged image blocks reusable without losing changes', () => {
 const source=makeArticle(), draft=copyArticle(source);
 draft.blocks[1].html='<p>修改</p>';
 const next=reuseArticleBlocks(source,draft);
 assert.equal(next.blocks[0],source.blocks[0]);
 assert.notEqual(next.blocks[1],source.blocks[1]);
 assert.equal(next.blocks[1].html,'<p>修改</p>');
 const reordered=copyArticle(next);reordered.blocks.reverse();
 const moved=reuseArticleBlocks(next,reordered);
 assert.equal(moved.blocks[0],next.blocks[1]);
 assert.equal(moved.blocks[1],source.blocks[0]);
 const metadata=reuseArticleBlocks(next,{...copyArticle(next),title:'新标题'});
 assert.equal(metadata.blocks,next.blocks);
});

test('revision equality ignores timestamps only and detects crop, style, order and text changes', () => {
 const source=makeArticle();
 assert.equal(sameArticle(source,{...source,updatedAt:2},true),true);
 assert.equal(sameArticle(source,{...source,updatedAt:2}),false);
 for (const edit of [a=>a.blocks.reverse(),a=>a.blocks[0].frame.crop.x=1,a=>a.blocks[0].style.padding=2,a=>a.blocks[1].html='新文字',a=>a.tags.push('新')]) {
  const next=copyArticle(source);edit(next);assert.equal(sameArticle(source,next,true),false);
 }
});
