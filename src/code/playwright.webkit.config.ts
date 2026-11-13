import {defineConfig,devices} from '@playwright/test';
import base from './playwright.config';
const {projects: _projects,use,...rest}=base;
// Separate optional run: never silently substitutes Chromium for Safari/WebKit.
export default defineConfig({...rest,use:{...use,launchOptions:{}},projects:[
 {name:'iphone-webkit',use:{...devices['iPhone 13'],browserName:'webkit'}},
]});
