window.GraphEngine = (() => {
  class Graph {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.xMin=-10;this.xMax=10;this.yMin=-6;this.yMax=6;this.gridX=null;this.gridY=null;this.dpr=Math.min(window.devicePixelRatio||1,1.5);this.drag=null;this.functions=[];this.points=[];this.regions=[];this.parametrics=[];this.resize();this.bindPointer();}
    resize(){const r=this.canvas.getBoundingClientRect();this.canvas.width=Math.max(1,Math.floor(r.width*this.dpr));this.canvas.height=Math.max(1,Math.floor(r.height*this.dpr));this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.w=r.width;this.h=r.height;this.keepSquareScale();this.draw(this.functions,this.points,this.regions,this.parametrics);}
    setFunctions(f,points,regions,parametrics){this.functions=f||[];this.points=points||[];this.regions=regions||[];this.parametrics=parametrics||[];this.draw(this.functions,this.points,this.regions,this.parametrics);}
    zoom(f){const cx=(this.xMin+this.xMax)/2,cy=(this.yMin+this.yMax)/2,hw=(this.xMax-this.xMin)*f/2,hh=(this.yMax-this.yMin)*f/2;this.xMin=cx-hw;this.xMax=cx+hw;this.yMin=cy-hh;this.yMax=cy+hh;this.draw(this.functions,this.points,this.regions,this.parametrics);}
    reset(){this.xMin=-10;this.xMax=10;this.yMin=-5;this.yMax=5;this.keepSquareScale();this.draw(this.functions,this.points,this.regions,this.parametrics);}
    setGridSpacing(x,y){const gx=Number(x),gy=Number(y);if(Number.isFinite(gx)&&gx>0&&Number.isFinite(gy)&&gy>0){const step=Math.max(gx,gy);this.gridX=step;this.gridY=step;}else{this.gridX=null;this.gridY=null;}this.draw(this.functions,this.points,this.regions,this.parametrics);}
    keepSquareScale(){if(!this.w||!this.h)return;const cx=(this.xMin+this.xMax)/2,cy=(this.yMin+this.yMax)/2,xSpan=this.xMax-this.xMin;const ySpan=xSpan*(this.h/this.w);this.yMin=cy-ySpan/2;this.yMax=cy+ySpan/2;}
    sx(x){return(x-this.xMin)/(this.xMax-this.xMin)*this.w;} sy(y){return this.h-(y-this.yMin)/(this.yMax-this.yMin)*this.h;}
    bindPointer(){
      this.canvas.addEventListener('pointerdown',e=>{this.canvas.setPointerCapture(e.pointerId);this.drag={x:e.clientX,y:e.clientY,xMin:this.xMin,xMax:this.xMax,yMin:this.yMin,yMax:this.yMax};this.canvas.style.cursor='grabbing';});
      this.canvas.addEventListener('pointermove',e=>{if(!this.drag)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y,dxu=dx/this.w*(this.drag.xMax-this.drag.xMin),dyu=dy/this.h*(this.drag.yMax-this.drag.yMin);this.xMin=this.drag.xMin-dxu;this.xMax=this.drag.xMax-dxu;this.yMin=this.drag.yMin+dyu;this.yMax=this.drag.yMax+dyu;this.draw(this.functions,this.points,this.regions,this.parametrics);});
      const end=()=>{this.drag=null;this.canvas.style.cursor='grab';};this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);
    }
    curvePath(fn,pixels,color){const c=this.ctx;c.strokeStyle=color||'#2563eb';c.lineWidth=1.8;c.beginPath();let pen=false,lastY=0;for(let p=0;p<=pixels;p++){const x=this.xMin+(p/pixels)*(this.xMax-this.xMin);let y;try{y=fn(x);}catch{y=NaN;}const py=this.sy(y);if(!Number.isFinite(y)||py<-this.h*2||py>this.h*3){pen=false;continue;}if(!pen){c.moveTo(this.sx(x),py);pen=true;}else if(Math.abs(py-lastY)>this.h*1.5){c.moveTo(this.sx(x),py);}else c.lineTo(this.sx(x),py);lastY=py;}c.stroke();}
    draw(functions,points,regions,parametrics){
      const c=this.ctx,root=getComputedStyle(document.documentElement),bg=root.getPropertyValue('--surface-soft').trim()||'#f8f8f8',grid=root.getPropertyValue('--border-soft').trim()||'#eee',text=root.getPropertyValue('--text-faint').trim()||'#999';
      c.clearRect(0,0,this.w,this.h);c.fillStyle=bg;c.fillRect(0,0,this.w,this.h);
      // ggplot2-like panel: light gray plotting area, white grid, restrained axes.
      // Tick spacing adapts to the visible coordinate span so labels never become a solid wall.
      c.fillStyle='#EBEBEB';c.fillRect(0,0,this.w,this.h);
      c.font='10px Inter,Arial,sans-serif';c.textBaseline='alphabetic';
      const targetPixels=56;
      const xSpan=this.xMax-this.xMin,ySpan=this.yMax-this.yMin;
      // The coordinate lattice is intentionally shared by X and Y. A square graph
      // should not quietly turn into X=2,4,6 and Y=5,10,15 just because the canvas
      // is rectangular. Choose one numerical step that is readable on BOTH axes.
      const xPixelStep=xSpan/Math.max(2,this.w/targetPixels);
      const yPixelStep=ySpan/Math.max(2,this.h/targetPixels);
      const manualStep=(Number.isFinite(this.gridX)&&Number.isFinite(this.gridY))?Math.max(this.gridX,this.gridY):null;
      // Default mode is scale-driven: zooming changes the coordinate value per
      // grid cell, not the cell's physical size. Manual grid spacing is only used
      // when explicitly set by the grid controls.
      const sharedDesired=manualStep!=null?Math.max(manualStep,Math.min(xPixelStep,yPixelStep)):Math.max(xPixelStep,yPixelStep);
      const sharedStep=this.niceStep(Math.max(sharedDesired,Number.MIN_VALUE));
      const xStep=sharedStep,yStep=sharedStep;
      const xMinor=xStep/5,yMinor=yStep/5;

      // Minor gridlines are subtle, while major gridlines carry labels.
      c.lineWidth=1;c.strokeStyle='rgba(255,255,255,.72)';c.beginPath();
      for(let x=Math.ceil(this.xMin/xMinor)*xMinor,i=0;x<=this.xMax+xMinor/2&&i<10000;x+=xMinor,i++){
        const k=Math.round(x/xStep),major=Math.abs(x-k*xStep)<Math.abs(xStep)*1e-8;
        if(major)continue;const px=this.sx(x);c.moveTo(px,0);c.lineTo(px,this.h);
      }
      for(let y=Math.ceil(this.yMin/yMinor)*yMinor,i=0;y<=this.yMax+yMinor/2&&i<10000;y+=yMinor,i++){
        const k=Math.round(y/yStep),major=Math.abs(y-k*yStep)<Math.abs(yStep)*1e-8;
        if(major)continue;const py=this.sy(y);c.moveTo(0,py);c.lineTo(this.w,py);
      }
      c.stroke();

      c.strokeStyle='#FFFFFF';c.beginPath();
      for(let x=Math.ceil(this.xMin/xStep)*xStep,i=0;x<=this.xMax+xStep/2&&i<10000;x+=xStep,i++){const px=this.sx(x);c.moveTo(px,0);c.lineTo(px,this.h);}
      for(let y=Math.ceil(this.yMin/yStep)*yStep,i=0;y<=this.yMax+yStep/2&&i<10000;y+=yStep,i++){const py=this.sy(y);c.moveTo(0,py);c.lineTo(this.w,py);}
      c.stroke();

      c.fillStyle='#4D4D4D';
      const labelY=Math.min(this.h-4,Math.max(12,this.sy(0)-6));
      const labelX=Math.min(this.w-4,Math.max(4,this.sx(0)+6));
      for(let x=Math.ceil(this.xMin/xStep)*xStep,i=0;x<=this.xMax+xStep/2&&i<10000;x+=xStep,i++){
        const px=this.sx(x);if(px<-40||px>this.w+40)continue;
        if(Math.abs(x)<xStep*1e-8)continue;c.fillText(this.format(x),px+3,labelY);
      }
      for(let y=Math.ceil(this.yMin/yStep)*yStep,i=0;y<=this.yMax+yStep/2&&i<10000;y+=yStep,i++){
        const py=this.sy(y);if(py<-20||py>this.h+20)continue;
        if(Math.abs(y)<yStep*1e-8)continue;c.fillText(this.format(y),labelX,py-3);
      }

      c.strokeStyle='#7F7F7F';c.lineWidth=1.1;c.beginPath();
      if(this.xMin<=0&&this.xMax>=0){const x=this.sx(0);c.moveTo(x,0);c.lineTo(x,this.h);}
      if(this.yMin<=0&&this.yMax>=0){const y=this.sy(0);c.moveTo(0,y);c.lineTo(this.w,y);}
      c.stroke();
      const pixels=Math.min(600,Math.max(220,Math.floor(this.w)));
      // Definite-integral shaded regions. The fill is drawn before curves so the curve remains crisp.
      for(const region of regions||[]){
        const a=Math.max(this.xMin,Number(region.min)),b=Math.min(this.xMax,Number(region.max));if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)continue;
        const pts=[];for(let i=0;i<=Math.max(80,Math.floor((b-a)/(this.xMax-this.xMin)*pixels));i++){const x=a+(i/Math.max(80,Math.floor((b-a)/(this.xMax-this.xMin)*pixels)))*(b-a);let y;try{y=region.fn(x);}catch{y=NaN;}if(Number.isFinite(y))pts.push([x,y]);}
        if(pts.length<2)continue;c.beginPath();c.moveTo(this.sx(pts[0][0]),this.sy(0));for(const [x,y] of pts)c.lineTo(this.sx(x),this.sy(y));c.lineTo(this.sx(pts[pts.length-1][0]),this.sy(0));c.closePath();c.globalAlpha=.18;c.fillStyle=region.color||'#2563eb';c.fill();c.globalAlpha=1;
      }
      for(const item of functions||[]){const fn=typeof item==='function'?item:item.fn;this.curvePath(fn,pixels,typeof item==='function'?undefined:item.color);}
      for(const item of parametrics||[]){
        c.strokeStyle=item.color||'#2563eb';c.lineWidth=1.8;c.beginPath();let pen=false,lastX=0,lastY=0;let lo,hi;
        try{lo=Number(CASEngine.evaluate(item.min));hi=Number(CASEngine.evaluate(item.max));}catch{continue;}const polar=!!item.polar;
        for(let i=0;i<=pixels;i++){const t=lo+(i/pixels)*(hi-lo);let x,y;try{if(polar){const r=Number(item.rFn(t));x=r*Math.cos(t);y=r*Math.sin(t);}else{x=Number(item.xFn(t));y=Number(item.yFn(t));}}catch{x=NaN;y=NaN;}if(!Number.isFinite(x)||!Number.isFinite(y)){pen=false;continue;}const px=this.sx(x),py=this.sy(y);if(!pen){c.moveTo(px,py);pen=true;}else if(Math.hypot(px-lastX,py-lastY)>this.h*1.5){c.moveTo(px,py);}else c.lineTo(px,py);lastX=px;lastY=py;}c.stroke();
      }
      for(const pt of points||[]){const x=Number(pt[0]),y=Number(pt[1]);if(!Number.isFinite(x)||!Number.isFinite(y))continue;const px=this.sx(x),py=this.sy(y);if(px<-12||px>this.w+12||py<-12||py>this.h+12)continue;c.fillStyle=pt[2]||'#2563eb';c.beginPath();c.arc(px,py,3.7,0,Math.PI*2);c.fill();}
    }
    niceStep(v){if(!Number.isFinite(v)||v<=0)return 1;const p=10**Math.floor(Math.log10(v)),n=v/p;return(n<1.5?1:n<2.25?2:n<3.5?2.5:n<7?5:10)*p;}format(v){const n=Number(v);if(!Number.isFinite(n))return '';if(Math.abs(n)<1e-12)return '0';if(Math.abs(n)>=1e6||Math.abs(n)<1e-4)return n.toExponential(2).replace(/\.00e/,'e').replace(/0+e/,'e');return Number(n.toPrecision(6)).toString();}
  } return {Graph};
})();
