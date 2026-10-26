import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLrc,parseYrc,buildLyrics,createClock} from '../plugin/lyrics.mjs';
test('YRC preserves absolute syllable timing, zero-duration punctuation and spaces',()=>{
  const [line]=parseYrc('[1000,900](1000,300,0)Hello (1300,0,0),(1300,600,0)世界');
  assert.deepEqual(line.words,[{startTime:1000,endTime:1300,word:'Hello '},{startTime:1300,endTime:1300,word:','},{startTime:1300,endTime:1900,word:'世界'}]);
  assert.equal(line.endTime,1900);
});
test('malformed rows and metadata do not create timing',()=>{
  assert.deepEqual(parseYrc('{"t":0,"c":[]}\n[invalid]\n[1,5]without word marks'),[]);
});
test('LRC multiple tags retain exact subsecond values',()=>{
  assert.deepEqual(parseLrc('[00:01.250][01:02.50]text'),[{startTime:1250,text:'text'},{startTime:62500,text:'text'}]);
});
test('YRC translation follows YRC timestamps rather than earlier LRC timing',()=>{
  const data=buildLyrics({yrcInfo:{yrc:'[1250,500](1250,200,0)A (1450,300,0)B',yrcTrans:'[00:01.250]译文'},translationEnable:true,lyricLines:[{time:0,lyric:'old'}]},5000);
  assert.equal(data.mode,'word');assert.equal(data.lines[0].translatedLyric,'译文');assert.equal(data.lines[0].startTime,1250);
});
test('plain LRC stays line mode and does not invent word timestamps',()=>{
  const data=buildLyrics({lyricLines:[{time:1,lyric:'one two'},{time:3,lyric:'next'}]},5000);
  assert.equal(data.mode,'line');assert.equal(data.lines[0].words.length,1);assert.equal(data.lines[1].endTime,5000);
});
test('native clock advances with playback and freezes on pause',()=>{
  const c=createClock();c.sample(1000,0);c.state(0,true,1);assert.equal(c.read(250),1250);
  c.state(250,false);assert.equal(c.read(1250),1250);
});
test('clock honors speed and detects actual seeks',()=>{
  const c=createClock();c.sample(1000,0);c.state(0,true,2);assert.equal(c.read(100),1200);
  assert.equal(c.sample(1205,100),false);assert.equal(c.sample(6000,150,true),true);assert.equal(c.read(150),6000);
});
test('missing progress heartbeat cannot drift without bound',()=>{
  const c=createClock();c.sample(0,0);c.state(0,true);assert.equal(c.read(20000),1500);
});
