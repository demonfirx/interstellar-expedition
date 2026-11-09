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
  uniform vec2 uCameraOffset;
  uniform float uCameraScale;
  uniform float uApproachZoom;
  uniform float uProximity;
  uniform float uGlowGain;
  varying vec2 vUv;
  const float IMAGE_ASPECT=1.77777778;
  mat2 turn(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
  float band(float r,float inner,float outer){return smoothstep(inner,inner+.018,r)*(1.-smoothstep(outer-.018,outer,r));}
  vec3 flow(vec2 p,vec2 center,float speed,float pulse){
    // Two short, overlapping advection windows make flow continuous without
    // eventually carrying a fragment of the equatorial disk across the halo.
    float span=.15;
    float first=fract(uTime*speed/span+pulse*.13);
    float second=fract(first+.5);
    float blend=abs(1.-2.*first);
    float ripple=1.+sin(uTime*.32+atan(p.y,p.x)*5.+pulse)*.003;
    vec2 uvA=center+(turn((first-.5)*span)*p*ripple)/vec2(IMAGE_ASPECT,1.);
    vec2 uvB=center+(turn((second-.5)*span)*p*ripple)/vec2(IMAGE_ASPECT,1.);
    return mix(texture2D(uImage,clamp(uvA,.001,.999)).rgb,texture2D(uImage,clamp(uvB,.001,.999)).rgb,blend);
  }
  void main(){
    if(uReady<.5){gl_FragColor=vec4(0.);return;}
    float aspect=uResolution.x/uResolution.y;
    vec2 fit=vec2(min(1.,aspect/IMAGE_ASPECT),min(1.,IMAGE_ASPECT/aspect));
    // Overscan keeps texture borders outside the view during slow camera travel.
    vec2 uv=(vUv-.5)*fit*.975*uCameraScale+vec2(mix(.5,.615,1.-smoothstep(.75,1.4,aspect)),.5);
    uv+=uCameraOffset*fit;
    vec2 center=vec2(.626,.442);
    uv=center+(uv-center)/uApproachZoom;
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
    col=mix(col,flow(p,center,.055,0.),b1*.90);
    col=mix(col,flow(p,center,.034,1.4),b2*.92);
    col=mix(col,flow(p,center,-.022,2.8),b3*.86);
    col=mix(col,flow(p,center,.014,4.2),b4*.76);
    // The equatorial disk flows laterally while its original silhouette stays fixed.
    vec2 diskUv=uv+vec2(sin(uTime*.24)*.043,sin(uv.x*37.-uTime*1.05)*.0032);
    vec3 diskFlow=texture2D(uImage,clamp(diskUv,.001,.999)).rgb;
    col=mix(col,diskFlow,disk*.60*clearCenter);
    float ribbons=(b1+b2+b3+b4)*clearCenter;
    float shimmer=sin(a*19.+r*260.-uTime*1.1)*.065+sin(a*8.-r*130.+uTime*.7)*.038;
    col*=1.+shimmer*ribbons;
    // Thin travelling arcs thread the light bands; the dark event horizon stays intact.
    float threads=0.;
    for(int i=0;i<5;i++){
      float fi=float(i);
      float rr=.311+fi*.036+sin(a*6.+uTime*.35+fi)*.0035;
      float line=exp(-abs(r-rr)*680.);
      float arc=pow(.5+.5*sin(a*4.-uTime*(.72+fi*.11)+fi*1.7),5.);
      threads+=line*arc*(.053-fi*.005);
    }
    col+=vec3(.29,.38,.87)*threads*behindDisk;
    // Local low-gain bloom lifts the halo edges while keeping bright cores intact.
    vec3 halo=(texture2D(uImage,clamp(uv+vec2(.005,0.),.001,.999)).rgb+texture2D(uImage,clamp(uv-vec2(.005,0.),.001,.999)).rgb+texture2D(uImage,clamp(uv+vec2(0.,.008),.001,.999)).rgb+texture2D(uImage,clamp(uv-vec2(0.,.008),.001,.999)).rgb)*.25;
    float luminance=dot(col,vec3(.2126,.7152,.0722));
    float headroom=1.-smoothstep(.2,.8,luminance);
    col+=max(halo-.12,0.)*.085*uGlowGain*headroom*clearCenter;
    col+=col*vec3(.05,.035,.08)*uProximity*headroom*clearCenter;
    float vignette=1.-smoothstep(.35,.9,length((vUv-.5)*vec2(.9,1.)))*.19;
    col*=vignette;
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
  }
`;
