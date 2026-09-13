import { describe, expect, it } from 'vitest';
import { confirmPosition, initialMotion, renderedPosition, snapToConfirmed } from './motionController';
import { anchorToPercent } from './positionMapper';

describe('known-anchor motion',()=>{
  it('interpolates only between confirmed endpoints and never predicts another floor',()=>{
    const initial=confirmPosition(initialMotion,{anchor:0.45,revision:'1',now:0,animate:false});
    const moving=confirmPosition(initial,{anchor:0.475,revision:'2',now:100,animate:true,durationMs:1000});
    expect(moving.target).toBe(0.475);expect(renderedPosition(moving,100)).toBe(0.45);
    expect(renderedPosition(moving,500)).toBeGreaterThan(0.45);expect(renderedPosition(moving,500)).toBeLessThan(0.475);
    expect(renderedPosition(moving,50000)).toBe(0.475);
  });
  it('retargets from the visible position instead of queuing movement',()=>{
    const initial=confirmPosition(initialMotion,{anchor:0.45,revision:'1',now:0,animate:false});
    const moving=confirmPosition(initial,{anchor:0.475,revision:'2',now:0,animate:true,durationMs:1000});
    const visible=renderedPosition(moving,300);
    const next=confirmPosition(moving,{anchor:0.5,revision:'3',now:300,animate:true});expect(next.from).toBe(visible);expect(next.target).toBe(0.5);
  });
  it('ignores duplicate/older transitions and snaps when motion is disabled',()=>{
    const initial=confirmPosition(initialMotion,{anchor:0.45,revision:'9007199254740992',now:0,animate:false});
    const next=confirmPosition(initial,{anchor:0.475,revision:'9007199254740993',now:0,animate:true});
    expect(confirmPosition(next,{anchor:0.3,revision:'9007199254740992',now:100,animate:true})).toBe(next);
    expect(confirmPosition(next,{anchor:0.475,revision:'9007199254740993',now:100,animate:true})).toBe(next);
    const stopped=confirmPosition(next,{anchor:0.475,revision:'9007199254740993',now:100,animate:false});expect(renderedPosition(stopped,100)).toBe(0.475);
    expect(renderedPosition(snapToConfirmed(next,100),100)).toBe(0.475);
  });
  it('keeps unknown anchors unknown and rejects positions outside the fixture scale',()=>{
    expect(anchorToPercent(null)).toBeNull();expect(anchorToPercent(100)).toBeNull();expect(anchorToPercent(NaN)).toBeNull();
    expect(anchorToPercent(0)).toBe(100);expect(anchorToPercent(1)).toBe(0);
    expect(renderedPosition(confirmPosition(initialMotion,{anchor:null,revision:'1',now:0,animate:true}),1000)).toBeNull();
  });
});
