import React from 'react';
import {registerRoot,Composition} from 'remotion';
import {TrailerV2} from './TrailerV2';
import {V2} from './timeline.mjs';
registerRoot(()=>React.createElement(Composition,{id:'BuscAG-V2',component:TrailerV2,width:V2.width,height:V2.height,fps:V2.fps,durationInFrames:V2.frames}));
