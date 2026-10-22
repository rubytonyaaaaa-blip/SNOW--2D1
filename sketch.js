// SNOW BLOOM — single application file
// 1. Gesture controller
// Pure interaction controller. Coordinates are normalized and mirrored once in sketch.js.
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const palm = h => h.points[9];
const PATTERN_NAMES=['HEXAGON','FERN','STELLAR','NEEDLE','ICE PLATE','DOUBLE STAR','LACE'];
const GESTURES = {Closed_Fist:'Fist',Open_Palm:'Palm',Pointing_Up:'Point',Victory:'Peace',Thumb_Up:'Slow',Thumb_Down:'Fast',None:'Moving',ILoveYou:'Love'};

// Geometry fallback works when gesture labels briefly disappear.
function handPose(h) {
  const p=h.points,aspect=h.aspect||4/3;
  const d=(a,b)=>Math.hypot((p[a].x-p[b].x)*aspect,p[a].y-p[b].y);
  const size=Math.max(.025,d(0,9));
  const extended=[8,12,16,20].map(t=>d(t,0)>d(t-2,0)*1.10 && d(t,0)>size*1.12);
  const folded=[8,12,16,20].map(t=>d(t,0)<d(t-2,0)*1.07 || d(t,0)<size*1.08);
  const label=h.score>=.58?h.gesture:'None';
  // Preserve thumb/love labels before the folded-finger fist fallback.
  if((['Thumb_Up','Thumb_Down'].includes(label)&&folded.filter(Boolean).length>=3)||(label==='ILoveYou'&&extended[0]&&extended[3]))return {gesture:label,shape:label,extended,ratio:d(4,8)/size};
  let shape='None';
  const thumbOut=d(4,9)>size*.8 && d(4,2)>size*.4;
  if(extended[0]&&extended[3]&&folded[1]&&folded[2]&&thumbOut)shape='ILoveYou';
  else if(folded.every(Boolean)&&thumbOut&&Math.abs(p[4].y-p[2].y)>size*.32&&Math.abs(p[4].y-p[2].y)>Math.abs((p[4].x-p[2].x)*aspect)*.75)shape=p[4].y<p[2].y?'Thumb_Up':'Thumb_Down';
  else
  if(extended[0]&&extended[1]&&folded[2]&&folded[3]&&d(8,12)>size*.18)shape='Victory';
  else if(extended.every(Boolean))shape='Open_Palm';
  else if(extended[0]&&folded[1]&&folded[2]&&folded[3]&&d(4,8)>size*.45)shape='Pointing_Up';
  else if(folded.every(Boolean))shape='Closed_Fist';

  // Clear anatomy wins over a contradictory model label.
  return {gesture:shape!=='None'?shape:label,shape,extended,ratio:d(4,8)/size};
}

