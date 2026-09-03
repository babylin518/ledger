/* 把 icons/logo-any.svg 和 icons/logo-maskable.svg 重新导出成全部尺寸的 PNG。
   用法：cd tools && npm install @resvg/resvg-js && node render-icons.js
   改完 SVG 源文件后重新跑一遍这个脚本，然后按 README「装到 iPhone」里说的
   删除主屏旧图标、重新添加到主屏幕才能看到新图标（系统不会自动换）。 */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ICONS_DIR = path.join(__dirname, '..', 'icons');

function render(svgPath, outName, size) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'transparent', // SVG already paints an opaque bg rect covering the canvas
  });
  const png = resvg.render().asPng();
  const outPath = path.join(ICONS_DIR, outName);
  fs.writeFileSync(outPath, png);
  console.log('wrote', outName, size + 'x' + size, png.length + ' bytes');
}

const any = path.join(ICONS_DIR, 'logo-any.svg');
const maskable = path.join(ICONS_DIR, 'logo-maskable.svg');

// manifest.json 用（Android / 桌面 PWA）
render(any, 'icon-192.png', 192);
render(any, 'icon-512.png', 512);
render(maskable, 'icon-maskable-192.png', 192);
render(maskable, 'icon-maskable-512.png', 512);

// iOS 主屏专用（必须不透明；SVG 背景本来就是实心的，满足这一点）
render(any, 'apple-touch-icon.png', 180);       // 现代机型统一用这个
render(any, 'apple-touch-icon-120.png', 120);   // 旧款 iPhone @2x
render(any, 'apple-touch-icon-152.png', 152);   // iPad @2x
render(any, 'apple-touch-icon-167.png', 167);   // iPad Pro @2x

// 浏览器标签页 favicon
render(any, 'favicon-32.png', 32);
render(any, 'favicon-16.png', 16);
