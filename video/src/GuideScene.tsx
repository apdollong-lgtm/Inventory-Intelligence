import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

type Props = {step:string; title:string; subtitle:string; lines:string[]; panel:string; badge:string};
export const GuideScene: React.FC<Props> = ({step,title,subtitle,lines,panel,badge}) => {
  const frame=useCurrentFrame(); const {fps,durationInFrames}=useVideoConfig();
  return <AbsoluteFill style={{background:'#081630',color:'#f3f7ff',fontFamily:'Tahoma, sans-serif',padding:90,overflow:'hidden'}}>
    <div style={{position:'absolute',width:850,height:850,border:'1px solid #18365d',borderRadius:'50%',right:-220,top:-300,scale:interpolate(frame,[0,durationInFrames],[0.9,1.1])}}/>
    <div style={{position:'absolute',width:600,height:600,background:'radial-gradient(circle,#095aa65c,transparent 70%)',right:0,bottom:-100,translate:interpolate(frame,[0,durationInFrames],['0px 0px','-120px -60px'])}}/>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:23,letterSpacing:3,color:'#81a6cf'}}><span>FACTORYSTUDIO / INVENTORY INTELLIGENCE</span><span>INSTALLATION / {step}</span></div>
    <div style={{display:'flex',gap:75,marginTop:85,opacity:interpolate(frame,[0,0.6*fps],[0,1],{extrapolateRight:'clamp'}),translate:`0px ${interpolate(frame,[0,fps],[35,0],{extrapolateRight:'clamp'})}px`}}>
      <div style={{width:850}}><div style={{color:'#60e7b2',fontSize:28,fontWeight:700,marginBottom:25}}>{badge}</div><h1 style={{fontSize:66,lineHeight:1.45,margin:'0 0 22px',letterSpacing:-2}}>{title}</h1><p style={{fontSize:30,color:'#a9bed8',lineHeight:1.6,marginBottom:40}}>{subtitle}</p>
        {lines.map((line,i)=><div key={line} style={{display:'flex',gap:20,alignItems:'flex-start',marginTop:22,fontSize:29,lineHeight:1.7,opacity:interpolate(frame,[(0.7+i*0.4)*fps,(1.15+i*0.4)*fps],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}><span style={{color:'#60e7b2'}}>0{i+1}</span><span>{line}</span></div>)}
      </div>
      <div style={{flex:1,marginTop:45,scale:0.94+0.06*spring({frame,fps,config:{damping:180}})}}><div style={{background:'#f5f8fd',color:'#18304f',borderRadius:24,boxShadow:'0 30px 100px #0005',overflow:'hidden'}}><div style={{background:'#e3ebf7',padding:'22px 30px',display:'flex',gap:10}}>{['#f87979','#ffd266','#60d49a'].map(c=><span key={c} style={{width:15,height:15,borderRadius:20,background:c}}/>)}<span style={{fontSize:18,marginLeft:20}}>Google Workspace · setup walkthrough</span></div><div style={{padding:45,minHeight:390}}><div style={{fontSize:22,color:'#1669dc',fontWeight:700,marginBottom:35}}>STEP {step}</div><div style={{whiteSpace:'pre-line',fontSize:33,lineHeight:2,fontWeight:600}}>{panel}</div><div style={{height:8,background:'#dfebf9',borderRadius:10,marginTop:30}}><div style={{height:'100%',background:'#1f6feb',width:`${interpolate(frame,[0,8*fps],[0,100],{extrapolateRight:'clamp'})}%`,borderRadius:10}}/></div></div></div><p style={{fontSize:21,color:'#85a0c1',textAlign:'center',marginTop:25}}>ภาพประกอบขั้นตอน • เมนูจริงอาจต่างตามภาษาบัญชี Google</p></div>
    </div>
    <div style={{position:'absolute',bottom:55,left:90,right:90,display:'flex',justifyContent:'space-between',fontSize:22,color:'#81a6cf'}}><span>คู่มือติดตั้งภาษาไทย · 16:9</span><span>อ่านรายละเอียดเพิ่มเติมใน INSTALL-TH.html</span></div>
  </AbsoluteFill>;
};