class SnowController {
  constructor(onEvent = () => {}) {
    this.onEvent = onEvent;
    this.state = {field:false,fieldSource:null,fieldX:.58,fieldY:.43,scene: 'bloom', dispersed: false, scale: 1, pattern: 0, snowSpeed: 1, snowPalette:0, vortex: 0, vortexRadius: .25, vortexX: .58, vortexY: .48, vortexSource: null};
    this.history = []; this.swipeUntil = 0; this.suppressUntil = 0;
    this.stable = ''; this.stableSince = 0; this.fired = false; this.lastBurst = -Infinity;
    this.pinch = false; this.pinchSide = ''; this.pinchWideSince = null;
    this.dual = null; this.lastHandTime = -Infinity; this.lastPoseTime=-Infinity; this.lastVictory=-Infinity; this.trailPoint=null; this.drawLocked=false;this.pinchCandidate=null;
  }
  emit(type, data = {}) { this.onEvent({type, ...data, state: this.state}); }
  switchScene(scene, now = performance.now()) {
    if (!['bloom', 'snowfall','sprawl'].includes(scene) || scene === this.state.scene) return false;
    Object.assign(this.state, {scene, dispersed: false, vortex: 0, vortexSource: null,field:false,fieldSource:null});
    this.resetTracking(); this.suppressUntil = now + 180; this.swipeUntil = now + 650;
    if(typeof sprawl!=='undefined')sprawl.resetInput();
    this.emit('scene'); return true;
  }
  resetTracking() {
    this.history = []; this.stable = ''; this.fired = false; this.pinch = false;
    this.pinchWideSince = null; this.dual = null; this.trailPoint=null; this.drawLocked=false;this.pinchCandidate=null;this.mode='idle';this.bloomCandidate='';this.bloomFired='';this.navHistory=[];
  }
  action(name, data = {}) {
    const s = this.state;
    if (s.scene === 'bloom') {
      if(name==='Thumb_Up'){s.field=data.source==='hands'?true:!s.field;s.fieldSource=s.field?(data.source||'manual'):null;this.emit('magnet');}
      if(['Closed_Fist','Open_Palm','Victory'].includes(name)){s.field=false;s.fieldSource=null;}
      if (name === 'Closed_Fist') { s.dispersed = false; this.emit('gather'); }
      if (name === 'Open_Palm') { s.dispersed = true; this.emit('spread'); }
      if (name === 'Victory') { s.pattern = (s.pattern + 1) % PATTERN_NAMES.length; s.dispersed=false; this.emit('pattern'); }
      if (name === 'Pointing_Up') this.emit('trail', {x: data.x ?? .58, y: data.y ?? .48,from:data.from??null});
      if (name === 'scale') { s.scale = clamp(Number(data.value) || 1, .5, 1.8); this.emit('scale'); }
    } else {
      if(name==='ILoveYou')this.emit('love',{x:data.x??.58,y:data.y??.45});
      if (name === 'Thumb_Up' || name === 'Thumb_Down' || name === 'speed') {
        s.snowSpeed = name === 'Thumb_Up' ? .5 : name === 'Thumb_Down' ? 2 : clamp(Number(data.value) || 1, .4, 2.4);
        if(name==='Thumb_Down')s.snowPalette=(s.snowPalette+1)%3;
        this.emit('speed');
      }
      if (name === 'vortex') {
        s.vortex = s.vortex > 0 ? 0 : 1; s.vortexRadius = .22;
        s.vortexX = .58; s.vortexY = .48; s.vortexSource = s.vortex ? 'manual' : null;
        this.emit(s.vortex ? 'vortex' : 'vortex-end');
      }
    }
  }
  tick(now) {
    if (now - this.lastHandTime > 450) {
      this.resetTracking();
      if(this.state.fieldSource==='hands'){this.state.field=false;this.state.fieldSource=null;}
      if (this.state.vortexSource === 'hands') {
        this.state.vortex = 0; this.state.vortexSource = null; this.emit('vortex-end');
      }
    }
  }
  stepScene(direction,now=performance.now()){
    const order=['bloom','snowfall','sprawl'],i=order.indexOf(this.state.scene),next=order[i+direction];return next?this.switchScene(next,now):false;
  }
  navigation(hands,now){
    const globe=this.state.scene==='sprawl'&&typeof sprawl!=='undefined'&&sprawl.orbs.length>0;
    if(hands.length!==1||now<this.swipeUntil||this.mode==='pinch'){this.navHistory=[];return false;}
    const pose=handPose(hands[0]);if(!(pose.gesture==='Open_Palm'||pose.extended.every(Boolean))||pose.ratio<.8){this.navHistory=[];return false;}
    const p=palm(hands[0]);this.navHistory=(this.navHistory||[]).filter(v=>now-v.t<(globe?550:700));const old=this.navHistory[0];
    if(old&&now-old.t>=160){const dx=p.x-old.x,dy=p.y-old.y;if((globe?dx<-.23:Math.abs(dx)>.15)&&Math.abs(dy)<(globe?.16:.20)&&Math.abs(dx)/((now-old.t)/1000)>(globe?.7:.24)){
      if(this.stepScene(dx>0?1:-1,now)){this.navHistory=[];return true;}
    }}this.navHistory.push({...p,t:now});return false;
  }
  processBloom(h,now){
    const p=h.points,pose=handPose(h),g=pose.gesture,aspect=h.aspect||4/3;
    const metric=(a,b)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y);
    const palmSize=Math.max(.025,metric(p[0],p[9])),ratio=metric(p[4],p[8])/palmSize;
    const reach=metric(p[8],p[0])/palmSize;
    this.mode=this.mode||'idle';
    // Full poses must be held, not merely passed through on the way to another pose.
    const clear=['Closed_Fist','Open_Palm','Victory','Thumb_Up'].includes(g);
    if(g!==this.bloomCandidate){this.bloomCandidate=g;this.bloomSince=now;}
    const held=now-this.bloomSince;
    const confirmed=clear&&held>=(g==='Victory'?280:g==='Thumb_Up'?250:180);
    if(this.mode==='pinch'){
      const release=confirmed&&(g==='Closed_Fist'||g==='Victory'||(g==='Open_Palm'&&ratio>1.2));
      if(!release){this.action('scale',{value:.5+clamp((ratio-.18)/1.35,0,1)*1.3});return;}
      this.mode='idle';this.pinch=false;this.pinchCandidate=null;
    }
    if(this.mode==='draw'){
      // The stroke retains ownership during brief contact or classifier dropouts.
      if(confirmed){this.mode='idle';this.drawLocked=false;this.trailPoint=null;}
      else{
        if((g==='Pointing_Up'||g==='None')&&ratio>.40&&now-this.lastBurst>=65){
          const tip=p[8];if(!this.trailPoint||distance(tip,this.trailPoint)>.012){this.action('Pointing_Up',{x:tip.x,y:tip.y,from:this.trailPoint});this.trailPoint={x:tip.x,y:tip.y};this.lastBurst=now;}}
        return;
      }
    }
    if(this.mode==='magnet'){
      if(g==='Thumb_Up'){this.state.fieldX=p[4].x;this.state.fieldY=p[4].y;this.magnetSeen=now;return;}
      if(!confirmed&&now-(this.magnetSeen||0)<180)return;
      this.mode='idle';this.state.field=false;this.state.fieldSource=null;
    }
    // Unmistakable thumb-index contact must persist for 180 ms.
    const contact=ratio<.25&&reach>.9&&!['Closed_Fist','Victory','Thumb_Up','Thumb_Down','ILoveYou'].includes(g);
    if(contact){if(!this.pinchCandidate||this.pinchCandidate.side!==h.side)this.pinchCandidate={side:h.side,since:now};
      if(now-this.pinchCandidate.since>=180){this.mode='pinch';this.pinch=true;this.pinchSide=h.side;this.trailPoint=null;this.bloomFired='';this.history=[];}return;
    }else this.pinchCandidate=null;
    if(confirmed){
      if(this.bloomFired!==g){
        // A held peace sign changes exactly once; tiny flickers cannot rearm it.
        if(g!=='Victory'||now-this.lastVictory>900){
          this.action(g,{source:'hands',x:p[8].x,y:p[8].y});this.bloomFired=g;
          if(g==='Victory')this.lastVictory=now;
          if(g==='Thumb_Up'){this.mode='magnet';this.magnetSeen=now;this.state.fieldX=p[4].x;this.state.fieldY=p[4].y;}
        }
      }
      this.pinchCandidate=null;return;
    }
    if(this.bloomFired&&g!==this.bloomFired&&held>220)this.bloomFired='';
    if(g==='Pointing_Up'&&ratio>.55&&held>=220){this.mode='draw';this.drawLocked=true;this.trailPoint=null;this.lastBurst=now-70;this.bloomFired='';return;}
  }

  process(input, now) {
    const valid=input.filter(h=>h.points?.length===21&&h.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    if(valid.length)this.lastHandTime=now;
    if(this.navigation(valid,now))return;
    if(this.state.scene==='sprawl'){sprawl.process(valid,now);return;}
    const hands = input.filter(h => h.points?.length === 21 && h.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    if (!hands.length) { this.tick(now); return; }
    this.lastHandTime = now;
    if (hands.length === 2) {
      this.drawLocked=false;this.pinchCandidate=null;this.trailPoint=null;this.mode='idle';this.bloomCandidate='';this.bloomFired='';
      if(this.state.fieldSource==='hands'){this.state.field=false;this.state.fieldSource=null;}
      this.history = []; this.pinch = false; this.stable = ''; this.fired = false;
      const bothOpen = hands.every(h => handPose(h).gesture === 'Open_Palm');
      if (this.state.scene === 'snowfall' && bothOpen) {
        const a = palm(hands[0]), b = palm(hands[1]), d = distance(a, b);
        if (!this.dual) this.dual = {since: now, maxDistance: d, active: this.state.vortex>0};
        this.dual.maxDistance = Math.max(this.dual.maxDistance, d);
        const contraction = this.dual.maxDistance - d;
        if (now - this.dual.since >= 150 && contraction > .075 && d < this.dual.maxDistance * .82 && !this.dual.active) {
          this.dual.active = true; this.state.vortexSource = 'hands';
          this.state.vortex = clamp(.95 + contraction * 4, .8, 1.8); this.emit('vortex');
        }
        if (this.dual.active) {
          Object.assign(this.state, {vortexSource:'hands',vortex: clamp(.95 + contraction * 4, .8, 1.8), vortexRadius: clamp(d * .58, .10, .38), vortexX: clamp((a.x+b.x)/2, .1, .9), vortexY: clamp((a.y+b.y)/2, .12, .88)});
        } else this.emit('vortex-armed');
        return;
      }
      this.endDual(); return;
    }
    if(this.state.scene==='snowfall'&&this.state.vortex>0&&hands.length===1&&handPose(hands[0]).gesture==='Open_Palm'){
      const p=palm(hands[0]);this.state.vortexX=clamp(p.x,.1,.9);this.state.vortexY=clamp(p.y,.12,.88);this.state.vortexSource='hands';return;
    }
    this.endDual();
    if(this.state.scene==='bloom'){if(now>=this.suppressUntil)this.processBloom(hands[0],now);return;}
    const h = hands[0], p = h.points, pose=handPose(h), g=pose.gesture;
    if(this.state.scene==='bloom'){
      if(g==='Thumb_Up'){this.state.fieldX=p[4].x;this.state.fieldY=p[4].y;}
      else if(this.state.fieldSource==='hands'){this.state.field=false;this.state.fieldSource=null;}
    }
    if (now < this.suppressUntil) return;
    // Landmark distance in image pixels, normalized by palm length.
    // Pinching does not require the classifier to name the gesture correctly.
    const aspect = Number.isFinite(h.aspect) && h.aspect > 0 ? h.aspect : 4/3;
    const metric = (a,b) => Math.hypot((a.x-b.x)*aspect,a.y-b.y);
    const palmSize = Math.max(.025, metric(p[0],p[9]));
    const ratio = metric(p[4],p[8])/palmSize;
    const indexReach = metric(p[8],p[0])/palmSize;
    const deliberatePose = ['Closed_Fist','Victory','ILoveYou','Thumb_Up','Thumb_Down'].includes(g);
    // A drawing stroke owns the input until a clear different pose releases it.
    if(g!=='Pointing_Up' && g!=='None')this.drawLocked=false;
    const contact=ratio<.30 && indexReach>.9 && !deliberatePose && !this.drawLocked;
    let closeTips=false;
    if(contact && !this.pinch){
      if(!this.pinchCandidate || this.pinchCandidate.side!==h.side)this.pinchCandidate={since:now,side:h.side};
      if(now-this.pinchCandidate.since<120){this.history=[];return;}
      closeTips=true;
    }else this.pinchCandidate=null;
    // A fist, peace sign, or wide open palm ends resizing immediately.
    if(deliberatePose || (g==='Open_Palm' && ratio>.85))this.pinch=false;
    if (this.pinch && h.side !== this.pinchSide) this.pinch = false;
    if(this.state.scene === 'bloom' && (this.pinch || closeTips)) {
      if(!this.pinch){ this.pinch=true;this.drawLocked=false;this.trailPoint=null;this.pinchSide=h.side;this.pinchWideSince=null;this.pinchCandidate=null; }
      this.action('scale',{value:.5 + clamp((ratio-.18)/1.35,0,1)*1.3});
      this.history=[];this.stable='';this.fired=false;
      // Release only after a sustained wide opening, never on classifier flicker.
      if(ratio>1.6){if(this.pinchWideSince===null)this.pinchWideSince=now;
        if(now-this.pinchWideSince>420){this.pinch=false;this.suppressUntil=now+250;}}
      else this.pinchWideSince=null;
      return;
    }
    this.pinch=false;
    // Draw only after a short confirmation; space marks along the moving finger.
    if(g!=='Pointing_Up')this.trailPoint=null;
    if(g==='Pointing_Up' && this.state.scene==='bloom' && this.stable===g && now-this.stableSince>=65){
      this.drawLocked=true;
      const tip=p[8], moved=!this.trailPoint || distance(tip,this.trailPoint)>.012;
      if(moved && now-this.lastBurst>=45){
        this.action(g,{x:tip.x,y:tip.y,from:this.trailPoint});
        this.trailPoint={x:tip.x,y:tip.y};this.lastBurst=now;this.fired=true;
      }
      return;
    }
    // Two camera samples confirm a pose; tolerate brief label dropouts.
    if(g==='None'){
      if(now-this.lastPoseTime>200){this.stable='';this.fired=false;}
      return;
    }
    this.lastPoseTime=now;
    if(g!==this.stable){this.stable=g;this.stableSince=now;this.fired=false;}
    if(now-this.stableSince<65)return;
    if(!this.fired){
      if(g==='Victory' && now-this.lastVictory<650)return;
      this.action(g,{x:p[8].x,y:p[8].y,source:'hands'});this.fired=true;
      if(g==='Victory')this.lastVictory=now;
      if(g==='Pointing_Up')this.lastBurst=now;
    }
  }

  endDual() {
    this.dual = null;
    if (this.state.vortexSource === 'hands') {
      this.state.vortex = 0; this.state.vortexSource = null; this.emit('vortex-end');
    }
  }
}

// 2. Canvas artwork
// All scene artwork uses CanvasRenderingContext2D and planar x/y geometry.
const TAU = Math.PI*2, mix = (a,b,t) => a+(b-a)*t;
let seed = 2718;
const random = () => { seed = (seed*1664525+1013904223)>>>0; return seed/4294967296; };
class SnowArtwork {
  constructor(canvas, state, reducedMotion = false) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.state=state; this.reducedMotion=reducedMotion;
    this.time=0; this.scale=1; this.spread=0; this.sceneMix=0; this.vortex=0; this.radius=.25; this.vortexCenterX=.5;this.vortexCenterY=.5; this.extra=[]; this.fieldBlend=0;this.storm=0;
    this.snow=Array.from({length:1600},()=>({x:random(),y:random(),variation:random(),p:random()*TAU,r:3+random()*13,color:Math.floor(random()*5),type:Math.floor(random()*3)}));
    this.ambient=Array.from({length:105},()=>({x:random(),y:random(),variation:random(),p:random()*TAU}));
    this.dust=Array.from({length:90},()=>({x:random(),y:random(),variation:random(),p:random()*TAU}));
    this.swirl=Array.from({length:3240},(_,i)=>{const q=Math.floor(i/18)/180;return {a:(i%18)/18*TAU,r:q,variation:random(),p:random()*TAU};});
    this.paper=null; this.pattern=-1; this.w=1440; this.h=900; this.resize(1440,900,1); this.rebuild();
  }
  resize(w,h,dpr=1) {
    this.w=w;this.h=h;this.dpr=Math.min(dpr,2);
    this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.mobile=w<=760; this.cx=w*.5;this.cy=this.mobile?470:h*.4;
    this.R=this.mobile?w*.44:Math.min(w*.32,h*.30,this.cy-112);
    this.makeSnowSprites();this.makeFrostBackground();
  }
  makeFrostBackground(){
    if(typeof document==='undefined')return;
    // Frozen glass, not botanical fronds. Cache the rough ice surface on resize.
    const tile=document.createElement('canvas'),w=Math.min(1600,this.w),h=Math.round(w*this.h/this.w);
    tile.width=w;tile.height=h;const c=tile.getContext('2d');let n=58127;
    const rand=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
    const hash=(x,y)=>{let q=Math.imul(x,374761393)+Math.imul(y,668265263);q=Math.imul(q^(q>>>13),1274126177);return ((q^(q>>>16))>>>0)/4294967296;};
    const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);return mix(mix(hash(ix,iy),hash(ix+1,iy),u),mix(hash(ix,iy+1),hash(ix+1,iy+1),u),v);};
    const short=Math.min(w,h),unit=short/900;
    // Multi-scale granular ice with cloudy deposits and narrow crystalline ridges.
    const pixels=c.createImageData(w,h),d=pixels.data;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const nx=x/short,ny=y/short,edge=Math.min(x/w,1-x/w,y/h,1-y/h);
      const warp=noise(nx*4,ny*4),broad=noise(nx*7+warp*2,ny*7-warp*2);
      const middle=noise(nx*35+warp*3,ny*35),fine=noise(nx*140,ny*140),grain=rand();
      const field=noise(nx*21+middle*1.7,ny*21+warp*2);
      const ridge=Math.pow(Math.max(0,1-Math.abs(field-.5)*22),5);
      const border=Math.max(0,1-edge/.34),deposit=Math.max(0,broad-.35)*1.4;
      const light=(broad-.5)*29+(middle-.5)*14+(fine-.5)*13+(grain-.5)*12+ridge*(9+border*11);
      const frost=deposit*(.25+border*.75),i=(y*w+x)*4;
      d[i]=65+light+frost*22;d[i+1]=96+light+frost*26;d[i+2]=124+light+frost*26;d[i+3]=255;
    }c.putImageData(pixels,0,0);
    // Small, overlapping angular ice plates with etched facets, irregular in size.
    for(let i=0;i<1800;i++){
      const x=rand()*w,y=rand()*h,edge=Math.min(x/w,1-x/w,y/h,1-y/h);
      if(edge>.22&&rand()<.78)continue;
      const r=short*(.003+rand()**3*.062),angle=rand()*TAU,count=3+Math.floor(rand()*3),points=[];
      for(let j=0;j<count;j++){const a=angle+j/count*TAU,rr=r*(.55+rand()*.65);points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr*.65]);}
      c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();
      c.fillStyle=i%3?'rgba(136,163,184,.035)':'rgba(28,59,91,.045)';c.fill();
      c.strokeStyle='rgba(152,180,199,.10)';c.lineWidth=.45*unit;c.stroke();
      c.beginPath();c.moveTo(...points[0]);c.lineTo(...points[1]);c.strokeStyle='rgba(183,205,216,.14)';c.stroke();
    }
    // Very short, straight crystal needles collect in uneven patches, without stems.
    for(let i=0;i<1100;i++){
      const x=rand()*w,y=rand()*h,edge=Math.min(x/w,1-x/w,y/h,1-y/h);
      if(edge>.22&&rand()<.88)continue;
      const angle=rand()*TAU,spread=.25+rand()*.65,len=short*(.003+rand()*.021);
      c.beginPath();for(let j=0;j<5+rand()*10;j++){
        const a=angle+(rand()-.5)*spread,l=len*(.25+rand()),ox=x+(rand()-.5)*len,oy=y+(rand()-.5)*len;
        c.moveTo(ox,oy);c.lineTo(ox+Math.cos(a)*l,oy+Math.sin(a)*l);
      }c.strokeStyle='rgba(167,191,207,'+(.06+rand()*.13)+')';c.lineWidth=.45*unit;c.stroke();
    }
    // Sparse hairline fractures change direction sharply, like frozen water.
    for(let i=0;i<24;i++){
      let x=rand()*w,y=rand()*h,a=rand()*TAU;c.beginPath();c.moveTo(x,y);
      for(let j=0;j<4;j++){const l=short*(.012+rand()*.035);a+=(rand()-.5)*1.3;x+=Math.cos(a)*l;y+=Math.sin(a)*l;c.lineTo(x,y);}
      c.strokeStyle='rgba(174,199,216,.12)';c.lineWidth=.5*unit;c.stroke();
    }
    // Low-contrast blue vapour softens the central opening behind white interaction.
    const haze=c.createRadialGradient(w*.5,h*.45,short*.05,w*.5,h*.45,short*.65);
    haze.addColorStop(0,'rgba(116,149,176,.20)');haze.addColorStop(1,'rgba(116,149,176,0)');c.fillStyle=haze;c.fillRect(0,0,w,h);
    this.frostBackground=tile;
  }
  makeSnowSprites(){
    this.palette=['198,230,255','218,202,255','250,210,228','255,239,204','207,243,232'];this.snowSprites=[];this.stormSprites=[];
    if(typeof document==='undefined')return;
    const original=this.ctx;
    const build=(palette,tinted=false)=>{const sprites=[];
      for(let blur=0;blur<3;blur++)for(let color=0;color<5;color++)for(let type=0;type<3;type++){
        const tile=document.createElement('canvas');tile.width=100;tile.height=100;this.ctx=tile.getContext('2d');
        const glow=this.ctx.createRadialGradient(50,50,0,50,50,40);glow.addColorStop(0,'rgba('+palette[color]+',.10)');glow.addColorStop(1,'rgba('+palette[color]+',0)');this.ctx.fillStyle=glow;this.ctx.fillRect(0,0,100,100);
        this.ctx.filter=blur===2?'blur(2.3px)':blur===1?'blur(.8px)':'none';this.crystalFlake(50,50,35,palette[color],type);this.ctx.filter='none';if(tinted){this.ctx.globalCompositeOperation='source-atop';this.ctx.fillStyle='rgba('+palette[color]+',.9)';this.ctx.fillRect(0,0,100,100);this.ctx.globalCompositeOperation='source-over';}sprites.push(tile);
      }return sprites;
    };
    this.snowSprites=build(this.palette);
    this.snowfallSprites=build(['251,254,255','115,187,244','50,107,171','146,182,215','220,237,251'],true);
    this.stormSprites=[
      ['251,254,255','119,196,251','52,114,183','144,185,220','226,242,255'],
      ['246,253,255','106,183,244','57,107,176','160,194,225','226,240,252'],
      ['253,255,255','135,203,250','65,120,185','139,178,211','211,234,251']
    ].map(palette=>build(palette,true));this.ctx=original;
  }
  crystalFlake(x,y,r,color,type){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(.1);c.lineJoin='round';
    // Bevelled translucent blades, with nested fern cuts and a bright ridge.
    const blade=(x,y,a,len,width)=>{
      c.save();c.translate(x,y);c.rotate(a);
      c.fillStyle='rgba('+color+',.28)';c.beginPath();c.moveTo(0,0);c.lineTo(len*.38,-width);c.lineTo(len,0);c.lineTo(len*.38,width);c.closePath();c.fill();
      c.fillStyle='rgba(250,253,255,.45)';c.beginPath();c.moveTo(0,0);c.lineTo(len*.38,-width);c.lineTo(len,0);c.closePath();c.fill();
      c.strokeStyle='rgba('+color+',.9)';c.lineWidth=.65;c.beginPath();c.moveTo(0,0);c.lineTo(len,0);c.stroke();c.restore();
    };
    for(let arm=0;arm<6;arm++){
      const a=arm*TAU/6;blade(0,0,a,r,r*.065);
      for(const f of(type===1?[.27,.44,.61,.77]:[.3,.5,.7]))for(const sign of[-1,1]){
        const bx=Math.cos(a)*r*f,by=Math.sin(a)*r*f,l=r*(1-f)*.59;
        blade(bx,by,a+sign*Math.PI/3,l,l*.12);
        if(type!==2)for(const g of[.42,.7]){const theta=a+sign*Math.PI/3;blade(bx+Math.cos(theta)*l*g,by+Math.sin(theta)*l*g,theta+sign*Math.PI/3,l*(1-g)*.5,l*.045);}
      }
    }
    c.strokeStyle='rgba(245,252,255,.8)';c.lineWidth=.65;c.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6;if(i===0)c.moveTo(Math.cos(a)*r*.15,Math.sin(a)*r*.15);else c.lineTo(Math.cos(a)*r*.15,Math.sin(a)*r*.15);}c.closePath();c.stroke();c.restore();
  }
  rebuild() {
    this.pattern=this.state.pattern; this.lines=[];
    const add=(a,b,c,d)=>this.lines.push([a,b,c,d]);
    const pattern=this.pattern,arms=pattern===5?12:6;
    const branches=[7,11,7,4,3,5,9][pattern];
    const ring=(radius,offset=0)=>{for(let i=0;i<6;i++){const a=i*TAU/6-Math.PI/2+offset,b=(i+1)*TAU/6-Math.PI/2+offset;add(Math.cos(a)*radius,Math.sin(a)*radius,Math.cos(b)*radius,Math.sin(b)*radius);}};
    for(let arm=0;arm<arms;arm++) {
      const angle=arm*TAU/arms-Math.PI/2,cs=Math.cos(angle),sn=Math.sin(angle);
      const line=(x,y,xx,yy)=>add(cs*x-sn*y,sn*x+cs*y,cs*xx-sn*yy,sn*xx+cs*yy);
      const reach=pattern===5&&arm%2?.73:1;
      line(0,0,reach,0);
      if(pattern===4){
        // Broad faceted plate with pointed tips and small corner cuts.
        line(.55,0,.72,.19);line(.72,.19,1,0);line(1,0,.72,-.19);line(.72,-.19,.55,0);
        line(.84,0,.91,.055);line(.84,0,.91,-.055);
      }else for(let j=1;j<=branches;j++) {
        const t=(.12+j*.72/branches)*reach;
        const len=(1-t/reach)*([.48,.61,.48,.29,.3,.48,.55][pattern])*reach;
        for(const sign of [-1,1]) {
          const ex=t+len*(pattern===3?.25:.58),ey=sign*len*(pattern===3?.96:.81);
          line(t,0,ex,ey);
          if([0,1,6].includes(pattern))for(let k=1;k<=(pattern===6?3:2);k++) {
            const f=k/(pattern===6?4:3),px=mix(t,ex,f),py=ey*f,twig=len*(.26-k*.035);
            line(px,py,px+twig,py-sign*twig*.34);
          }
          if(pattern===3){line(ex,ey,ex+.09,ey*.76);line(t+.025,0,ex+.025,ey*.82);}
          if(pattern===5&&j===3){line(ex,ey,ex+.07,ey*.65);}
        }
      }
      if(pattern===2){line(.43,0,.60,.23);line(.60,.23,.80,0);line(.80,0,.60,-.23);line(.60,-.23,.43,0);}
      if(pattern===0||pattern===1){line(.13,0,.195,.1126);line(.195,.1126,.26,0);line(.26,0,.195,-.1126);line(.195,-.1126,.13,0);}
    }
    if(pattern===4){ring(.28);ring(.49);ring(.63);}
    if(pattern===5)ring(.23);
    if(pattern===6){ring(.24);ring(.47);ring(.69);}
    // Imperfect, fixed pigment edges, built once per pattern.
    this.threads=this.lines.map(([x,y,xx,yy])=>({x,y,xx,yy,bend:(random()-.5)*.018,alpha:.08+random()*.12}));
    // Fixed pigment clusters keep a handmade surface without per-frame randomness.
    this.frost=Array.from({length:280},(_,i)=>{
      const edge=this.lines[Math.floor(random()*this.lines.length)],q=random();
      const variation=random(),a=random()*TAU,scatter=(.008+random()*.038);
      return {u:mix(edge[0],edge[2],q)+Math.cos(a)*scatter,v:mix(edge[1],edge[3],q)+Math.sin(a)*scatter,variation,a,size:.6+random()*2.2,phase:random()*TAU};
    });
    this.floaters=Array.from({length:600},(_,i)=>({a:random()*TAU,r:1.08+random()*1.65,variation:random(),phase:random()*TAU,size:1+random()*3.5,sx:random(),sy:random(),outer:i>=320}));
    this.facets=Array.from({length:54},(_,i)=>{const arm=i%6,level=Math.floor(i/6),a=arm*TAU/6-Math.PI/2;const r=.16+level*.085;return {u:Math.cos(a)*r,v:Math.sin(a)*r,a,size:1.8+random()*3.2,variation:random()};});
    this.points=[];
    for(const [x,y,xx,yy] of this.lines) {
      const n=Math.max(2,Math.round(Math.hypot(xx-x,yy-y)/.013));
      for(let i=0;i<=n;i++) {
        const t=i/n,u=mix(x,xx,t),v=mix(y,yy,t);
        const phase=random()*TAU,spreadR=.8+random()*1.5;
        this.points.push({u,v,x:u,y:v,jx:(random()-.5)*.009,jy:(random()-.5)*.009,dx:Math.cos(phase)*spreadR,dy:Math.sin(phase)*spreadR,phase,sx:random(),sy:random(),vx:0,vy:0,kind:Math.floor(random()*5),depth:.5+random()*.5,size:.45+random()*.95,alpha:.45+random()*.5});
      }
    }
  }
  scatterImpulse(){
    if(this.reducedMotion)return;
    for(const p of this.points){const a=Math.atan2(p.v,p.u)+(random()-.5)*.7,speed=.5+random()*1.3;p.vx+=Math.cos(a)*speed;p.vy+=Math.sin(a)*speed;}
  }
  burst(x,y) {
    for(let i=0;i<24;i++) {const a=random()*TAU,s=10+random()*58;this.extra.push({x:x*this.w,y:y*this.h,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:3+random()*8,life:3+random()*2,a});}
    if(this.extra.length>220)this.extra.splice(0,this.extra.length-220);
  }
  trail(x,y,from=null) {
    const end={x:x*this.w,y:y*this.h},start=from?{x:from.x*this.w,y:from.y*this.h}:end;
    const d=Math.hypot(end.x-start.x,end.y-start.y),n=Math.min(32,Math.max(1,Math.ceil(d/15)));
    for(let i=1;i<=n;i++){const q=i/n;this.extra.push({x:mix(start.x,end.x,q),y:mix(start.y,end.y,q),vx:(random()-.5)*2,vy:1+random()*2,r:4+random()*5,life:7,a:random()*TAU,trail:true});}
    if(this.extra.length>600)this.extra.splice(0,this.extra.length-600);
  }
  love(x=.58,y=.45){
    const R=Math.min(this.w,this.h)*.12;
    for(let i=0;i<120;i++){const t=i/120*TAU, radius=R*(.78+.22*Math.cos(6*t));this.extra.push({x:x*this.w+Math.cos(t)*radius,y:y*this.h+Math.sin(t)*radius,vx:Math.cos(t)*2,vy:Math.sin(t)*2,r:3+random()*4,life:7,a:t,love:true});}
    if(this.extra.length>600)this.extra.splice(0,this.extra.length-600);
  }
  flake(x,y,r,alpha,angle=0,color="214,242,245",type=0) {
    if(alpha<.015)return;
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);c.strokeStyle=`rgba(${color},${clamp(alpha,0,1)})`;c.lineWidth=Math.max(.55,r*.055);c.beginPath();
    for(let i=0;i<6;i++) {const a=i*TAU/6,cs=Math.cos(a),sn=Math.sin(a);c.moveTo(0,0);c.lineTo(cs*r,sn*r);if(r>3)for(const f of (type===2?[.4,.62,.83]:[.47,.72]))for(const s of [-1,1]){c.moveTo(cs*r*f,sn*r*f);c.lineTo(cs*r*f+Math.cos(a+s*1.02)*r*.24,sn*r*f+Math.sin(a+s*1.02)*r*.24);}}
    if(type===1){for(let i=0;i<6;i++){const a=i*TAU/6;c.moveTo(Math.cos(a)*r*.45,Math.sin(a)*r*.45);c.lineTo(Math.cos(a+TAU/6)*r*.45,Math.sin(a+TAU/6)*r*.45);}}c.stroke();c.restore();
  }
  draw(dt) {
    dt=clamp(dt,0,.05);const c=this.ctx,w=this.w,h=this.h;
    this.time+=dt;const t=this.time, ease=1-Math.exp(-dt*5);
    this.scale=mix(this.scale,this.state.scale,ease);this.spread=mix(this.spread,this.state.dispersed?1:0,ease*.8);
    this.sceneMix=mix(this.sceneMix,this.state.scene==='snowfall'?1:0,ease*.7);
    this.vortex=mix(this.vortex,this.state.vortex,ease*.9);this.vortexCenterX=mix(this.vortexCenterX,this.state.vortexX,Math.min(1,ease*1.7));this.vortexCenterY=mix(this.vortexCenterY,this.state.vortexY,Math.min(1,ease*1.7));this.radius=mix(this.radius,this.state.vortexRadius,ease*.6);
    if(this.pattern!==this.state.pattern)this.rebuild();
    const sp=this.state.scene==='sprawl';const bg=c.createLinearGradient(0,0,w*.45,h);
    const themes=[[[27,65,91],[57,104,137],[29,59,89]],[[67,62,105],[126,107,151],[65,71,112]],[[42,83,92],[104,145,146],[49,85,110]],[[34,63,110],[70,99,161],[35,46,98]],[[93,61,82],[148,103,123],[73,55,92]],[[39,83,85],[71,126,122],[30,66,81]],[[87,70,51],[145,122,88],[65,60,68]]];
    const snowTheme=[[56,93,127],[100,142,176],[47,83,122]],stormThemes=[[[45,82,120],[84,127,167],[39,76,115]],[[49,85,126],[92,133,177],[43,79,122]],[[45,89,124],[88,138,173],[38,79,114]]];
    const stormTarget=this.state.scene==='snowfall'?clamp((this.state.snowSpeed-1)/.9,0,1):0;
    this.storm=mix(this.storm,stormTarget,1-Math.exp(-dt*2.7));
    const target=this.state.scene==='snowfall'?snowTheme.map((v,i)=>v.map((n,j)=>mix(n,stormThemes[this.state.snowPalette||0][i][j],this.storm))):themes[this.state.scene==='bloom'?this.state.pattern:0];
    if(!this.bgColors)this.bgColors=target.map(v=>v.slice());
    this.bgColors.forEach((v,i)=>v.forEach((n,j)=>v[j]=mix(n,target[i][j],ease*.35)));
    const color=i=>'rgb('+this.bgColors[i].map(Math.round).join(',')+')';
    bg.addColorStop(0,sp?'#b3c5d9':color(0));bg.addColorStop(.5,sp?'#829ebd':color(1));bg.addColorStop(1,sp?'#536f94':color(2));c.fillStyle=bg;c.fillRect(0,0,w,h);
    if(sp&&this.frostBackground)c.drawImage(this.frostBackground,0,0,w,h);
    const halo=c.createRadialGradient(w*.55,h*.5,0,w*.55,h*.5,w*.65);halo.addColorStop(0,sp?'rgba(165,210,222,.25)':'rgba(119,154,205,.12)');halo.addColorStop(1,'rgba(100,140,190,0)');c.fillStyle=halo;c.fillRect(0,0,w,h);
    for(const f of this.ambient){const x=(f.x*w+Math.sin(t*.08+f.p)*10+w)%w,y=(f.y*h+(this.reducedMotion?0:t*(2+f.variation*8)))%h;const alpha=.08+f.variation*.28;if(f.variation>.9)this.flake(x,y,2+f.variation*2,alpha,f.p);else{c.fillStyle=`rgba(220,230,248,${alpha})`;c.beginPath();c.arc(x,y,.5+f.variation,0,TAU);c.fill();}}
    // Quiet depth particles stay present in both scenes.
    for(const p of this.dust) {const x=p.x*w+Math.sin(t*.14+p.p)*7,y=(p.y*h+t*(1+p.variation*3))%h;c.fillStyle=`rgba(189,222,236,${.1+p.variation*.25})`;c.beginPath();c.arc(x,y,.4+p.variation,0,TAU);c.fill();}
    this.fieldBlend=mix(this.fieldBlend,this.state.field&&this.state.scene==='bloom'?1:0,ease);
    const bloomAlpha=this.state.scene==='sprawl'?0:1-this.sceneMix;
    if(bloomAlpha>.005) {
      const R=this.R*this.scale,rot=this.reducedMotion?0:Math.sin(t*.07)*.045;
      c.save();c.translate(this.cx,this.cy);c.rotate(rot);
      const motion=this.reducedMotion?0:t;
      // Back plane: a faint pigment wash, with loose snow grains at different depths.
      const wash=c.createRadialGradient(0,0,R*.08,0,0,R*1.35);
      wash.addColorStop(0,`rgba(230,224,243,${.105*bloomAlpha})`);
      wash.addColorStop(.5,`rgba(188,225,235,${.045*bloomAlpha})`);wash.addColorStop(1,'rgba(210,230,245,0)');
      c.fillStyle=wash;c.fillRect(-R*1.4,-R*1.4,R*2.8,R*2.8);
      for(const f of this.floaters){
        const a=f.a+motion*(.012+f.variation*.018),rr=R*(f.r+this.spread*(.25+f.variation*.65));
        let x=Math.cos(a)*rr+Math.sin(motion*.18+f.phase)*R*.025,y=Math.sin(a)*rr*.92;
        if(f.outer){x=(f.sx-.5)*w*1.05+Math.sin(motion*.09+f.phase)*12;y=f.sy*h-this.cy+Math.cos(motion*.08+f.phase)*10;
          const r=Math.hypot(x,y);if(r<R*1.12){const k=R*1.12/Math.max(1,r);x*=k;y*=k;}}

        const alpha=bloomAlpha*(.27+f.variation*.4)*(.7+.3*Math.sin(motion*.45+f.phase)**2);
        if(f.variation>.12)this.flake(x,y,3+f.size*2.3,alpha,a,this.palette[Math.floor(f.phase/TAU*5)],this.state.pattern);
        else{c.fillStyle=`rgba(224,229,245,${alpha})`;c.beginPath();c.ellipse(x,y,f.size*(1.2-f.variation*.5),f.size*.7,a,0,TAU);c.fill();}
      }
      if(this.spread<.97){
      // Delicate secondary ribs create a translucent layer behind the main crystal.
      c.save();c.scale(1.035,1.035);c.rotate(.012);c.strokeStyle=`rgba(206,203,237,${.15*bloomAlpha*(1-this.spread)})`;c.lineWidth=1.2;c.beginPath();
      for(const edge of this.threads){c.moveTo(edge.x*R,edge.y*R);c.lineTo(edge.xx*R,edge.yy*R);}c.stroke();c.restore();
      c.strokeStyle=`rgba(186,231,236,${.23*bloomAlpha*(1-this.spread)})`;c.lineWidth=.6;c.shadowColor='#c4f7fc';c.shadowBlur=1;c.beginPath();
      for(const edge of this.threads){const {x,y,xx,yy,bend}=edge;c.moveTo(x*R,y*R);c.quadraticCurveTo((x+xx)*R/2+bend*R,(y+yy)*R/2-bend*R,xx*R,yy*R);}c.stroke();c.shadowBlur=0;
      }
      const fx=((this.state.fieldX??.58)*w-this.cx)/R,fy=((this.state.fieldY??.43)*h-this.cy)/R;
      const fieldX=fx*Math.cos(rot)+fy*Math.sin(rot),fieldY=-fx*Math.sin(rot)+fy*Math.cos(rot);
      const springStep=Math.min(dt,.033);
      for(const p of this.points) {
        const off=this.spread+this.sceneMix*1.5;
        // A coherent slow current replaces a static scattered point cloud.
        const spreadX=(p.sx-.5)*w*.99,spreadY=(p.sy*h-this.cy)*.99;
        const driftX=Math.sin(motion*.26+p.sy*TAU)*w*.025+Math.sin(motion*.4+p.phase)*8,driftY=Math.cos(motion*.21+p.sx*TAU)*h*.03;
        // Inverse rotation keeps the dispersed field rectangular, even on wide screens.
        const screenX=(spreadX+driftX)/R,screenY=(spreadY+driftY)/R;
        const targetX=screenX*Math.cos(rot)+screenY*Math.sin(rot),targetY=-screenX*Math.sin(rot)+screenY*Math.cos(rot);
        let tx=mix(p.u+p.jx,targetX,this.spread),ty=mix(p.v+p.jy,targetY,this.spread);
        const md=Math.hypot(p.x-fieldX,p.y-fieldY),influence=Math.max(0,1-md/1.0)*this.fieldBlend;
        if(influence>0){tx=mix(tx,fieldX,influence*.85);ty=mix(ty,fieldY,influence*.85);}
        const ox=p.x,oy=p.y,k=28+p.depth*16;
        if(this.reducedMotion){p.x=tx;p.y=ty;p.vx=0;p.vy=0;}
        else{
          p.vx=(p.vx+(tx-p.x)*k*springStep)*Math.exp(-7*springStep);
          p.vy=(p.vy+(ty-p.y)*k*springStep)*Math.exp(-7*springStep);
          p.x=clamp(p.x+p.vx*springStep,-12,12);p.y=clamp(p.y+p.vy*springStep,-12,12);
        }
        const twinkle=.72+.28*Math.sin(motion*.9+p.phase)**2,alpha=p.alpha*(.8+this.spread*.15)*twinkle*bloomAlpha;
        const size=p.size*(.75+p.depth*.5)*(1+influence*.5),x=p.x*R,y=p.y*R;
        // Short brush-like traces only when moving, never a permanent neon trail.
        if(!this.reducedMotion&&(this.spread>.1||influence>.05)&&p.kind===0){
          c.strokeStyle=`rgba(210,221,245,${alpha*.25})`;c.lineWidth=size*.65;c.beginPath();c.moveTo(x,y);c.lineTo(ox*R-p.vx*R*.025,oy*R-p.vy*R*.025);c.stroke();
        }
        c.fillStyle=p.kind===1?`rgba(240,225,242,${alpha})`:p.kind===2?`rgba(220,238,240,${alpha})`:`rgba(233,240,249,${alpha})`;
        if(p.kind===0&&size>1){c.save();c.translate(x,y);c.rotate(p.phase+motion*.08);c.fillRect(-size*.4,-size,size*.8,size*2);c.restore();}
        else{c.beginPath();c.arc(x,y,size,0,TAU);c.fill();}
      }
      // Mid plane: frost deposited unevenly along the crystal branches.
      for(const f of this.frost){
        const open=this.spread*(.35+f.variation*.8),a=f.a+motion*.035;
        const x=(f.u+Math.cos(a)*open)*R,y=(f.v+Math.sin(a)*open)*R;
        const alpha=(.09+f.variation*.24)*bloomAlpha;
        c.fillStyle=f.variation>.65?`rgba(249,237,228,${alpha})`:f.variation>.32?`rgba(211,226,245,${alpha})`:`rgba(226,212,240,${alpha})`;
        c.beginPath();c.ellipse(x,y,f.size*(.7+this.scale*.3),f.size*.6,f.a,0,TAU);c.fill();
      }
      // Front plane: sparse cut-crystal facets, bright tips, and tiny satellite flakes.
      for(const f of this.facets){
        const k=1+this.spread*1.2,x=f.u*R*k,y=f.v*R*k,sz=f.size*(.85+this.scale*.15);
        c.save();c.translate(x,y);c.rotate(f.a+Math.PI/2+this.spread*.4);
        c.fillStyle=`rgba(238,244,250,${(.14+f.variation*.19)*bloomAlpha})`;c.strokeStyle=`rgba(241,240,248,${.26*bloomAlpha})`;c.lineWidth=.45;
        c.beginPath();c.moveTo(0,-sz*1.5);c.lineTo(sz*.5,0);c.lineTo(0,sz*1.5);c.lineTo(-sz*.5,0);c.closePath();c.fill();c.stroke();c.restore();
      }
      for(let arm=0;arm<6;arm++){
        const a=arm*TAU/6-Math.PI/2,r=R*(1+this.spread*.75);
        this.flake(Math.cos(a)*r,Math.sin(a)*r,4.5+this.scale*1.5,.48*bloomAlpha,a+motion*.04);
        const b=a+TAU/12,rr=R*(.71+this.spread*.8);
        this.flake(Math.cos(b)*rr,Math.sin(b)*rr,3.5,.25*bloomAlpha,-a);
      }
      c.fillStyle=`rgba(234,255,255,${.9*bloomAlpha*(1-this.spread)})`;c.shadowBlur=2;c.shadowColor='#bcf7ff';c.beginPath();c.arc(0,0,2.4,0,TAU);c.fill();c.shadowBlur=0;c.restore();
    }
    if(this.sceneMix>.005&&this.state.scene!=='sprawl') {
      const count=Math.round(400+this.storm*1150),sprites=this.storm>.18?this.stormSprites[this.state.snowPalette||0]:this.snowfallSprites;
      for(let i=0;i<count;i++){
        const p=this.snow[i],depth=p.variation,speed=this.state.snowSpeed;
        const gust=Math.sin(t*.72+p.p*.18)*.014+Math.sin(t*1.8+p.p)*.008;
        const vx=(.003+this.storm*(.025+depth*.08))+gust*(.3+this.storm)*(.2+depth);
        const vy=(.027+depth*depth*.16)*speed*(1+this.storm*.7);
        if(!this.reducedMotion){p.x+=dt*vx;p.y+=dt*vy;}
        if(p.y>1.14){p.y=-.14-random()*.12;p.x=random()*1.3-.15;}
        if(p.x>1.2)p.x=-.18;if(p.x<-.2)p.x=1.18;
        const x=p.x*w+Math.sin(t*(.35+depth*.28)+p.p)*(6+depth*15),y=p.y*h;
        const near=depth>.91,far=depth<.28,blur=near?2:far?1:0;
        const r=p.r*(.22+depth*depth*(2.4+this.storm*.75))*(this.mobile?.8:1);
        const edgeFade=clamp((count-i)/90,0,1),alpha=(far?.28:near?.46:.79)*this.sceneMix*(1-Math.min(1,this.vortex)*.74)*edgeFade;
        const color=(p.color+(this.storm>.5?Math.floor(t*.065):0))%5,sprite=sprites?.[blur*15+color*3+p.type];
        // Short soft echoes suggest wind-blown falling snow; flakes remain visible.
        if(sprite&&this.storm>.15&&depth>.68&&!this.reducedMotion){
          const tail=Math.min(30,vy*h*.022*this.storm);
          c.save();c.globalAlpha=alpha*.13;c.drawImage(sprite,x-r-vx*w*.018,y-r-tail,r*2,r*2+tail*.3);c.restore();
        }
        if(sprite){c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(t*(.06+depth*.13)+p.p);c.scale(.76+.24*Math.abs(Math.cos(t*.3+p.p)),1);c.drawImage(sprite,-r,-r,r*2,r*2);c.restore();}
        else this.flake(x,y,r,alpha,t*.08+p.p,this.palette[color],p.type);
      }
      if(this.vortex>.015) {
        // Dense multi-strand snow funnel follows the real hand midpoint in both axes.
        const strength=Math.min(1.25,this.vortex)*this.sceneMix,m=this.reducedMotion?0:t;
        const cx=w*this.vortexCenterX,cy=h*this.vortexCenterY;
        const base=Math.min(w*.31,h*.54)*clamp(this.radius/.22,.72,1.18);
        c.save();c.globalCompositeOperation='screen';
        const mist=c.createRadialGradient(cx,cy,0,cx,cy,base*1.05);mist.addColorStop(0,'rgba(152,220,255,'+strength*.045+')');mist.addColorStop(.65,'rgba(157,216,250,'+strength*.025+')');mist.addColorStop(1,'rgba(157,216,250,0)');c.fillStyle=mist;c.fillRect(cx-base*1.1,cy-base*1.1,base*2.2,base*2.2);
        for(let i=0;i<this.swirl.length;i++){
          const p=this.swirl[i],u=(p.r+m*.075*this.state.snowSpeed)%1;
          const angle=u*TAU*(2.8+.15*Math.sin(m*.25))+m*1.65;
          const radius=base*(.37+.63*Math.pow(Math.abs(u-.5)*2,.78))*(1+.065*Math.sin(m*.7+u*TAU));
          const band=(p.variation-.5)*base*.32,front=(Math.cos(angle)+1)*.5;
          const x=cx+Math.sin(angle)*radius+Math.cos(p.a+angle)*band+Math.sin(u*TAU+m*.55)*base*.055;
          const y=cy+(u-.5)*h*1.35+Math.sin(p.a+angle)*band*.45;
          const alpha=strength*(.20+front*.43)*(1-Math.abs(p.variation-.5)*.7);
          const size=4+front*8+p.variation*3;
          const sprite=this.snowfallSprites[(front<.16?15:0)+(i%5)*3+i%3];
          c.save();c.globalAlpha=Math.min(.9,alpha*1.5);c.translate(x,y);c.rotate(angle*.7+p.a+m*.2);c.scale(.74+.26*Math.abs(Math.cos(p.a+m*.25)),1);c.drawImage(sprite,-size,-size,size*2,size*2);c.restore();
        }
        c.restore();
      }
    }
    for(const f of this.extra) {f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=dt*((f.trail||f.love)?.3:8);this.flake(f.x,f.y,f.r,clamp(f.life/2,0,1),f.a+t*.2);}
    this.extra=this.extra.filter(f=>f.life>0);
    const shade=c.createLinearGradient(0,0,w,0);shade.addColorStop(0,'rgba(6,18,28,.15)');shade.addColorStop(.34,'rgba(6,18,28,0)');shade.addColorStop(1,'rgba(6,18,28,.04)');c.fillStyle=shade;c.fillRect(0,0,w,h);
  }
}

