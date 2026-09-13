import { describe, expect, it } from 'vitest';
import { classifyGatewayHeartbeat, classifyRealTransportFreshness, classifySourceFreshness, elapsedAge, projectFieldTransportFreshness, projectServerConnection } from './freshness';

describe('Revised Plan exact freshness boundaries',()=>{
  it.each([
    ['SIM',29.999,'FRESH'],['SIM',30,'STALE'],
    ['REAL',89.999,'VALID'],['REAL',90,'STALE'],
  ] as const)('%s source age %ss is %s',(source,age,expected)=>{
    expect(classifySourceFreshness(source,age)).toBe(expected);
  });
  it.each([
    [74.999,'OK'],[75,'AGING'],[89.999,'AGING'],[90,'NO_RXTX'],
  ] as const)('REAL valid field frame age %ss is %s',(age,expected)=>{
    expect(classifyRealTransportFreshness(age)).toBe(expected);
  });
  it.each([[29.999,'ONLINE'],[30,'OFFLINE']] as const)('gateway heartbeat age %ss is %s',(age,expected)=>{
    expect(classifyGatewayHeartbeat(age)).toBe(expected);
  });
  it('WS disconnect projects SERVER_DISCONNECTED immediately, independently of source/field ages',()=>{
    expect(projectServerConnection('disconnected')).toBe('SERVER_DISCONNECTED');
    expect(classifySourceFreshness('SIM',0)).toBe('FRESH');
    expect(classifyRealTransportFreshness(0)).toBe('OK');
    expect(classifyGatewayHeartbeat(0)).toBe('ONLINE');
  });
});

describe('freshness evidence stays separate and conservative',()=>{
  it.each([null,undefined,-1,NaN,Infinity])('does not fabricate freshness for unavailable/invalid age %s',(age)=>{
    expect(classifySourceFreshness('SIM',age)).toBe('UNKNOWN');
    expect(classifySourceFreshness('REAL',age)).toBe('UNKNOWN');
    expect(classifyRealTransportFreshness(age)).toBe('UNKNOWN');
    expect(classifyGatewayHeartbeat(age)).toBe('UNKNOWN');
  });
  it('does not assume IMPORT or an unknown source follows SIM or REAL thresholds',()=>{
    expect(classifySourceFreshness('UNKNOWN',0)).toBe('UNKNOWN');
  });
  it('preserves server-reported field transport without manufacturing valid-frame age',()=>{
    expect(projectFieldTransportFreshness('AGING')).toEqual({state:'AGING',ageSec:null,evidence:'SERVER_REPORTED'});
    expect(projectFieldTransportFreshness(undefined)).toEqual({state:'UNKNOWN',ageSec:null,evidence:'UNAVAILABLE'});
  });
  it('extends supplied age only with monotonic elapsed time',()=>{
    expect(elapsedAge(29,1000,1999)).toBe(29.999);
    expect(elapsedAge(29,1000,2000)).toBe(30);
    expect(elapsedAge(29,1000,0)).toBe(29);
    expect(elapsedAge(null,1000,2000)).toBeNull();
    expect(elapsedAge(0,undefined,2000)).toBeNull();
  });
});
