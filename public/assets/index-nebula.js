// 紫のネビュラ背景（生WebGL）
//
// FBMノイズをドメインワープさせた霧を、板ポリ1枚のフラグメントシェーダーで描く。
// ポインタでゆっくり流れ、全体がわずかに明滅し、周辺が落ちる。
//
// ライブラリを使っていないのは、この表現に必要なのが「画面いっぱいの四角形に
// フラグメントシェーダーを1枚」だけだから。three.js のシーングラフ、カメラ、
// ジオメトリはこの用途では出番がなく、357KB（gzip 127KB）を読ませる理由がない。
//
// 進行的強化として作る。WebGLが使えない場合や初期化に失敗した場合は、
// 何もせずCSSの背景をそのまま見せる。

import { isReduced } from "./index-motion.js?v=20260826-1";

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uPointer;   // -1.0 .. 1.0
uniform float uIntensity; // 0.0 で完全に消える

// 値ノイズ。ハッシュは定番の疑似乱数
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 5オクターブ。これ以上重ねても、この解像度では見た目が変わらない割に重くなる
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  // 縦横比を保つ。引き伸ばすと雲が横に潰れる
  vec2 p = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);

  float t = uTime * 0.045;

  // ポインタはゆっくり効かせる。速いと酔う
  p += uPointer * 0.16;

  // ドメインワープ。ノイズでノイズを歪めると、渦を巻いた霧になる
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.7));
  vec2 r = vec2(fbm(p + 3.4 * q + vec2(1.7, 9.2) + t * 0.4),
                fbm(p + 3.4 * q + vec2(8.3, 2.8) - t * 0.3));
  float f = fbm(p + 3.0 * r);

  // 京都サンガの紫を基調に、明るい側へ寄せる
  vec3 deep   = vec3(0.106, 0.031, 0.122); // #1b081f
  vec3 base   = vec3(0.404, 0.043, 0.365); // #670b5d
  vec3 lit    = vec3(0.658, 0.141, 0.549); // #a8248c
  vec3 accent = vec3(1.000, 0.561, 0.816); // #ff8fd0

  vec3 color = mix(deep, base, clamp(f * f * 2.2, 0.0, 1.0));
  color = mix(color, lit, clamp(dot(q, q) * 0.85, 0.0, 1.0));
  color = mix(color, accent, clamp(r.x * r.x * 0.5, 0.0, 1.0));

  // 明滅。呼吸くらいの速さにする
  color *= 0.86 + 0.14 * sin(uTime * 0.35);

  // ビネット。周辺を落として中央の文字を読みやすくする
  float d = length(uv - vec2(0.5, 0.42));
  color *= smoothstep(1.05, 0.15, d);

  gl_FragColor = vec4(color * uIntensity, 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`シェーダーをコンパイルできません: ${log}`);
  }
  return shader;
}

export function startNebula(canvas) {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl) throw new Error("WebGLを使えません");

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`シェーダーをリンクできません: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  // 画面を覆う三角形1枚。四角形より頂点が1つ少なく、継ぎ目も出ない
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPosition = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uPointer = gl.getUniformLocation(program, "uPointer");
  const uIntensity = gl.getUniformLocation(program, "uIntensity");

  // 動きを止めるかどうかは motion.js が決める。OSの設定と、ページ内の
  // 切り替えの両方を見た結果がここへ来る
  const reduceMotion = { get matches() { return isReduced(); } };
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let frame = 0;
  let running = false;
  let disposed = false;

  function resize() {
    // 端末の画素密度は2倍で頭打ちにする。3倍の端末で面積が2.25倍になり、
    // フラグメントシェーダーは面積にそのまま比例して重くなる
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  function draw(timeMs) {
    resize();
    // 追従を緩めて、指やカーソルの動きをそのまま反映しない
    pointer.x += (pointer.targetX - pointer.x) * 0.03;
    pointer.y += (pointer.targetY - pointer.y) * 0.03;
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, timeMs / 1000);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.uniform1f(uIntensity, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(timeMs) {
    draw(timeMs);
    frame = running ? requestAnimationFrame(tick) : 0;
  }

  function start() {
    if (disposed || running || reduceMotion.matches) return;
    running = true;
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function onPointerMove(event) {
    pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.targetY = 1 - (event.clientY / window.innerHeight) * 2;
  }

  // 見えていないとき、別タブのときは描かない。電池を使う理由がない
  const observer = new IntersectionObserver(([entry]) => {
    entry && entry.isIntersecting ? start() : stop();
  });
  observer.observe(canvas);

  function onVisibilityChange() {
    document.hidden ? stop() : start();
  }

  function onMotionPreferenceChange() {
    stop();
    // 動きを止めても背景は見せる。1枚だけ描いて静止画にする
    draw(0);
    if (!reduceMotion.matches) start();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("motionchange", onMotionPreferenceChange);

  // 動きを減らす設定なら、静止画として1枚だけ描く
  if (reduceMotion.matches) draw(0);
  else start();

  return {
    dispose() {
      disposed = true;
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("motionchange", onMotionPreferenceChange);
    },
  };
}