// 3. Sprawl: bounded world-space crystal growth, isolated gesture routing.
class SprawlScene {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.segments=[];this.archives=[];this.tips=[];this.links=[];this.crystals=[];this.orbs=[];this.shards=[];this.burst=null;this.effect='none';this.fistSince=null;this.shatterOpenSince=null;this.shatterArmed=false;this.okSince=null;this.okLatched=false;this.okRelease=null;this.zoom=1;this.center={x:0,y:0};this.paused=false;this.drive=0;this.active=0;this.group=0;this.lastSeen=-Infinity;this.contact=false;this.dualSince=null;this.dualFired=false;this.linkSince=null;this.linkFired=false;this.zoomStart=null;this.time=0;this.acc=0;this.turn=0;this.wrist=null;this.notice=()=>{};}
  resetInput(){this.drive=0;this.contact=false;this.dualSince=null;this.dualFired=false;this.linkSince=null;this.linkFired=false;this.zoomStart=null;this.wrist=null;this.turn=0;this.growArmed=false;this.pinchSince=null;this.okSince=null;this.okLatched=false;this.okRelease=null;this.fistSince=null;this.shatterOpenSince=null;this.shatterArmed=false;}
  selectEffect(effect,force=false){
    if(!force&&this.effect===effect)return;
    this.effect=effect;this.segments=[];this.archives=[];this.tips=[];this.links=[];this.orbs=[];this.shards=[];this.burst=null;
    this.drive=0;this.active=0;this.growArmed=false;this.turn=0;this.wrist=null;this.paused=false;this.acc=0;
    this.center={x:0,y:0};this.zoom=1;this.fistSince=null;this.shatterOpenSince=null;this.shatterArmed=false;this.okSince=null;this.okLatched=false;this.okRelease=null;artwork.extra=[];
  }
  dimensions(){return {w:artwork.w,h:artwork.h,cx:artwork.w*.5,cy:artwork.mobile?470:artwork.h*.47};}
  world(p){const {w,h,cx,cy}=this.dimensions();return {x:(p.x*w-cx)/this.zoom+this.center.x,y:(p.y*h-cy)/this.zoom+this.center.y};}
  toggle(){if(!this.paused)this.savedDrive=this.drive||this.savedDrive||.8;this.paused=!this.paused;if(!this.paused&&this.active)this.drive=this.savedDrive||.8;this.notice(this.paused?'Growth paused':'Growth resumed','Use Pause to pause or resume');}
  process(hands,now){
    this.inputSource='hands';
    // A missed video frame must not erase the seed or an ongoing pinch.
    if(!hands.length){this.fistSince=null;this.wrist=null;this.turn*=.8;this.pinchSince=null;this.okSince=null;if(this.okRelease===null)this.okRelease=now;if(now-this.okRelease>500)this.okLatched=false;return;}
    this.lastSeen=now;const poses=hands.map(handPose);
    if(hands.length===2&&this.effect==='orb'&&this.orbs.length&&poses.every(p=>p.gesture==='Closed_Fist')){
      if(this.fistSince===null)this.fistSince=now;
      if(now-this.fistSince>=450)this.shatterOrb();
      this.pinchSince=null;return;
    }
    this.fistSince=null;
    if(hands.length===2){this.wrist=null;this.turn=0;this.pinchSince=null;this.okSince=null;
      this.dualSince=null;this.dualFired=false;
      const pointing=poses.every(p=>p.gesture==='Pointing_Up'||(p.extended[0]&&p.extended.slice(1).filter(Boolean).length<=1));
      if(pointing){this.zoomStart=null;if(this.linkSince===null)this.linkSince=now;if(now-this.linkSince>=180&&!this.linkFired){this.connect(hands[0].points[8],hands[1].points[8]);this.linkFired=true;}return;}
      this.linkSince=null;this.linkFired=false;
      if(poses.every(p=>p.gesture==='Open_Palm'||p.extended.filter(Boolean).length>=3)){
        const d=distance(hands[0].points[9],hands[1].points[9]);if(!this.zoomStart)this.zoomStart={d:Math.max(.08,d),variation:this.zoom};this.zoom=clamp(this.zoomStart.variation*this.zoomStart.d/Math.max(.08,d),.08,3);this.notice('A wider winter',Math.round(this.zoom*100)+'% view');
      }else this.zoomStart=null;return;
    }
    this.dualSince=null;this.dualFired=false;this.zoomStart=null;this.linkSince=null;this.linkFired=false;
    const h=hands[0],p=h.points,ratio=poses[0].ratio;
    // Relative hand movement preserves the centred spawn without a position jump.
    for(const orb of this.orbs){
      if(!orb.anchor)orb.anchor={x:p[9].x,y:p[9].y};
      orb.target=this.world({x:clamp(.5+p[9].x-orb.anchor.x,.12,.88),y:clamp(.5+p[9].y-orb.anchor.y,.14,.86)});
    }
    // OK is contact plus three extended fingers; reserve it before ordinary pinch.
    const ok=ratio<.42&&poses[0].extended.slice(1).every(Boolean);
    if(ok){this.pinchSince=null;this.okRelease=null;if(this.okSince===null)this.okSince=now;
      if(now-this.okSince>=550&&!this.okLatched){this.spawnOrb();this.orbs[0].anchor={x:p[9].x,y:p[9].y};this.okLatched=true;}return;}
    this.okSince=null;
    if(this.okLatched){if(ratio<.55)return;if(this.okRelease===null)this.okRelease=now;if(now-this.okRelease<350)return;this.okLatched=false;this.okRelease=null;this.contact=false;}
    // Thumb/index landmarks own ordinary pinch; tracking loss never erases growth.
    const aspect=h.aspect||4/3,reach=Math.hypot((p[8].x-p[0].x)*aspect,p[8].y-p[0].y)/Math.max(.025,Math.hypot((p[9].x-p[0].x)*aspect,p[9].y-p[0].y));
    if(poses[0].gesture!=='Closed_Fist'&&ratio<.36&&reach>.85&&poses[0].extended.slice(1).filter(Boolean).length<2){
      if(!this.contact){if(this.pinchSince===null||this.pinchSince===undefined)this.pinchSince=now;
        if(now-this.pinchSince>=260){this.contact=true;this.wrist=null;this.turn=0;
          if(this.growArmed&&this.active){this.drive=0;this.growArmed=false;this.notice('Crystal resting','Open, then pinch again to plant');}
          else{this.seed({x:(p[4].x+p[8].x)/2,y:(p[4].y+p[8].y)/2});this.growArmed=true;this.paused=false;}
        }
      }return;
    }
    this.pinchSince=null;
    if(ratio>.48){
      this.contact=false;
      if(this.growArmed&&this.active){
        this.drive=clamp((ratio-.3)*1.5,.25,2.0);
        const a=Math.atan2(p[9].y-p[0].y,(p[9].x-p[0].x)*(h.aspect||4/3));if(this.wrist===null)this.wrist=a;
        const d=Math.atan2(Math.sin(a-this.wrist),Math.cos(a-this.wrist));this.turn=mix(this.turn,Math.abs(d)<.055?0:clamp(d*1.7,-1.6,1.6),.35);
        this.notice(this.paused?'Growth paused':Math.abs(this.turn)>.16?'Guiding the frost':'Crystal unfolding',this.paused?'Use Pause to resume':'Open to grow · Pinch to stop');
      }
    }
  }
  add(a,b,depth=0){if(this.segments.length>=5000)this.archiveSegments();this.segments.push({x:a.x,y:a.y,xx:b.x,yy:b.y,depth,born:this.time,tint:Math.floor(random()*3)});}
  archiveSegments(){
    // Keep old ice as cached vector paths rather than deleting it at a segment cap.
    const saved=this.segments.splice(0,2500),paths=Array.from({length:4},()=>new Path2D());
    const box={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
    for(let i=0;i<saved.length;i++){
      const s=saved[i],path=paths[Math.min(3,s.depth)];path.moveTo(s.x,s.y);path.lineTo(s.xx,s.yy);
      box.left=Math.min(box.left,s.x,s.xx);box.right=Math.max(box.right,s.x,s.xx);box.top=Math.min(box.top,s.y,s.yy);box.bottom=Math.max(box.bottom,s.y,s.yy);
      const dx=s.xx-s.x,dy=s.yy-s.y,len=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
      if(len>5)for(let j=1,n=Math.min(10,Math.floor(len/3));j<=n;j++){
        const f=j/(n+1),x=mix(s.x,s.xx,f),y=mix(s.y,s.yy,f),r=(3+Math.sin(f*Math.PI)*7)/(1+s.depth*.35);
        for(const sign of[-1,1]){path.moveTo(x,y);path.lineTo(x+Math.cos(a+sign*Math.PI/3)*r,y+Math.sin(a+sign*Math.PI/3)*r);}
      }
      if(i%37===18)for(let arm=0;arm<6;arm++){const a=arm*TAU/6,r=5.5/(1+s.depth*.18);path.moveTo(s.x,s.y);path.lineTo(s.x+Math.cos(a)*r,s.y+Math.sin(a)*r);}
    }
    this.archives.push({paths,box,count:saved.length});
  }
  seed(p={x:.5,y:.47}){
    this.selectEffect('growth');
    const q=this.world(p);this.active=++this.group;

    for(let i=0;i<6;i++){const a=i*TAU/6-Math.PI/2,b={x:q.x+Math.cos(a)*12,y:q.y+Math.sin(a)*12};
      this.add(q,b,0);this.tips.push({x:b.x,y:b.y,a,age:0,group:this.active,depth:0});}
    this.notice('A six-arm crystal takes root','Pinch + release: grow · Pinch: rest · OK: ice globe');
  }
  spawnOrb(p={x:.58,y:.38}){
    this.selectEffect('orb',true);this.contact=false;
    const {w,h}=this.dimensions(),q=this.world({x:.5,y:.5});
    const flakes=Array.from({length:64},(_,i)=>{const a=i*2.3999632297,r=Math.sqrt((i+.5)/64)*.83;return {u:Math.cos(a)*r,v:Math.sin(a)*r,variation:random(),opacity:.3+random()*.28,size:i%15===0?18+random()*5:5+random()*8,phase:random()*TAU};});
    this.orbs.push({x:q.x,y:q.y,r:Math.min(w*.32,h*.30)/this.zoom,target:{x:q.x,y:q.y},born:this.time,flakes});
    this.notice('An ice globe blooms','Move hand: guide · Two fists: release · Fast left swipe: previous scene');
  }
  connect(a={x:.34,y:.46},b={x:.66,y:.46}){
    const {w,h}=this.dimensions();if(Math.hypot((a.x-b.x)*w,(a.y-b.y)*h)<20)return;
    this.selectEffect('connect');const A=this.world(a),B=this.world(b);
    this.paused=false;this.links.push({a:A,b:B,t:0,branch:0});this.links=this.links.slice(-6);this.notice('Two crystals, one winter','Two index fingers connect · Pinch switches to crystal growth');
  }
  shatterOrb(){
    if(!this.orbs.length)return;
    const orb=this.orbs[0],age=Math.max(0,this.time-orb.born),radius=orb.r*(.12+.88*(1-Math.exp(-age*1.5))),angle=age*.17;
    const origin={x:(orb.x-this.center.x)*this.zoom,y:(orb.y-this.center.y)*this.zoom,r:radius*this.zoom,born:this.time};
    const pieces=Array.from({length:260},(_,i)=>{
      const source=orb.flakes[i%orb.flakes.length],variation=source.variation,spread=.35+random()*.6;
      const x=(source.u*Math.cos(angle)-source.v*Math.sin(angle))*radius*spread,y=(source.u*Math.sin(angle)+source.v*Math.cos(angle))*radius*spread;
      const direction=Math.hypot(x,y)>8?Math.atan2(y,x)+(random()-.5)*.65:random()*TAU;
      const speed=(620+random()*960)*(.75+variation*.4);
      return {x:origin.x+x*this.zoom,y:origin.y+y*this.zoom,vx:Math.cos(direction)*speed,vy:Math.sin(direction)*speed*.86,r:10+random()*20,a:random()*TAU,spin:(random()-.5)*2.8,variation,phase:random()*TAU,alpha:.32+random()*.38};
    });
    this.selectEffect('shards',true);this.shards=pieces;this.burst=origin;this.contact=false;this.okLatched=false;this.okRelease=null;
    this.notice('Ice, shattered','Transparent frost crystals · OK makes a new globe');
  }
  advance(dt){if(this.paused)return;this.acc+=dt;while(this.acc>=.045){this.acc-=.045;
      if(this.drive>0){const selected=this.tips.filter(t=>t.group===this.active),fresh=[];for(const tip of selected){const old={x:tip.x,y:tip.y};tip.a+=this.turn*.025;const step=(1.3+this.drive*3.5)/(1+tip.depth*.12);tip.x+=Math.cos(tip.a)*step;tip.y+=Math.sin(tip.a)*step;tip.age++;if(tip.segment&&tip.age%6!==0){tip.segment.xx=tip.x;tip.segment.yy=tip.y;}else{this.add(old,tip,tip.depth);tip.segment=this.segments[this.segments.length-1];}
          if(tip.age%18===0){const len=5+this.drive*3;for(const sign of [-1,1])this.add(tip,{x:tip.x+Math.cos(tip.a+sign*1.1)*len,y:tip.y+Math.sin(tip.a+sign*1.1)*len},3);}
          if(tip.age%22===0&&tip.depth<2&&selected.length+fresh.length<90){for(const sign of [-1,1])fresh.push({x:tip.x,y:tip.y,a:tip.a+sign*Math.PI/3,age:1,group:tip.group,depth:tip.depth+1});}
        }this.tips.push(...fresh);this.tips=this.tips.filter(t=>t.group===this.active);if(this.inputSource==='manual')this.turn*=.98;
      }
    }
    for(const link of this.links){if(link.t>=.5)continue;
      const prev=link.t;link.t=Math.min(.5,link.t+dt*.105);
      // Restore the earlier fern connection, using one shared path so tips meet exactly.
      const dx=link.b.x-link.a.x,dy=link.b.y-link.a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
      const at=t=>({x:mix(link.a.x,link.b.x,t)+nx*Math.sin(t*Math.PI)*18,y:mix(link.a.y,link.b.y,t)+ny*Math.sin(t*Math.PI)*18});
      for(const reverse of [false,true]){
        const a=at(reverse?1-prev:prev),b=at(reverse?1-link.t:link.t);this.add(a,b,0);
        if(Math.floor(link.t*24)>Math.floor(prev*24)){
          const angle=Math.atan2(b.y-a.y,b.x-a.x),size=10+Math.sin(link.t*Math.PI*2)*13;
          for(const sign of [-1,1]){const theta=angle+sign*Math.PI/3,end={x:b.x+Math.cos(theta)*size,y:b.y+Math.sin(theta)*size};this.add(b,end,1);
            const mid={x:mix(b.x,end.x,.58),y:mix(b.y,end.y,.58)};
            this.add(mid,{x:mid.x+Math.cos(theta+sign*.8)*size*.35,y:mid.y+Math.sin(theta+sign*.8)*size*.35},2);
          }
        }
      }
    }
    this.links=this.links.filter(l=>l.t<.5);
  }
  drawCrystal(x,y,r,alpha,a){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(a);c.strokeStyle='rgba(236,248,255,'+alpha+')';c.lineWidth=.7/Math.sqrt(this.zoom);c.beginPath();
    for(let i=0;i<6;i++){const a=i*TAU/6,cs=Math.cos(a),sn=Math.sin(a);c.moveTo(0,0);c.lineTo(cs*r,sn*r);for(const sign of[-1,1]){const t=r*.56;c.moveTo(cs*t,sn*t);c.lineTo(cs*t+Math.cos(a+sign*Math.PI/3)*r*.3,sn*t+Math.sin(a+sign*Math.PI/3)*r*.3);}}c.stroke();c.restore();
  }
  drawOrbFlake(x,y,r,alpha,angle,variation){
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=alpha;
    // Translucent 2D polygons with a fixed per-snowflake line style.
    const blade=(x,y,a,len,width)=>{c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.moveTo(0,0);c.lineTo(len*.46,-width);c.lineTo(len,0);c.lineTo(len*.46,width);c.closePath();c.fillStyle='rgba(184,224,250,.25)';c.fill();
      c.beginPath();c.moveTo(0,0);c.lineTo(len*.46,-width);c.lineTo(len,0);c.fillStyle='rgba(244,252,255,.4)';c.fill();c.strokeStyle='rgba(232,249,255,.9)';c.lineWidth=(variation>.5?.8:.55)/Math.sqrt(this.zoom);c.beginPath();c.moveTo(0,0);c.lineTo(len,0);c.stroke();c.restore();};
    for(let i=0;i<6;i++){const a=i*TAU/6;blade(0,0,a,r,r*.075);for(const f of[.4,.66])for(const sign of[-1,1])blade(Math.cos(a)*r*f,Math.sin(a)*r*f,a+sign*Math.PI/3,r*(1-f)*.55,r*.045);}
    c.restore();
  }
  drawGlassShell(x,y,r,alpha,front){
    // A flatter transparent cover: uniform tint and a clean restrained outline.
    const c=this.ctx;c.save();c.translate(x,y);c.globalAlpha=alpha;
    if(!front){c.fillStyle='rgba(199,232,250,.025)';c.beginPath();c.arc(0,0,r,0,TAU);c.fill();c.strokeStyle='rgba(207,240,255,.22)';c.lineWidth=.9/this.zoom;c.stroke();}
    else{
      c.strokeStyle='rgba(211,243,255,.31)';c.lineWidth=1.1/this.zoom;c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
      c.strokeStyle='rgba(238,252,255,.32)';c.lineWidth=r*.009;c.lineCap='round';c.beginPath();c.arc(0,0,r*.976,Math.PI*1.08,Math.PI*1.42);c.stroke();
      c.strokeStyle='rgba(174,230,255,.18)';c.lineWidth=.9/this.zoom;c.beginPath();c.arc(0,0,r*.99,Math.PI*.29,Math.PI*.61);c.stroke();
    }c.restore();
  }
  drawFrostCrystal(p,age){
    const c=this.ctx,r=p.r*(1+Math.max(0,p.variation)*.28*(1-Math.exp(-age*3)));
    c.save();c.translate(p.x,p.y);c.rotate(p.a);c.scale(.5+.5*Math.abs(Math.cos(p.a*.7+p.phase)),1);
    // Near-clear faceted ice arms, with bright ridges and delicate frost needles.
    for(let arm=0;arm<6;arm++){
      c.save();c.rotate(arm*TAU/6);const width=r*.11;
      c.beginPath();c.moveTo(0,0);c.lineTo(r*.44,-width);c.lineTo(r,0);c.lineTo(r*.44,width);c.closePath();c.fillStyle='rgba(184,230,255,'+p.alpha*.045+')';c.fill();
      c.strokeStyle='rgba(217,246,255,'+p.alpha*.46+')';c.lineWidth=.55/Math.sqrt(this.zoom);c.stroke();
      c.beginPath();c.moveTo(0,0);c.lineTo(r,0);c.strokeStyle='rgba(246,254,255,'+p.alpha*.58+')';c.stroke();
      c.strokeStyle='rgba(195,232,252,'+p.alpha*.62+')';c.lineWidth=.42/Math.sqrt(this.zoom);c.beginPath();
      for(const f of[.32,.51,.7])for(const sign of[-1,1]){const x=r*f,l=r*(1-f)*.72,ex=x+l*.5,ey=sign*l*.866;c.moveTo(x,0);c.lineTo(ex,ey);for(const q of[.4,.7]){const bx=mix(x,ex,q),by=ey*q;c.moveTo(bx,by);c.lineTo(bx+l*(1-q)*.22,by-sign*l*(1-q)*.15);}}c.stroke();c.restore();
    }
    c.restore();
  }
  drawIceShards(dt){
    const c=this.ctx,{w,h,cx,cy}=this.dimensions(),age=this.burst?Math.max(0,this.time-this.burst.born):10;
    if(this.burst&&age<.72){
      const b=this.burst,life=1-age/.72,r=b.r*(.75+age*2.4);
      c.save();c.globalCompositeOperation='screen';
      if(age<.22){const flash=c.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*1.1);flash.addColorStop(0,'rgba(213,246,255,'+(.14*(1-age/.22))+')');flash.addColorStop(1,'rgba(193,238,255,0)');c.fillStyle=flash;c.fillRect(b.x-b.r*1.2,b.y-b.r*1.2,b.r*2.4,b.r*2.4);}
      c.strokeStyle='rgba(194,238,255,'+life*.19+')';c.lineWidth=(1+life*2)/this.zoom;c.beginPath();c.ellipse(b.x,b.y,r,r*.91,0,0,TAU);c.stroke();
      c.strokeStyle='rgba(227,250,255,'+life*.10+')';c.lineWidth=.7/this.zoom;c.beginPath();c.arc(b.x,b.y,r*1.1,0,TAU);c.stroke();c.restore();
    }
    const left=this.center.x+(-35-cx)/this.zoom,right=this.center.x+(w+35-cx)/this.zoom,top=this.center.y+(-35-cy)/this.zoom,bottom=this.center.y+(h+35-cy)/this.zoom;
    for(const p of this.shards){
      const oldX=p.x,oldY=p.y;
      if(!this.paused){const damping=Math.exp(-dt*(age<.9?2.3:1.6));p.vx*=damping;p.vy*=damping;p.x+=(p.vx+Math.sin(this.time*.4+p.phase)*4/this.zoom)*dt;p.y+=(p.vy+Math.cos(this.time*.3+p.phase)*3/this.zoom)*dt;p.a+=p.spin*dt;
        if(age>1.2){if(p.x<left)p.x=right-15;if(p.x>right)p.x=left+15;if(p.y<top)p.y=bottom-15;if(p.y>bottom)p.y=top+15;}}
      if(age<.65){c.strokeStyle='rgba(207,243,255,'+p.alpha*.25*(1-age/.65)+')';c.lineWidth=.7/Math.sqrt(this.zoom);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(oldX-(p.x-oldX)*1.8,oldY-(p.y-oldY)*1.8);c.stroke();}
      this.drawFrostCrystal(p,age);
    }
  }
  draw(dt,now){if(!this.paused)this.time+=dt;
    this.advance(dt);const c=this.ctx,{w,h,cx,cy}=this.dimensions();
    // Fixed world centre and preserved segments prevent old crystals drifting away.
    c.save();c.translate(cx,cy);c.scale(this.zoom,this.zoom);c.translate(-this.center.x,-this.center.y);
    for(const archive of this.archives){
      const b=archive.box;if((b.right-this.center.x)*this.zoom+cx< -50||(b.left-this.center.x)*this.zoom+cx>w+50||(b.bottom-this.center.y)*this.zoom+cy< -50||(b.top-this.center.y)*this.zoom+cy>h+50)continue;
      archive.paths.forEach((path,depth)=>{c.strokeStyle='rgba(234,244,251,'+(.78/(1+depth*.12))+')';c.lineWidth=(depth?.65:1.15)/Math.sqrt(this.zoom);c.stroke(path);});
    }
    for(const s of this.segments){const x=(s.x-this.center.x)*this.zoom+cx,y=(s.y-this.center.y)*this.zoom+cy;if(x< -60||x>w+60||y< -60||y>h+60)continue;const alpha=.78/(1+s.depth*.12);c.strokeStyle=s.tint===0?`rgba(232,224,244,${alpha})`:s.tint===1?`rgba(208,235,239,${alpha})`:`rgba(242,241,244,${alpha})`;c.lineWidth=(s.depth? .7:1.25)/Math.sqrt(this.zoom);c.beginPath();c.moveTo(s.x,s.y);c.lineTo(s.xx,s.yy);c.stroke();
      // Fine, stable frost barbs grow across each stem, like frozen glass ferns.
      const dx=s.xx-s.x,dy=s.yy-s.y,len=Math.hypot(dx,dy);
      if(len>5){const angle=Math.atan2(dy,dx);c.lineWidth=.45/Math.sqrt(this.zoom);c.strokeStyle='rgba(225,242,251,'+alpha*.65+')';c.beginPath();
        const n=Math.min(10,Math.floor(len/3));for(let i=1;i<=n;i++){const f=i/(n+1),x=mix(s.x,s.xx,f),y=mix(s.y,s.yy,f),r=(3+Math.sin(f*Math.PI)*7)/(1+s.depth*.35);for(const sign of[-1,1]){c.moveTo(x,y);c.lineTo(x+Math.cos(angle+sign*Math.PI/3)*r,y+Math.sin(angle+sign*Math.PI/3)*r);}}c.stroke();
      }
    }
    // Six-arm crystalline nodes at junctions replace leaf-like long offshoots.
    for(let i=18;i<this.segments.length;i+=37){const p=this.segments[i];this.drawCrystal(p.x,p.y,5.5/(1+p.depth*.18),.55,0);}
    for(const orb of this.orbs){
      if(!this.paused&&orb.target){const ease=1-Math.exp(-Math.min(dt,.05)*5.5);orb.x=mix(orb.x,orb.target.x,ease);orb.y=mix(orb.y,orb.target.y,ease);}
      const age=Math.max(0,this.time-orb.born),grow=1-Math.exp(-age*1.5),radius=orb.r*(.12+.88*grow);
      const oy=orb.y,angle=age*.17,cs=Math.cos(angle),sn=Math.sin(angle);
      // Pure 2D rotation in a circular mask: only u/v plane coordinates.
      this.drawGlassShell(orb.x,oy,radius,grow,false);
      for(const f of orb.flakes){
        const x=orb.x+(f.u*cs-f.v*sn)*radius,y=oy+(f.u*sn+f.v*cs)*radius;
        this.drawOrbFlake(x,y,f.size*(.75+grow*.25),grow*f.opacity,f.phase+angle*.12,f.variation);
      }
      // Small 2D dots drift inside the circle without obscuring the background.
      c.save();c.globalAlpha=grow;for(let i=0;i<75;i++){const a=i*2.39996+age*.035,rr=radius*Math.sqrt((i+.5)/75)*.88,xx=orb.x+Math.cos(a)*rr,yy=oy+Math.sin(a)*rr*.96;c.fillStyle='rgba(223,245,255,'+(.12+(i%5)*.06)+')';c.beginPath();c.arc(xx,yy,(.5+(i%3)*.35)/Math.sqrt(this.zoom),0,TAU);c.fill();}c.restore();
      this.drawGlassShell(orb.x,oy,radius,grow,true);
    }
    this.drawIceShards(dt);
    for(const tip of this.tips){c.fillStyle='rgba(235,241,246,.65)';c.beginPath();c.arc(tip.x,tip.y,1.4/Math.sqrt(this.zoom),0,TAU);c.fill();}
    if(!this.segments.length&&!this.archives.length&&!this.orbs.length&&!this.shards.length){c.strokeStyle='rgba(233,239,248,.35)';c.lineWidth=1/this.zoom;for(let i=0;i<6;i++){const a=i*TAU/6;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*22,Math.sin(a)*22);c.stroke();}}
    c.restore();
  }
}

