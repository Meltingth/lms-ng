import { describe, expect, it } from 'vitest';
import { createFixtureSnapshot, fixtureFrame } from './scenarios';
import { createMockAdapter } from '../realtime/client';
import { createRealtimeStore } from '../realtime/store';
import { toElevatorViewModel } from '../model/viewModel';

describe('sanitized literal floor fixture consistency',()=>{
  it('matches passenger baseline and confirmed-step pairs from database/seeds/whz.sql',()=>{
    const store=createRealtimeStore({now:()=>0});const adapter=createMockAdapter(store,{autoTick:false});adapter.start();
    expect(store.getSnapshot().elevators.slice(0,4).map(lift=>[lift.floorRaw,lift.floorDisplay])).toEqual([['22','20'],['34','32'],['2','1'],['2','1']]);
    adapter.step();expect(store.getSnapshot().elevators.slice(0,2).map(lift=>[lift.floorRaw,lift.floorDisplay])).toEqual([['23','21'],['33','31']]);
    adapter.step();expect(store.getSnapshot().elevators.slice(0,2).map(lift=>[lift.floorRaw,lift.floorDisplay])).toEqual([['22','20'],['34','32']]);adapter.dispose();
  });
  it('preserves the three explicitly confirmed W-05 landing fixtures',()=>{
    // These literal fixtures stand in for backend responses; there is no frontend code-to-floor mapper.
    const landings=[{floorRaw:'1',floorDisplay:'B1',displayAnchor:0},{floorRaw:'2',floorDisplay:'1',displayAnchor:0.04},{floorRaw:'47',floorDisplay:'44',displayAnchor:1}];
    for(const landing of landings) {
      const store=createRealtimeStore({now:()=>0});const data=createFixtureSnapshot();
      Object.assign(data.elevators[4],landing,{floorKind:'LANDING'});
      expect(store.receive(fixtureFrame('snapshot',data))).toBe('accepted');
      const state=store.getSnapshot();const view=toElevatorViewModel(state.elevators[4],state);
      expect(view.floorLabel).toBe(landing.floorDisplay);expect(view.positionAnchor).toBe(landing.displayAnchor);
    }
  });
  it('keeps every W-05 middle-code fixture uncalibrated with no inferred shaft placement',()=>{
    const middleCodes=[
      ['3','code 3'],['4','code 4'],['5','code 5'],['6','code 6'],['7','code 7'],['8','code 8'],['9','code 9'],['10','code 10'],
      ['11','code 11'],['12','code 12'],['13','code 13'],['14','code 14'],['15','code 15'],['16','code 16'],['17','code 17'],['18','code 18'],
      ['19','code 19'],['20','code 20'],['21','code 21'],['22','code 22'],['23','code 23'],['24','code 24'],['25','code 25'],['26','code 26'],
      ['27','code 27'],['28','code 28'],['29','code 29'],['30','code 30'],['31','code 31'],['32','code 32'],['33','code 33'],['34','code 34'],
      ['35','code 35'],['36','code 36'],['37','code 37'],['38','code 38'],['39','code 39'],['40','code 40'],['41','code 41'],['42','code 42'],
      ['43','code 43'],['44','code 44'],['45','code 45'],['46','code 46'],
    ];
    expect(middleCodes).toHaveLength(44);
    for(const [floorRaw,floorDisplay] of middleCodes) {
      const store=createRealtimeStore({now:()=>0});const data=createFixtureSnapshot();
      Object.assign(data.elevators[4],{floorRaw,floorDisplay,floorKind:'UNCALIBRATED',displayAnchor:null});
      expect(store.receive(fixtureFrame('snapshot',data))).toBe('accepted');
      const state=store.getSnapshot();const view=toElevatorViewModel(state.elevators[4],state);
      expect(view.floorLabel).toBe(floorDisplay);expect(view.positionAnchor).toBeNull();expect(view.canAnimate).toBe(false);
    }
  });
});
