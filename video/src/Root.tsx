import {Composition, Series, useVideoConfig} from 'remotion';
import {Intro} from './Intro';
import {Database} from './Database';
import {Files} from './Files';
import {Initialize} from './Initialize';
import {Deploy} from './Deploy';
import {Verify} from './Verify';
import {Update} from './Update';

const InstallationGuide=()=>{const {fps}=useVideoConfig();return <Series>
  <Series.Sequence name="Introduction" durationInFrames={12*fps} premountFor={fps}><Intro/></Series.Sequence>
  <Series.Sequence name="Create spreadsheet" durationInFrames={14*fps} premountFor={fps}><Database/></Series.Sequence>
  <Series.Sequence name="Copy files" durationInFrames={18*fps} premountFor={fps}><Files/></Series.Sequence>
  <Series.Sequence name="Initialize" durationInFrames={16*fps} premountFor={fps}><Initialize/></Series.Sequence>
  <Series.Sequence name="Deploy" durationInFrames={18*fps} premountFor={fps}><Deploy/></Series.Sequence>
  <Series.Sequence name="Verify inventory" durationInFrames={16*fps} premountFor={fps}><Verify/></Series.Sequence>
  <Series.Sequence name="Updates" durationInFrames={16*fps} premountFor={fps}><Update/></Series.Sequence>
</Series>};
export const RemotionRoot=()=> <>
  <Composition id="InstallationGuide" component={InstallationGuide} durationInFrames={3300} fps={30} width={1920} height={1080}/>
  <Composition id="Introduction" component={Intro} durationInFrames={360} fps={30} width={1920} height={1080}/>
  <Composition id="Database" component={Database} durationInFrames={420} fps={30} width={1920} height={1080}/>
  <Composition id="Files" component={Files} durationInFrames={540} fps={30} width={1920} height={1080}/>
  <Composition id="Initialize" component={Initialize} durationInFrames={480} fps={30} width={1920} height={1080}/>
  <Composition id="Deploy" component={Deploy} durationInFrames={540} fps={30} width={1920} height={1080}/>
  <Composition id="Verify" component={Verify} durationInFrames={480} fps={30} width={1920} height={1080}/>
  <Composition id="Update" component={Update} durationInFrames={480} fps={30} width={1920} height={1080}/>
</>;
