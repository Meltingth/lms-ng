import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShaftOverview } from './ShaftOverview';
import { createFixtureSnapshot, fixtureFrame } from '../../fixtures/scenarios';
import { createRealtimeStore } from '../../realtime/store';
import { createMockAdapter } from '../../realtime/client';

import { OperationsHud } from '../hud/OperationsHud';

describe('motion-driven door glyphs', () => {
  it.each(['RUNNING','STOPPED','UNKNOWN'] as const)('uses %s consistently for all five icons without placing W05 on a floor', motion => {
    const data=createFixtureSnapshot();
    data.elevators.forEach(lift=>{lift.motion=motion;});
    const store=createRealtimeStore({now:()=>0});
    store.receive(fixtureFrame('snapshot',data));
    const {container}=render(<ShaftOverview state={store.getSnapshot()} selectedId="" onSelect={()=>{}} motionEnabled />);
    const glyphs=container.querySelectorAll('.car-doors');
    expect(glyphs).toHaveLength(5);
    glyphs.forEach(glyph=>expect(glyph).toHaveAttribute('data-door-visual',motion==='RUNNING'?'closed':motion==='STOPPED'?'open':'unknown'));
    expect(screen.queryByTestId('car-W-05')).not.toBeInTheDocument();
    expect(screen.getByTestId('unplaced-icon-W-05')).toBeVisible();
    expect(screen.getByText('POSITION UNKNOWN')).toBeVisible();
  });
  it.each(['stale','reconnect','gateway-offline'] as const)('does not present a current open door when %s', scenario => {
    const store=createRealtimeStore({now:()=>0});const data=createFixtureSnapshot(scenario==='reconnect'?'normal':scenario);
    data.elevators.forEach(lift=>{lift.motion='STOPPED';});
    store.receive(fixtureFrame('snapshot',data));if(scenario==='reconnect') store.disconnect();
    const {container}=render(<ShaftOverview state={store.getSnapshot()} selectedId="" onSelect={()=>{}} motionEnabled />);
    container.querySelectorAll('.car-doors').forEach(glyph=>{
      expect(glyph).toHaveAttribute('data-door-visual','unknown');
      expect(glyph).not.toHaveClass('doors-animate');
    });
  });
  it('keeps the stopped visual pose when operator animation is disabled', () => {
    const store=createRealtimeStore({now:()=>0});store.receive(fixtureFrame('snapshot',createFixtureSnapshot()));
    render(<ShaftOverview state={store.getSnapshot()} selectedId="" onSelect={()=>{}} motionEnabled={false} />);
    const glyph=screen.getByTestId('car-W-03').querySelector('.car-doors');
    expect(glyph).toHaveAttribute('data-door-visual','open');expect(glyph).not.toHaveClass('doors-animate');
  });
  it('toggles motion in the local scenario without changing floor, profile, or inventing door contacts', () => {
    const store=createRealtimeStore({now:()=>0});const adapter=createMockAdapter(store,{autoTick:false});adapter.start();adapter.setScenario('door-cycle');
    const original=store.getSnapshot().elevators.map(lift=>[lift.floorRaw,lift.floorDisplay,lift.displayAnchor,lift.floorProfileVersion,lift.serviceStatus]);
    adapter.step();expect(store.getSnapshot().elevators[0].motion).toBe('STOPPED');
    adapter.step();expect(store.getSnapshot().elevators[0].motion).toBe('RUNNING');
    expect(store.getSnapshot().elevators.map(lift=>[lift.floorRaw,lift.floorDisplay,lift.displayAnchor,lift.floorProfileVersion,lift.serviceStatus])).toEqual(original);
    store.getSnapshot().elevators.forEach(lift=>expect(lift.statusPoints).not.toHaveProperty('DOOR_OPEN'));
    adapter.dispose();
  });
  it('opens and closes the same DOM panes on new motion observations', () => {
    render(<OperationsHud />);
    fireEvent.change(screen.getByLabelText('เลือกสถานการณ์จำลอง'),{target:{value:'door-cycle'}});
    const glyph=screen.getByTestId('car-W-01').querySelector('.car-doors');
    expect(glyph).toHaveAttribute('data-door-visual','closed');
    fireEvent.click(screen.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}));
    expect(glyph).toHaveAttribute('data-door-visual','open');expect(glyph).toHaveClass('doors-animate');
    expect(within(screen.getByTestId('shaft-W-01')).getByText('20')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:/เดินข้อมูล 1 ขั้น/}));
    expect(glyph).toHaveAttribute('data-door-visual','closed');
  });
});
