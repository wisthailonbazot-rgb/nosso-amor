import { useEffect, useRef } from 'react'
import { Painter } from './pixel'
import { isoBox, project, tileDiamond } from './iso'

const O={x:520,y:35}
const faces=(top,left,right)=>({top,left,right})

export default function PropertyCanvas({rooms}) {
  const ref=useRef(null)
  useEffect(()=>{
    const canvas=ref.current,p=new Painter(canvas); p.resize(1040,520)
    let frame=0,alive=true
    const draw=(t)=>{
      if(!alive)return
      p.clear('#bfe0ef')
      const cloud=(base,y)=>{const x=((base+t/55)%1180)-90;p.rect(x,y,76,10,'#f7fbf4');p.rect(x+15,y-8,38,18,'#f7fbf4')}
      cloud(40,55);cloud(520,100);cloud(850,38)
      const pulse=(Math.sin(t/600)+1)*2;p.rect(850-pulse,30-pulse,40+pulse*2,40+pulse*2,'#f4c85a')
      for(let r=-2;r<15;r++)for(let c=-3;c<19;c++)p.fillPoly(tileDiamond(c,r,O),(c+r)%2?'#78ad65':'#72a55f')
      for(let r=14;r<17;r++)for(let c=-3;c<19;c++)p.fillPoly(tileDiamond(c,r,O),(c+r)%2?'#d1c9ba':'#c2baac')
      for(let r=17;r<22;r++)for(let c=-4;c<20;c++)p.fillPoly(tileDiamond(c,r,O),'#575b63')
      for(let c=-3;c<20;c+=3){const[x,y]=project(c,19.3,.02,O);p.rect(x-8,y-1,16,2,'#f1d06a')}
      const unlocked=rooms.filter(r=>!r.outdoor&&r.unlocked).length
      const w=unlocked<=1?7:unlocked===2?10:unlocked===3?12:14
      const d=unlocked<=1?6:unlocked===2?7:8
      for(let r=10;r<15;r++)for(let c=5;c<11;c++)p.fillPoly(tileDiamond(c,r,O),'#c6b9a7')
      isoBox(p,faces('#f4ddd9','#d9a5ad','#be8796'),{col:3,row:2,w,d,z:0,h:3},O,'#33203a')
      const A=project(2.5,1.5,3,O),B=project(3+w/2,1.5,5.4,O),C=project(3+w+.5,1.5,3,O)
      const D=project(2.5,2+d+.5,3,O),E=project(3+w/2,2+d+.5,5.4,O),F=project(3+w+.5,2+d+.5,3,O)
      p.fillPoly([A,B,E,D],'#c96f79');p.fillPoly([B,C,F,E],'#a95466');p.strokePoly([A,B,C,F,E,D],'#33203a')
      isoBox(p,faces('#8d6248','#76503b','#5f402f'),{col:3+w*.45,row:2+d-.05,w:1.2,d:.08,z:0,h:2.1},O,'#33203a')
      for(const col of [4,3+w-2.2])isoBox(p,faces('#bde3ee','#7db7ca','#65a0b5'),{col,row:2+d-.06,w:1.4,d:.06,z:.9,h:1.05},O,'#33203a')
      isoBox(p,faces('#8b684a','#725238','#60442f'),{col:1,row:8,w:.5,d:.5,z:0,h:2.2},O,'#33203a')
      const sway=Math.sin(t/500)*2,[tx,ty]=project(1.25,8.25,2.2,O);p.rect(tx-17+sway,ty-18,34,24,'#5d9956');p.rect(tx-10-sway,ty-25,25,20,'#6cac61')
      for(const[c,r,color]of[[1,11,'#f19ab0'],[2,12,'#f5d46b'],[15,10,'#a88bd1'],[14,12,'#f19ab0']]){const[x,y]=project(c,r,.05,O);p.rect(x-2,y-4,5,5,color)}
      const bx=220+((t/18)%700);p.rect(bx,82,4,2,'#33203a');p.rect(bx+7,80,4,2,'#33203a')
      frame=requestAnimationFrame(draw)
    }
    frame=requestAnimationFrame(draw)
    return()=>{alive=false;cancelAnimationFrame(frame)}
  },[rooms])
  return <div className="property-scroll"><canvas ref={ref} className="property-canvas"/></div>
}
