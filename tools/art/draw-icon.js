// Drawn in a browser canvas by tools/make-icons.ts: the app icon and splash, all made by code.
window.drawArt = (kind, size) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  const s = size / 1024;
  const sky = () => {
    const g = c.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#6fbcff');
    g.addColorStop(0.6, '#cde9ff');
    g.addColorStop(1, '#ffe6cc');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  };
  const cloud = (x, y, r) => {
    c.fillStyle = 'rgba(255,255,255,.9)';
    for (const [dx, dy, k] of [
      [0, 0, 1],
      [r * 0.9, r * 0.15, 0.8],
      [-r * 0.9, r * 0.2, 0.75],
      [r * 0.3, -r * 0.45, 0.8],
    ]) {
      c.beginPath();
      c.arc(x + dx, y + dy, r * k, 0, Math.PI * 2);
      c.fill();
    }
  };
  const crystal = (x, y, h, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y - h);
    c.lineTo(x + h * 0.45, y);
    c.lineTo(x, y + h);
    c.lineTo(x - h * 0.45, y);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.moveTo(x, y - h);
    c.lineTo(x - h * 0.45, y);
    c.lineTo(x, y);
    c.closePath();
    c.fill();
  };
  const track = () => {
    // A checkered strip of course in perspective, with its blue side.
    c.save();
    c.translate(512 * s, 760 * s);
    c.fillStyle = '#6fb3c8';
    c.beginPath();
    c.moveTo(-430 * s, 40 * s);
    c.lineTo(430 * s, 40 * s);
    c.lineTo(430 * s, 110 * s);
    c.lineTo(-430 * s, 110 * s);
    c.fill();
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#f0d9b2' : '#fbeed6';
      const x0 = -430 + i * 107.5;
      c.beginPath();
      c.moveTo((x0 + 40) * s, -60 * s);
      c.lineTo((x0 + 147.5) * s, -60 * s);
      c.lineTo((x0 + 107.5) * s, 40 * s);
      c.lineTo(x0 * s, 40 * s);
      c.fill();
    }
    c.restore();
  };
  const ball = (x, y, r) => {
    c.save();
    c.fillStyle = 'rgba(30,50,100,.22)';
    c.beginPath();
    c.ellipse(x + r * 0.1, y + r * 0.98, r * 0.85, r * 0.2, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#ff5d86';
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.fillStyle = '#fff4f7';
    c.save();
    c.translate(x, y);
    c.rotate(-0.35);
    c.fillRect(-r, -r * 0.16, r * 2, r * 0.32);
    c.fillStyle = '#ffd25e';
    for (const [dx, dy] of [
      [-0.5, -0.55],
      [0.35, -0.6],
      [-0.1, 0.55],
      [0.6, 0.45],
    ]) {
      c.beginPath();
      c.arc(dx * r, dy * r, r * 0.11, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    const shade = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    shade.addColorStop(0, 'rgba(255,255,255,.75)');
    shade.addColorStop(0.25, 'rgba(255,255,255,.1)');
    shade.addColorStop(1, 'rgba(60,0,40,.35)');
    c.fillStyle = shade;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  };
  const scene = () => {
    cloud(230 * s, 250 * s, 70 * s);
    cloud(820 * s, 380 * s, 55 * s);
    track();
    crystal(210 * s, 560 * s, 70 * s, '#4fd8ff');
    crystal(830 * s, 600 * s, 60 * s, '#ffd04f');
    crystal(720 * s, 210 * s, 50 * s, '#ff6fae');
    ball(512 * s, 520 * s, 230 * s);
  };
  if (kind === 'icon') {
    sky();
    scene();
  } else if (kind === 'foreground') {
    // Android adaptive icon: the art must fit the middle 66 % (the rest may be cropped).
    c.translate(size * 0.17, size * 0.17);
    c.scale(0.66, 0.66);
    scene();
  } else if (kind === 'background') {
    sky();
  } else {
    // Splash: sky, the ball and the title, centred so any crop keeps them.
    sky();
    c.save();
    c.translate(size * 0.3, size * 0.25);
    c.scale(0.4, 0.4);
    scene();
    c.restore();
    c.fillStyle = '#fff';
    c.font = `700 ${150 * s}px Fredoka, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.shadowColor = 'rgba(40,70,140,.35)';
    c.shadowOffsetY = 8 * s;
    c.fillText('Bille Céleste', size / 2, size * 0.7);
  }
  return canvas.toDataURL('image/png');
};
