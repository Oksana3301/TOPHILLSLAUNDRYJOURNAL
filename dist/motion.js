// Piecewise native-scroll timeline. One existing still; no generated-video claim.
(function(root){
const clamp=v=>Math.max(0,Math.min(1,v));const smooth=t=>t*t*(3-2*t);
function sample(value){const p=clamp(Number(value)||0);let scene=0,x=0,y=0,rotate=-6,scale=1,opacity=1,textY=0;
// Reading holds: 0-.24, .38-.62, .76-1. Transition intervals get continuous transforms.
if(p<.24){}else if(p<.38){const t=(p-.24)/.14,s=smooth(t);x=-13*s;y=-14*Math.sin(t*Math.PI);rotate=-6+10*s;scale=1-.08*Math.sin(t*Math.PI);scene=t<.5?0:1;opacity=Math.abs(2*t-1);textY=(1-opacity)*18;}else if(p<.62){scene=1;x=-13;rotate=4;}else if(p<.76){const t=(p-.62)/.14,s=smooth(t);x=-13+13*s;y=-14*Math.sin(t*Math.PI);rotate=4-4*s;scale=1-.06*Math.sin(t*Math.PI);scene=t<.5?1:2;opacity=Math.abs(2*t-1);textY=(1-opacity)*18;}else{scene=2;rotate=0;}
return {scene,x,y,rotate,scale,opacity,textY};}
const api={sample};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.THMotion=api;
})(typeof window==='undefined'?globalThis:window);
