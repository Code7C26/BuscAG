import React from 'react';
import {registerRoot,Composition} from 'remotion';
import {Trailer} from './Trailer';
import {VIDEO} from './timeline.mjs';
registerRoot(()=>React.createElement(Composition,{id:'BuscAG',component:Trailer,width:VIDEO.width,height:VIDEO.height,fps:VIDEO.fps,durationInFrames:VIDEO.frames,defaultProps:{voiceover:false}}));