// 3. Camera and interface
// PART A — local camera / MediaPipe CPU adapter; only x/y landmarks are read.
// PART B — SnowController interactions and native Canvas artwork.
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

const cameraButton=$('#cameraStart'),video=$('#video'),overlay=$('#landmarks'),handCtx=overlay.getContext('2d');

const controller=new SnowController(onInteraction),artwork=new SnowArtwork($('#art'),controller.state,matchMedia('(prefers-reduced-motion: reduce)').matches);
const sprawl=new SprawlScene($('#art'));
sprawl.notice=(label,hint)=>{if(controller.state.scene==='sprawl'){$('#gestureLabel').textContent=label;$('#gestureHint').textContent=hint;}};
let recognizer=null,stream=null,cameraState='off',startVersion=0,inferenceErrors=0;
let lastFrame=performance.now(),lastVideoTime=-1,lastInference=0,lastResult=0,hands=[],toastTimer,activeTimer;

const CONNECTIONS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4200);}
function status(text,error=false){$('#cameraStatus').textContent=text;$('#cameraStatus').classList.toggle('error-text',error);}

function syncSlider(){if(controller.state.scene==='sprawl')return;const s=controller.state,fall=s.scene==='snowfall';$('#sliderLabel').firstChild.textContent=fall?'Speed ':'Size ';$('#sizeSlider').min=fall?'40':'50';$('#sizeSlider').max=fall?'240':'180';const value=Math.round((fall?s.snowSpeed:s.scale)*100);$('#sizeSlider').value=value;$('#sizeValue').textContent=fall?(s.snowSpeed.toFixed(1)+'×'):(value+'%');$('#rangeMin').textContent=fall?'Slow':'Small';$('#rangeMax').textContent=fall?'Fast':'Large';$('#sizeSlider').setAttribute('aria-label',fall?'Speed':'Size');}
function syncScene(){window.dispatchEvent(new CustomEvent('snowbloom:scene',{detail:{scene:controller.state.scene}}));const third=controller.state.scene==='sprawl';document.body.classList.toggle('is-sprawl',third);$('#sprawlControls').hidden=!third;$('.scale-control').hidden=third;
if(third){document.body.classList.remove('is-snowfall');$$('[data-scene]').forEach(b=>{const active=b.dataset.scene==='sprawl';b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('#bloomControls').hidden=true;$('#snowControls').hidden=true;$('#gestureLabel').textContent='Let winter take root';$('#gestureHint').textContent='Pinch: crystal · Two index fingers: connect · OK: globe · Two fists: release';return;}
const fall=controller.state.scene==='snowfall';document.body.classList.toggle('is-snowfall',fall);$$('[data-scene]').forEach(b=>{const active=b.dataset.scene===controller.state.scene;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('#bloomControls').hidden=fall;$('#snowControls').hidden=!fall;$('#patternName').textContent=fall?'SNOWFALL':PATTERN_NAMES[controller.state.pattern];$('#artState').textContent=fall?'Drifting':'Still';$('#gestureLabel').textContent=fall?'Let it snow':'A winter in your hands';$('#gestureHint').textContent=fall?'Bring open palms closer':'Fist to gather · Pinch to resize';syncSlider();}
function onInteraction(e){const labels={magnet:['Snow magnet','Thumb up and move your hand'],trail:['Snow trail','Move your index finger'],love:['Snow garland','I Love You gesture'],gather:['Gathering','Hold a fist'],spread:['Blooming','Close your hand to gather'],scale:['Resizing','Open or close thumb and index'],pattern:['A new shape','A different winter'],burst:['A small snowfall','Point to scatter snow'],speed:['Snow speed changed','Thumb up: slow · Down: fast'],vortex:['A stronger winter swirl','Move open palms to guide the vortex'],'vortex-armed':['Palms ready','Slowly bring them closer'],'vortex-end':['Settling','Open both palms to begin']};if(e.type==='scene'){syncScene();return;}if(e.type==='spread')artwork.scatterImpulse();if(e.type==='burst')artwork.burst(e.x,e.y);if(e.type==='trail')artwork.trail(e.x,e.y,e.from);if(e.type==='love')artwork.love(e.x,e.y);if(e.type==='pattern')$('#patternName').textContent=PATTERN_NAMES[e.state.pattern];if(labels[e.type]){$('#gestureLabel').textContent=labels[e.type][0];$('#gestureHint').textContent=labels[e.type][1];}if(['scale','speed'].includes(e.type))syncSlider();$('#artState').textContent=e.state.scene==='bloom'?(e.state.dispersed?'BLOOM':'GATHER'):(e.state.vortex?'VORTEX':'DRIFT');}
function resize(){artwork.resize(innerWidth,innerWidth<=760?1080:Math.max(innerHeight,760),devicePixelRatio||1);}addEventListener('resize',resize);resize();
function stopCamera(message='Camera off'){startVersion++;cameraState='off';if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;recognizer?.close();recognizer=null;hands=[];controller.endDual();controller.resetTracking();overlay.width=overlay.width;$('#cameraBox').classList.remove('has-video');$('#cameraDot').classList.remove('live');$('#modeLabel').classList.remove('live');$('#modeLabel').innerHTML='<i></i>Explore';cameraButton.disabled=false;cameraButton.querySelector('span').textContent='Enable camera';$('#cameraFallback').innerHTML='<svg><use href="#hand-icon"/></svg><span>Show your hand</span>';$('#handCount').textContent='0 HANDS';status(message);}
async function startCamera(){if(cameraState==='ready'){stopCamera();return;}if(cameraState==='starting')return;const version=++startVersion;cameraState='starting';cameraButton.disabled=true;cameraButton.querySelector('span').textContent='Preparing…';status('Loading hand tracking…');try{if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Open via HTTPS or localhost');
  // Load all model bytes from this Site; no CDN or remote camera upload at runtime.
  const mp=await import('./vendor/vision_bundle.mjs');const files=await mp.FilesetResolver.forVisionTasks(new URL('./vendor/wasm',import.meta.url).href);

  recognizer=await mp.GestureRecognizer.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./gesture_recognizer.task',import.meta.url).href,delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.45,minHandPresenceConfidence:.45,minTrackingConfidence:.45});
  if(version!==startVersion){recognizer?.close();recognizer=null;return;}
  status('Please allow camera access');const requested=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}}});
  if(version!==startVersion){requested.getTracks().forEach(t=>t.stop());return;}stream=requested;video.srcObject=stream;await video.play();if(version!==startVersion)return;
  cameraState='ready';lastVideoTime=-1;lastInference=0;lastResult=performance.now();inferenceErrors=0;
  $('#cameraBox').classList.add('has-video');$('#cameraBox').classList.remove('collapsed');$('#toggleCamera').textContent='−';$('#toggleCamera').setAttribute('aria-expanded','true');$('#cameraDot').classList.add('live');$('#modeLabel').classList.add('live');$('#modeLabel').innerHTML='<i></i>Connected';cameraButton.disabled=false;cameraButton.querySelector('span').textContent='Stop camera';status('Show your hand');toast('Try a fist, then open your hand');stream.getVideoTracks()[0].addEventListener('ended',()=>{if(cameraState==='ready'){stopCamera('Camera disconnected. Try again.');toast('Camera disconnected. Use the controls.');}});
}catch(error){if(version!==startVersion)return;console.error('Snow Bloom camera setup:',error);const message=error.name==='NotAllowedError'?'Camera access denied. Use the controls.':error.name==='NotFoundError'?'No camera found. Use the controls.':error.name==='NotReadableError'?'Camera busy. Close other camera apps.':'Could not start. Try again.';stopCamera(message);status(message,true);toast(message);cameraButton.querySelector('span').textContent='Try camera again';}}
function drawHands(){const w=video.videoWidth||640,h=video.videoHeight||480;if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;}handCtx.clearRect(0,0,w,h);for(const hand of hands){const pts=hand.points;handCtx.strokeStyle='rgba(184,235,219,.8)';handCtx.lineWidth=1.8;handCtx.beginPath();for(const [a,b] of CONNECTIONS){handCtx.moveTo(pts[a].x*w,pts[a].y*h);handCtx.lineTo(pts[b].x*w,pts[b].y*h);}handCtx.stroke();for(let i=0;i<21;i++){handCtx.fillStyle=i===4||i===8?'#ffe8ad':'#e5fff6';handCtx.beginPath();handCtx.arc(pts[i].x*w,pts[i].y*h,i===4||i===8?4:2.5,0,Math.PI*2);handCtx.fill();}}}
function infer(now){if(cameraState!=='ready'||!recognizer)return;if(video.readyState<2||video.currentTime===lastVideoTime){if(now-lastResult>600){hands=[];drawHands();$('#handCount').textContent='0 HANDS';status('Waiting for camera…');}return;}if(now-lastInference<45)return;lastInference=now;lastVideoTime=video.currentTime;
try{const result=recognizer.recognizeForVideo(video,now);inferenceErrors=0;lastResult=now;const sides=result.handedness||result.handednesses||[];hands=(result.landmarks||[]).map((lm,i)=>({points:lm.map(p=>({x:1-p.x,y:p.y})),gesture:result.gestures?.[i]?.[0]?.categoryName||'None',score:result.gestures?.[i]?.[0]?.score||0,aspect:(video.videoWidth||640)/(video.videoHeight||480),side:sides[i]?.[0]?.categoryName||String(i)}));controller.process(hands,now);drawHands();$('#handCount').textContent=hands.length+' HAND'+(hands.length===1?'':'S');status(hands.length?hands.map(h=>(h.side==='Left'?'Left':h.side==='Right'?'Right':'Hand')+' · '+(controller.pinch?'Pinch':GESTURES[h.gesture]||'Moving')).join(' / '):'Show your whole hand');}
catch(error){inferenceErrors++;if(inferenceErrors>=3){stopCamera('Tracking stopped. Try again.');toast('Tracking paused. Use the controls.');}console.warn('Snow Bloom inference:',error);}}
function loop(now){const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;if(!document.hidden){infer(now);controller.tick(now);artwork.draw(dt);if(controller.state.scene==='sprawl')sprawl.draw(dt,now);}requestAnimationFrame(loop);}requestAnimationFrame(loop);
cameraButton.addEventListener('click',startCamera);$('#toggleCamera').addEventListener('click',()=>{const collapsed=$('#cameraBox').classList.toggle('collapsed');$('#toggleCamera').textContent=collapsed?'+':'−';$('#toggleCamera').setAttribute('aria-expanded',String(!collapsed));});
$$('[data-scene]').forEach(b=>b.addEventListener('click',()=>controller.switchScene(b.dataset.scene)));
function manualAction(name){if(controller.state.scene==='sprawl'){sprawl.inputSource='manual';if(name==='grow'){if(!sprawl.active)sprawl.seed();sprawl.drive=sprawl.drive?0:.8;if(sprawl.drive)sprawl.paused=false;sprawl.notice(sprawl.drive?'Branches unfolding':'Growth resting','Pinch and open to grow by hand');}if(name==='orb')sprawl.spawnOrb();if(name==='shatter')sprawl.shatterOrb();if(name==='connect')sprawl.connect();if(name==='turn'){if(!sprawl.active)sprawl.seed();sprawl.drive=sprawl.drive||.8;sprawl.turn=sprawl.turn>0?-.9:.9;sprawl.notice(sprawl.turn>0?'Turning clockwise':'Turning counterclockwise','Click Turn again to reverse');}if(name==='pause')sprawl.toggle();if(name==='view'){sprawl.zoom=sprawl.zoom>.7?.5:1;sprawl.notice('A wider winter',Math.round(sprawl.zoom*100)+'% view');}return;}if(name==='pinch'){const slider=$('#sizeSlider');slider.focus();controller.action('scale',{value:controller.state.scale>=1.4?.7:controller.state.scale+.25});toast('Drag Size or press + / -');return;}controller.action(name);if(name==='Pointing_Up'){for(let i=1;i<=18;i++)artwork.trail(.39+i*.018,.48+Math.sin(i*.3)*.045,{x:.39+(i-1)*.018,y:.48+Math.sin((i-1)*.3)*.045});}const b=$$('[data-action]').find(b=>b.dataset.action===name);if(b){$$('[data-action]').forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');clearTimeout(activeTimer);activeTimer=setTimeout(()=>b.classList.remove('is-active'),700);}}
$$('[data-action]').forEach(b=>b.addEventListener('click',()=>manualAction(b.dataset.action)));$('#sizeSlider').addEventListener('input',e=>controller.action(controller.state.scene==='bloom'?'scale':'speed',{value:Number(e.target.value)/100}));
const dialog=$('#helpDialog');$('#helpButton').addEventListener('click',()=>dialog.showModal());$('#closeHelp').addEventListener('click',()=>dialog.close());$('#guideDone').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Fullscreen unavailable');}catch{toast('Open in a browser for fullscreen');}});
addEventListener('keydown',e=>{if(!dialog.open&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(!e.repeat)controller.stepScene(e.key==='ArrowRight'?1:-1);return;}if(controller.state.scene==='sprawl'&&!dialog.open&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)&&!e.ctrlKey&&!e.metaKey){const m={'1':'grow','2':'connect','3':'turn','4':'pause','5':'view','6':'orb','7':'shatter',' ':'pause'}[e.key];if(m){e.preventDefault();if(!e.repeat)manualAction(m);return;}if(e.key==='ArrowLeft'){e.preventDefault();controller.switchScene('snowfall');return;}if(['ArrowRight','+','=','-'].includes(e.key))return;}if(dialog.open||e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)||e.repeat)return;if(e.code==='Space'&&document.activeElement?.tagName==='BUTTON')return;const k=e.key.toLowerCase();if(['ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')controller.switchScene('snowfall');else if(e.key==='ArrowRight')controller.switchScene(controller.state.scene==='snowfall'?'sprawl':'bloom');else if(k==='v')$('#toggleCamera').click();else if(['+','=','-'].includes(k))controller.action('scale',{value:controller.state.scale+(k==='-'?-.1:.1)});else if(e.code==='Space')manualAction(controller.state.scene==='bloom'?(controller.state.dispersed?'Closed_Fist':'Open_Palm'):'vortex');else {const name={'1':'Closed_Fist','2':'Open_Palm','3':'Pointing_Up','4':'Victory','5':'Thumb_Up','6':'Thumb_Down','7':'ILoveYou','8':'Thumb_Up'}[k];if(name)manualAction(name);}});
addEventListener('pagehide',()=>stopCamera());document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.hidden){hands=[];controller.endDual();controller.resetTracking();lastResult=0;}});syncScene();


// A mouse can move the same magnetic field when the Magnet button is active.
addEventListener('pointermove',e=>{if(controller.state.fieldSource==='manual'&&controller.state.scene==='bloom'){controller.state.fieldX=e.clientX/artwork.w;controller.state.fieldY=(e.clientY+scrollY)/artwork.h;}});
