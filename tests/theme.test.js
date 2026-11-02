import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {themeBootstrap} from '../lib/theme.js';

function firstPaint({saved,systemLight=false,blockedStorage=false}={}){
  const root={dataset:{},style:{}};
  runInNewContext(themeBootstrap,{document:{documentElement:root},localStorage:{getItem(){if(blockedStorage)throw new Error('Storage blocked');return saved;}},window:{matchMedia:()=>({matches:systemLight})}});
  return root;
}
test('saved appearance takes precedence over the device preference before hydration',()=>{
  assert.equal(firstPaint({saved:'light'}).dataset.theme,'light');
  assert.equal(firstPaint({saved:'dark',systemLight:true}).dataset.theme,'dark');
});
test('a new visitor follows the device theme and invalid stored values are ignored',()=>{
  assert.equal(firstPaint({systemLight:true}).style.colorScheme,'light');
  assert.equal(firstPaint({saved:'unexpected',systemLight:false}).dataset.theme,'dark');
});
test('appearance still initializes when browser storage is unavailable',()=>{
  assert.equal(firstPaint({blockedStorage:true,systemLight:true}).dataset.theme,'light');
});
