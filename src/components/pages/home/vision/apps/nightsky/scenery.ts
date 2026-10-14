import * as THREE from 'three';
/** All scenery is procedural and illustrative. Coordinates remain in the observer's horizon frame. */
export function atmosphere(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  return new THREE.Mesh(new THREE.SphereGeometry(125,32,20),new THREE.ShaderMaterial({ side:THREE.BackSide, depthWrite:false, uniforms:{sun:{value:new THREE.Vector3(0,-1,0)}},
    vertexShader: 'varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 direction;uniform vec3 sun;void main(){vec3 p=normalize(direction);float dusk=smoothstep(-.30,.015,sun.y);float day=smoothstep(-.015,.25,sun.y);float low=exp(-max(p.y,0.)*5.);vec3 night=mix(vec3(.008,.013,.032),vec3(.037,.055,.105),low);vec3 twilight=mix(vec3(.026,.065,.17),vec3(.22,.25,.37),low);vec3 daylight=mix(vec3(.075,.23,.43),vec3(.38,.52,.63),low);vec3 color=mix(mix(night,twilight,dusk),daylight,day);float solar=pow(max(0.,dot(p,sun)),18.);color+=vec3(.42,.21,.095)*solar*low*dusk*(1.-day);float city=exp(-pow(atan(p.x,-p.z)+1.1,2.)*7.)*exp(-abs(p.y)*15.);color+=vec3(.095,.045,.018)*city*(1.-day);gl_FragColor=vec4(color,1.);}`
  }));
}
export function horizon(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(88,96,32),new THREE.ShaderMaterial({ side:THREE.BackSide,transparent:true,depthWrite:false,uniforms:{day:{value:0}},
    vertexShader:'varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;uniform float day;float tree(float a,float center,float width,float height,float y,float base){float w=max(0.,1.-(y-base)/height)*width;float branch=step(abs(a-center),w)*(step(base+.008,y))*step(y,base+height);float trunk=step(abs(a-center),width*.08)*step(base,y)*step(y,base+height*.35);return max(branch,trunk);}void main(){vec3 p=normalize(direction);float a=atan(p.x,-p.z);float hills=.012+.022*sin(a*3.+.8)+.009*sin(a*9.-1.)+.004*sin(a*21.);float farHills=hills+.02*sin(a*2.-.4)+.012;float trees=0.;trees=max(trees,tree(a,-1.72,.026,.09,p.y,hills));trees=max(trees,tree(a,-1.63,.034,.12,p.y,hills));trees=max(trees,tree(a,.7,.025,.085,p.y,hills));trees=max(trees,tree(a,1.06,.032,.115,p.y,hills));trees=max(trees,tree(a,-.3,.02,.07,p.y,hills));float land=max(1.-smoothstep(hills-.001,hills+.001,p.y),trees);float far=1.-smoothstep(farHills-.001,farHills+.001,p.y);if(max(land,far)<.01)discard;vec3 c=mix(vec3(.012,.02,.028),vec3(.032,.067,.072),day);vec3 f=mix(vec3(.037,.049,.066),vec3(.14,.23,.25),day);float city=exp(-pow(a+1.1,2.)*16.);float lights=pow(max(0.,sin(a*830.)*sin(a*521.)),12.)*step(p.y,hills)*step(hills-.01,p.y)*city*(1.-day);c+=vec3(.9,.5,.16)*lights*.7;gl_FragColor=vec4(mix(f,c,land),max(far*.78,land));}`
  }));
  mesh.renderOrder=4;return mesh;
}
export function lunarSphere(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  return new THREE.Mesh(new THREE.SphereGeometry(.85,40,24), new THREE.ShaderMaterial({uniforms:{sun:{value:new THREE.Vector3(1,0,0)}},
    vertexShader:'varying vec3 n;void main(){n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 n;uniform vec3 sun;void main(){vec3 p=normalize(n);float light=max(0.,dot(p,sun));float maria=.9+.07*sin(p.x*19.+sin(p.z*13.))+.08*sin(p.z*25.+sin(p.y*21.));float craters=.04*sin(p.x*96.)*sin(p.y*72.)*sin(p.z*87.);vec3 rock=vec3(.78,.79,.76)*(maria+craters);gl_FragColor=vec4(rock*(.055+light*.94),1.);}`
  }));
}
/** Six hand-drawn constellation figures, sampled into celestial coordinates once. */
export const figures: {ra:number;dec:number;scale:[number,number];paths:number[][][]}[] = [
  {ra:5.6,dec:3,scale:[.06,1.2],paths:[[[0,24],[-3,20],[-3,15],[-13,8],[-19,16],[-20,29],[-17,32],[-15,26],[-14,16],[-7,10],[-6,-1],[-13,-19],[-11,-24],[-5,-21],[0,-8],[5,-22],[12,-24],[14,-21],[8,-2],[7,11],[19,14],[22,22],[26,21],[26,10],[17,4],[4,15],[3,20],[0,24]]]},
  {ra:12.2,dec:54,scale:[.12,.75],paths:[[[30,5],[19,7],[13,15],[1,18],[-14,12],[-20,15],[-28,13],[-32,8],[-26,3],[-24,-8],[-21,-16],[-16,-16],[-16,-8],[-10,-3],[1,-5],[6,-16],[12,-16],[11,-4],[19,2],[30,5]]]},
  {ra:20.3,dec:41,scale:[.07,.9],paths:[[[0,21],[-3,17],[-2,4],[-17,9],[-29,17],[-21,3],[-6,-1],[-5,-9],[-12,-20],[0,-15],[11,-20],[5,-8],[5,-1],[20,4],[28,17],[17,10],[2,5],[3,17],[0,21]]]},
  {ra:16.9,dec:-31,scale:[.06,.7],paths:[[[1,11],[-8,17],[-10,27],[-4,24],[-3,18],[3,12],[8,19],[9,26],[13,22],[13,17],[7,8],[10,2],[8,-6],[13,-15],[22,-19],[27,-13],[24,-7],[21,-5],[25,-4],[31,-9],[29,-20],[22,-26],[11,-22],[2,-13],[-2,-6],[-3,4],[1,11]]]},
  {ra:10.6,dec:22,scale:[.1,.7],paths:[[[20,4],[13,11],[6,15],[-7,15],[-11,22],[-17,20],[-22,11],[-20,2],[-12,0],[-11,-15],[-5,-15],[-6,-2],[5,-1],[9,-16],[15,-16],[13,-4],[20,4],[26,8],[28,17]]]},
  {ra:4.7,dec:19,scale:[.075,.8],paths:[[[0,5],[-8,13],[-20,24],[-23,32],[-15,24],[-4,18],[1,12],[6,18],[15,27],[14,17],[7,7],[9,-1],[5,-9],[-5,-9],[-11,-2],[-9,6],[0,5]],[[1,-8],[-2,-21],[-8,-26],[-11,-25],[-7,-16],[-9,-5]]]},
];
