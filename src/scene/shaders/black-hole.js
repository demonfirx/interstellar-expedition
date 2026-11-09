export const blackHoleVertex = `
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=vec4(position.xy,.999,1.);}
`;

/** Animates the actual supplied image, separating concentric light layers and disk. */
export const blackHoleFragment = `
  precision highp float;
  uniform sampler2D uImage;
  uniform float uReady;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  varying vec2 vUv;
  const float IMAGE_ASPECT=1.77777778;
  mat2 turn(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
  float band(float r,float inner,float outer){return smoothstep(inner,inner+.018,r)*(1.-smoothstep(outer-.018,outer,r));}
  vec3 flow(vec2 p,vec2 center,float speed,float pulse){
    vec2 shifted=turn(uTime*speed)*p;
    shifted*=1.+sin(uTime*.22+atan(p.y,p.x)*5.+pulse)*.0025;
    return texture2D(uImage,clamp(center+shifted/vec2(IMAGE_ASPECT,1.),.001,.999)).rgb;
  }
  void main(){
    if(uReady<.5){gl_FragColor=vec4(0.);return;}
    float aspect=uResolution.x/uResolution.y;
    vec2 fit=vec2(min(1.,aspect/IMAGE_ASPECT),min(1.,IMAGE_ASPECT/aspect));
    vec2 uv=(vUv-.5)*fit+vec2(mix(.5,.615,1.-smoothstep(.75,1.4,aspect)),.5);
    uv+=uPointer*vec2(.0035,.002);
    vec2 center=vec2(.626,.442);
    vec2 p=(uv-center)*vec2(IMAGE_ASPECT,1.);
    float r=length(p),a=atan(p.y,p.x);
    float diskLine=.672-uv.x*.285;
    float disk=1.-smoothstep(.025,.108,abs(uv.y-diskLine));
    float clearCenter=smoothstep(.278,.309,r);
    float behindDisk=1.-disk*.94;
    vec3 base=texture2D(uImage,clamp(uv,.001,.999)).rgb;
    // Four independently advected pieces of the original accretion-ring texture.
    float b1=band(r,.295,.355)*behindDisk;
    float b2=band(r,.355,.425)*behindDisk;
    float b3=band(r,.425,.505)*behindDisk;
    float b4=band(r,.505,.65)*behindDisk;
    vec3 col=base;
    col=mix(col,flow(p,center,.024,0.),b1*.82);
    col=mix(col,flow(p,center,.015,1.4),b2*.84);
    col=mix(col,flow(p,center,-.009,2.8),b3*.77);
    col=mix(col,flow(p,center,.006,4.2),b4*.64);
    // The equatorial disk flows laterally while its original silhouette stays fixed.
    vec2 diskUv=uv+vec2(sin(uTime*.16)*.026,sin(uv.x*37.-uTime*.7)*.0025);
    vec3 diskFlow=texture2D(uImage,clamp(diskUv,.001,.999)).rgb;
    col=mix(col,diskFlow,disk*.48*clearCenter);
    float ribbons=(b1+b2+b3+b4)*clearCenter;
    float shimmer=sin(a*19.+r*260.-uTime*.9)*.045+sin(a*8.-r*130.+uTime*.55)*.026;
    col*=1.+shimmer*ribbons;
    // Thin travelling arcs thread the light bands; the dark event horizon stays intact.
    float threads=0.;
    for(int i=0;i<5;i++){
      float fi=float(i);
      float rr=.311+fi*.028+sin(a*6.+uTime*.26+fi)*.003;
      float line=exp(-abs(r-rr)*850.);
      float arc=pow(.5+.5*sin(a*3.-uTime*(.32+fi*.07)+fi*1.7),7.);
      threads+=line*arc*(.012-fi*.0014);
    }
    col+=vec3(.29,.38,.87)*threads*behindDisk;
    float vignette=1.-smoothstep(.35,.9,length((vUv-.5)*vec2(.9,1.)))*.19;
    col*=vignette;
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }
`;
