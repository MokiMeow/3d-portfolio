export type Theme = 'Midnight' | 'Paper' | 'Sunset' | 'Mono';
export type SlideTransition = 'Dissolve' | 'Push' | 'Magic Move';
export interface Slide { title: string; subtitle: string; notes: string }
export const themes: Theme[] = ['Midnight', 'Paper', 'Sunset', 'Mono'];
export const transitions: SlideTransition[] = ['Dissolve', 'Push', 'Magic Move'];
export const deck: readonly Slide[] = [
  {title:'Make room for calm.',subtitle:'A few thoughtful decisions. A little less noise.',notes:'Welcome. This deck is about making an interface feel considered. Invite everyone to notice how much space the title has.'},
  {title:'Less, but with intention.',subtitle:'A quiet interface still has something to say.',notes:'Read the original quote slowly. Calm does not mean empty; it means every element earns its place.'},
  {title:'From noise to clarity.',subtitle:'Three ways to spend the same attention.',notes:'Compare noise, clarity, and calm. Each column describes an approach, not a score. A clear next action makes a surprising difference.'},
  {title:'Give attention a place to land.',subtitle:'Illustrative attention scores — entirely invented.',notes:'These numbers are invented for this demo, not research findings. The chart illustrates the story of reducing friction while preserving useful choices.'},
  {title:'A small space. A generous target.',subtitle:'44 pixels can be a quiet act of kindness.',notes:'A 44-pixel touch target is the baseline used by this demo. Show how making controls easier to reach reduces effort.'},
  {title:'A room to breathe.',subtitle:'Depth, light, and space can do the talking.',notes:'Pause on the illustration. Let people notice the visual hierarchy: one clear card, supporting details, and enough space around both.'},
  {title:'Calm arrives one decision at a time.',subtitle:'Notice. Remove. Refine. Repeat.',notes:'Walk through the four moments. A calm interface is rarely one dramatic redesign. It is a sequence of careful, reversible improvements.'},
  {title:'Thank you. Questions?',subtitle:'Let’s make the next thing feel a little lighter.',notes:'Thank the audience. Invite questions. The virtual audience is fictional, though its appreciation is very convincing.'},
];
export const palettes: Record<Theme, {bg:string;ink:string;muted:string;accent:string;card:string;second:string}> = {
  Midnight:{bg:'#192638',ink:'#f3eee7',muted:'#a7b7c9',accent:'#a5d7cb',card:'#26394d',second:'#dba77e'},
  Paper:{bg:'#f4efe6',ink:'#353f3d',muted:'#70807a',accent:'#477e72',card:'#e7e2d6',second:'#b87651'},
  Sunset:{bg:'#4d2c42',ink:'#fff0d7',muted:'#d9b4b7',accent:'#f1b591',card:'#694051',second:'#dba8cc'},
  Mono:{bg:'#18191b',ink:'#f1f1ed',muted:'#a4a5a0',accent:'#eeeeea',card:'#313235',second:'#858883'},
};
