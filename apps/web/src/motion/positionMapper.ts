/** Normalized displayAnchor is a local fixture assumption; floorRaw is never interpreted. */
export function anchorToPercent(anchor:number|null|undefined):number|null {
  return typeof anchor==='number' && Number.isFinite(anchor) && anchor>=0 && anchor<=1 ? (1-anchor)*100 : null;
}
