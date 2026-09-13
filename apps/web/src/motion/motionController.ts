export interface MotionState { from:number|null; target:number|null; startedAt:number; durationMs:number; revision:string|null }
export const initialMotion:MotionState={from:null,target:null,startedAt:0,durationMs:0,revision:null};
export function renderedPosition(state:MotionState,now:number):number|null {
  if (state.from===null || state.target===null || state.durationMs<=0) return state.target;
  const progress=Math.max(0,Math.min(1,(now-state.startedAt)/state.durationMs));
  return state.from+(state.target-state.from)*(1-(1-progress)**3);
}
export function confirmPosition(state:MotionState,input:{anchor:number|null;revision:string;now:number;animate:boolean;durationMs?:number}):MotionState {
  if (state.revision!==null && BigInt(input.revision)<BigInt(state.revision)) return state;
  if (state.revision===input.revision && input.animate) return state;
  const from=input.animate?renderedPosition(state,input.now):input.anchor;
  return {from:from??input.anchor,target:input.anchor,startedAt:input.now,durationMs:input.animate?(input.durationMs??700):0,revision:input.revision};
}
export function snapToConfirmed(state:MotionState,now:number):MotionState {return {...state,from:state.target,startedAt:now,durationMs:0};}
