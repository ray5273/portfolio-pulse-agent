import { FONT_5X7 } from "../fonts/tiny5x7.js";
import { encodePng } from "./png.js";

const COLOR_CACHE = new Map();

function colorToRgba(color) {
  if (Array.isArray(color)) return color;
  if (COLOR_CACHE.has(color)) return COLOR_CACHE.get(color);
  const hex = color.replace("#", "");
  const rgba = [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
    hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255
  ];
  COLOR_CACHE.set(color, rgba);
  return rgba;
}

export class RasterCanvas {
  constructor(width, height, background = "#ffffff") {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 4);
    this.clear(background);
  }

  clear(color) {
    const [r, g, b, a] = colorToRgba(color);
    for (let i = 0; i < this.pixels.length; i += 4) {
      this.pixels[i] = r;
      this.pixels[i + 1] = g;
      this.pixels[i + 2] = b;
      this.pixels[i + 3] = a;
    }
  }

  setPixel(x, y, color) {
    this.setPixelRgba(x, y, colorToRgba(color));
  }

  setPixelRgba(x, y, rgba) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return;
    const [r, g, b, a] = rgba;
    const offset = (iy * this.width + ix) * 4;
    if (a === 255) {
      this.pixels[offset] = r;
      this.pixels[offset + 1] = g;
      this.pixels[offset + 2] = b;
      this.pixels[offset + 3] = 255;
      return;
    }
    const alpha = a / 255;
    this.pixels[offset] = Math.round(r * alpha + this.pixels[offset] * (1 - alpha));
    this.pixels[offset + 1] = Math.round(g * alpha + this.pixels[offset + 1] * (1 - alpha));
    this.pixels[offset + 2] = Math.round(b * alpha + this.pixels[offset + 2] * (1 - alpha));
    this.pixels[offset + 3] = 255;
  }

  rect(x, y, width, height, color) {
    const rgba = colorToRgba(color);
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + width));
    const y1 = Math.min(this.height, Math.round(y + height));
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) {
        this.setPixelRgba(xx, yy, rgba);
      }
    }
  }

  strokeRect(x, y, width, height, color) {
    this.line(x, y, x + width, y, color);
    this.line(x + width, y, x + width, y + height, color);
    this.line(x + width, y + height, x, y + height, color);
    this.line(x, y + height, x, y, color);
  }

  line(x0, y0, x1, y1, color, thickness = 1) {
    const rgba = colorToRgba(color);
    let x = Math.round(x0);
    let y = Math.round(y0);
    const endX = Math.round(x1);
    const endY = Math.round(y1);
    const dx = Math.abs(endX - x);
    const dy = Math.abs(endY - y);
    const sx = x < endX ? 1 : -1;
    const sy = y < endY ? 1 : -1;
    let err = dx - dy;

    while (true) {
      const radius = Math.max(0, Math.floor(thickness / 2));
      for (let yy = y - radius; yy <= y + radius; yy += 1) {
        for (let xx = x - radius; xx <= x + radius; xx += 1) {
          this.setPixelRgba(xx, yy, rgba);
        }
      }
      if (x === endX && y === endY) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  text(text, x, y, color = "#111827", scale = 2) {
    const value = String(text).toUpperCase();
    let cursor = x;
    for (const char of value) {
      const glyph = FONT_5X7[char] || FONT_5X7[" "];
      for (let row = 0; row < glyph.length; row += 1) {
        for (let col = 0; col < glyph[row].length; col += 1) {
          if (glyph[row][col] !== "1") continue;
          this.rect(cursor + col * scale, y + row * scale, scale, scale, color);
        }
      }
      cursor += 6 * scale;
    }
  }

  toPng() {
    return encodePng(this.width, this.height, this.pixels);
  }
}
