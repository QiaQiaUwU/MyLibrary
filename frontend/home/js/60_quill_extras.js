// ╔══ 60_quill_extras.js —— Quill 陪伴细节 · 佩饰/摸头/打盹/盲盒/庆祝/节气卡/习惯UI ══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。

// ═══════════════ v4.1.0 · Quill 陪伴细节 ═══════════════

// ── 入口小佩饰：连读火苗 + 二十四节气 ──
// 24 节气归并成 11 个纹样，每个都是手调的 24×24 线稿（内联样式，避开 .quill-fab svg 的白色填充规则）
const SEASON_MOTIFS={
  bud:     '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:#7fae7a;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round"><path d="M12 20V9"/><path d="M12 12C12 12 6.5 11.5 6 6.5C11 7 12 12 12 12Z" style="fill:#cfe4c8"/><path d="M12 9.5C12 9.5 17 9 17.5 4.5C13 5 12 9.5 12 9.5Z" style="fill:#cfe4c8"/></svg>',
  blossom: '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f6cdd8;stroke:#d98ba1;stroke-width:1.4;stroke-linejoin:round"><path d="M12 4.5C13.6 6.5 13.6 8.5 12 9.8C10.4 8.5 10.4 6.5 12 4.5Z"/><path d="M19 9.9C18.2 12.3 16.5 13.4 14.5 13C14.9 11 16.6 9.8 19 9.9Z"/><path d="M16.4 18.6C13.9 18.4 12.5 17 12.4 15C14.5 14.9 16 16.2 16.4 18.6Z"/><path d="M7.6 18.6C8 16.2 9.5 14.9 11.6 15C11.5 17 10.1 18.4 7.6 18.6Z"/><path d="M5 9.9C7.4 9.8 9.1 11 9.5 13C7.5 13.4 5.8 12.3 5 9.9Z"/><circle cx="12" cy="12" r="1.6" style="fill:#e8b23f;stroke:none"/></svg>',
  rain:    '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:#8fa9c9;stroke-width:1.7;stroke-linecap:round"><path d="M7 11a4.5 4.5 0 0 1 .6-8.96A5 5 0 0 1 17.3 4.5 3.5 3.5 0 0 1 17 11Z" style="fill:#dde7f2"/><path d="M8 14.5l-1.2 3"/><path d="M12.2 14.5l-1.2 3"/><path d="M16.4 14.5l-1.2 3"/></svg>',
  lotus:   '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f4c7d3;stroke:#cf7d95;stroke-width:1.4;stroke-linejoin:round"><path d="M12 6C13.8 8.2 13.8 11 12 13C10.2 11 10.2 8.2 12 6Z"/><path d="M5.5 9.5C8.2 9.8 10 11.5 10.4 14C7.7 13.9 5.9 12.2 5.5 9.5Z"/><path d="M18.5 9.5C18.1 12.2 16.3 13.9 13.6 14C14 11.5 15.8 9.8 18.5 9.5Z"/><path d="M4.5 15.5C9 18.5 15 18.5 19.5 15.5" style="fill:none;stroke:#7fae7a;stroke-width:1.6;stroke-linecap:round"/></svg>',
  wheat:   '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f2dfb0;stroke:#c9a24b;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"><path d="M12 21V8" style="fill:none;stroke-width:1.6"/><path d="M12 8C10 7.6 8.9 6.3 8.8 4.2C10.9 4.6 12 5.9 12 8Z"/><path d="M12 8C14 7.6 15.1 6.3 15.2 4.2C13.1 4.6 12 5.9 12 8Z"/><path d="M12 12.5C10 12.1 8.9 10.8 8.8 8.7C10.9 9.1 12 10.4 12 12.5Z"/><path d="M12 12.5C14 12.1 15.1 10.8 15.2 8.7C13.1 9.1 12 10.4 12 12.5Z"/><path d="M12 17C10 16.6 8.9 15.3 8.8 13.2C10.9 13.6 12 14.9 12 17Z"/><path d="M12 17C14 16.6 15.1 15.3 15.2 13.2C13.1 13.6 12 14.9 12 17Z"/></svg>',
  fan:     '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f6e2c8;stroke:#c98a5f;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><ellipse cx="12" cy="9" rx="7" ry="6.2"/><path d="M12 15.2V21" style="fill:none"/><path d="M12 3.2V15" style="fill:none;stroke-width:1.1;opacity:.65"/><path d="M6.2 5.6C8 8 10 9.2 12 9.2C14 9.2 16 8 17.8 5.6" style="fill:none;stroke-width:1.1;opacity:.65"/></svg>',
  leaf:    '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f0c896;stroke:#c07f45;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M18.5 5.5C18.9 12.5 15 18 8.5 18.5C7 15 7.5 10 12 7.5C15 5.8 17 5.4 18.5 5.5Z"/><path d="M6 20C9 16.5 13 12.5 16.5 8" style="fill:none;stroke-width:1.2"/></svg>',
  dew:     '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:#cfe6ea;stroke:#79aab4;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3.5C15.5 8 17.2 11.2 17.2 14A5.2 5.2 0 0 1 6.8 14C6.8 11.2 8.5 8 12 3.5Z"/><path d="M10 14.5A2.6 2.6 0 0 0 11.6 16.6" style="fill:none;stroke-width:1.2;opacity:.8"/></svg>',
  frost:   '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:#93b7d1;stroke-width:1.6;stroke-linecap:round"><path d="M12 4v16M5.1 8l13.8 8M18.9 8L5.1 16"/><path d="M12 4l-1.8 2M12 4l1.8 2M12 20l-1.8-2M12 20l1.8-2" style="stroke-width:1.2"/></svg>',
  snow:    '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:none;stroke:#8fb3d9;stroke-width:1.6;stroke-linecap:round"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><circle cx="12" cy="12" r="1.4" style="fill:#dce9f6;stroke:none"/></svg>',
  plum:    '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:#8a6f5a;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M4 19C8 16 11 12 14 6"/><path d="M10.5 12.5C12.5 12.8 14 12 15 10.5" style="stroke-width:1.2"/><circle cx="16.5" cy="7" r="2.4" style="fill:#e8a7b8;stroke:#c9788f;stroke-width:1.2"/><circle cx="19.3" cy="11" r="1.7" style="fill:#e8a7b8;stroke:#c9788f;stroke-width:1.2"/><circle cx="8.5" cy="15.5" r="1.5" style="fill:#f2c7d2;stroke:#c9788f;stroke-width:1.1"/></svg>',
  // ── v4.5.1 起：一节气一款（此前 11 款盖 24 节气，交节日经常看不出"换皮肤"）。上面老键保留兜底。
  rainleaf: '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#cfe4c8;stroke:#7fae7a;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M4.5 15C4.5 10 8.5 6.5 14 6C14.3 11.5 10.5 15.3 5.2 15.6Z"/><path d="M6.5 13.5C8.5 11.5 10.5 10 12.5 8.5" style="fill:none;stroke-width:1.1;opacity:.7"/><path d="M17.5 4.5C18.6 6 18.6 7.3 17.5 8.2C16.4 7.3 16.4 6 17.5 4.5Z" style="fill:#cfe2f0;stroke:#8fa9c9;stroke-width:1.3"/><path d="M19.8 10.5C20.7 11.7 20.7 12.8 19.8 13.6C18.9 12.8 18.9 11.7 19.8 10.5Z" style="fill:#cfe2f0;stroke:#8fa9c9;stroke-width:1.2"/></svg>',
  swallow:  '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#b9c9dd;stroke:#54708f;stroke-width:1.4;stroke-linejoin:round"><path d="M3.5 8.5C7 6.5 10.5 6.2 13.5 7.8C15.5 5.8 17.8 5.2 20.5 5.8C18.8 7.4 17.2 8.4 15.7 9C15.4 12.2 13 15.5 8.5 18C10.2 15 11 12.6 10.8 10.8C8.4 11 6 10.3 3.5 8.5Z"/><circle cx="17.2" cy="7.2" r=".9" style="fill:#2f3f52;stroke:none"/><path d="M14.6 9.4l1.6 1.2" style="fill:none;stroke:#c96a4e;stroke-width:1.6"/></svg>',
  kite:     '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f6d8c2;stroke:#c98a5f;stroke-width:1.4;stroke-linejoin:round"><path d="M12 2.8L18.6 10L12 15L5.4 10Z"/><path d="M12 2.8V15M5.4 10H18.6" style="fill:none;stroke-width:1;opacity:.6"/><path d="M12 15C11 17.5 9.5 19.5 7 21" style="fill:none;stroke-width:1.2"/><path d="M9.6 17.6l1.4 1M7.6 19.6l1.4 1" style="fill:none;stroke:#d98ba1;stroke-width:1.3"/></svg>',
  peony:    '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f2b8ca;stroke:#cf7d95;stroke-width:1.4;stroke-linejoin:round"><path d="M12 12.5C9.5 12 8 10 8.2 7.2C10.8 7.6 12.2 9.4 12 12.5Z"/><path d="M12 12.5C14.5 12 16 10 15.8 7.2C13.2 7.6 11.8 9.4 12 12.5Z"/><path d="M11.8 13C9 13.8 6.8 13 5.5 10.8C8 9.9 10.3 10.6 11.8 13Z"/><path d="M12.2 13C15 13.8 17.2 13 18.5 10.8C16 9.9 13.7 10.6 12.2 13Z"/><path d="M12 13.2C10.4 15.6 10.6 17.8 12.4 19.8C14 17.6 13.8 15.4 12 13.2Z" style="fill:#e89bb4"/><circle cx="12" cy="12.2" r="1.5" style="fill:#e8b23f;stroke:none"/></svg>',
  greenwheat:'<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#d8ecc0;stroke:#7fae6a;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"><path d="M12 21V8" style="fill:none;stroke-width:1.6"/><path d="M12 8C10 7.6 8.9 6.3 8.8 4.2C10.9 4.6 12 5.9 12 8Z"/><path d="M12 8C14 7.6 15.1 6.3 15.2 4.2C13.1 4.6 12 5.9 12 8Z"/><path d="M12 12.5C10 12.1 8.9 10.8 8.8 8.7C10.9 9.1 12 10.4 12 12.5Z"/><path d="M12 12.5C14 12.1 15.1 10.8 15.2 8.7C13.1 9.1 12 10.4 12 12.5Z"/><path d="M9.5 6l-1.6-2.4M14.5 6l1.6-2.4" style="fill:none;stroke-width:1"/></svg>',
  plumfruit:'<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#cfe4a8;stroke:#84ad55;stroke-width:1.5;stroke-linejoin:round"><path d="M19.5 3.5C15.5 5.5 12.5 8.5 11 12" style="fill:none;stroke:#8a7355;stroke-width:1.5;stroke-linecap:round"/><circle cx="9.5" cy="15.5" r="4.6"/><circle cx="16" cy="16.5" r="3.4" style="fill:#c3dc94"/><path d="M14 7C16 6.4 17.8 6.8 19.2 8.2C17.4 9 15.6 8.7 14 7Z"/></svg>',
  cicada:   '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#e8d3b0;stroke:#a5794f;stroke-width:1.4;stroke-linejoin:round"><ellipse cx="12" cy="6.8" rx="3.6" ry="2.8"/><circle cx="9.4" cy="6.2" r=".9" style="fill:#5f402a;stroke:none"/><circle cx="14.6" cy="6.2" r=".9" style="fill:#5f402a;stroke:none"/><path d="M12 9.4C14 9.4 15.2 11 15.2 13.6C15.2 16.8 13.9 19.4 12 20.8C10.1 19.4 8.8 16.8 8.8 13.6C8.8 11 10 9.4 12 9.4Z"/><path d="M9.4 10.5C6.8 12.5 5.6 15.3 5.9 18.8" style="fill:none;stroke-width:1.1;opacity:.75"/><path d="M14.6 10.5C17.2 12.5 18.4 15.3 18.1 18.8" style="fill:none;stroke-width:1.1;opacity:.75"/><path d="M9.6 13.5h4.8M9.7 16h4.6" style="fill:none;stroke-width:1;opacity:.6"/></svg>',
  dragonfly:'<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:#c9583a;stroke-width:1.7;stroke-linecap:round"><path d="M12 8.5V20"/><circle cx="12" cy="6" r="1.9" style="fill:#e88a5f;stroke-width:1.4"/><ellipse cx="6.8" cy="9.2" rx="4.4" ry="1.7" style="fill:#dde7f2;stroke:#8fa9c9;stroke-width:1.2" transform="rotate(-14 6.8 9.2)"/><ellipse cx="17.2" cy="9.2" rx="4.4" ry="1.7" style="fill:#dde7f2;stroke:#8fa9c9;stroke-width:1.2" transform="rotate(14 17.2 9.2)"/><ellipse cx="7.4" cy="12.6" rx="3.6" ry="1.5" style="fill:#e9f0f7;stroke:#8fa9c9;stroke-width:1.1" transform="rotate(-24 7.4 12.6)"/><ellipse cx="16.6" cy="12.6" rx="3.6" ry="1.5" style="fill:#e9f0f7;stroke:#8fa9c9;stroke-width:1.1" transform="rotate(24 16.6 12.6)"/></svg>',
  melon:    '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f0989c;stroke:#c95560;stroke-width:1.4;stroke-linejoin:round"><path d="M3.5 14A8.5 8.5 0 0 1 20.5 14Z" style="fill:#a9cba0;stroke:#5f8f5a;stroke-width:1.5"/><path d="M5.6 14A6.4 6.4 0 0 1 18.4 14Z"/><path d="M4 14h16" style="fill:none;stroke:#5f8f5a;stroke-width:1.3"/><circle cx="9.5" cy="11.6" r=".8" style="fill:#4a3428;stroke:none"/><circle cx="14.5" cy="11.6" r=".8" style="fill:#4a3428;stroke:none"/><circle cx="12" cy="9.6" r=".8" style="fill:#4a3428;stroke:none"/></svg>',
  rice:     '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f2dfb0;stroke:#c9a24b;stroke-width:1.3;stroke-linejoin:round"><path d="M7 21C7.5 15 9.5 10 15 6.5" style="fill:none;stroke-width:1.5;stroke-linecap:round"/><ellipse cx="15.8" cy="5.8" rx="2" ry="1.3" transform="rotate(-24 15.8 5.8)"/><ellipse cx="18.2" cy="7.6" rx="2" ry="1.3" transform="rotate(8 18.2 7.6)"/><ellipse cx="19.2" cy="10.4" rx="2" ry="1.3" transform="rotate(38 19.2 10.4)"/><ellipse cx="13.2" cy="8.4" rx="1.9" ry="1.2" transform="rotate(-40 13.2 8.4)"/><ellipse cx="15.6" cy="10.8" rx="1.9" ry="1.2" transform="rotate(-6 15.6 10.8)"/><ellipse cx="16.6" cy="13.4" rx="1.9" ry="1.2" transform="rotate(30 16.6 13.4)"/></svg>',
  reed:     '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#efe3c4;stroke:#b09a6f;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round"><path d="M9 21C9 15 9 10 9.5 5.5" style="fill:none"/><path d="M9.5 6.5C8.6 4.6 8.8 3 10.2 1.8C11.2 3.4 11 5 9.5 6.5Z"/><path d="M15.5 21C15.5 16 15.5 12 16 8" style="fill:none"/><path d="M16 9C15.2 7.3 15.4 5.9 16.6 4.8C17.5 6.2 17.3 7.6 16 9Z"/><path d="M9.3 13C11.5 12.4 13.5 12.7 15.4 14" style="fill:none;stroke-width:1.1;opacity:.7"/><path d="M19.5 12.5C20.3 13.5 20.3 14.4 19.5 15.1C18.7 14.4 18.7 13.5 19.5 12.5Z" style="fill:#cfe2f0;stroke:#8fa9c9;stroke-width:1.2"/></svg>',
  osmanthus:'<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f4d47a;stroke:#c9962e;stroke-width:1.2;stroke-linejoin:round"><path d="M4 16C7.5 12 12 9.5 18 8.5" style="fill:none;stroke:#5f8a5f;stroke-width:1.4;stroke-linecap:round"/><path d="M14 13.5C16.5 12.5 19 12.8 21 14.5C19 16 16.5 16 14 13.5Z" style="fill:#a9cba0;stroke:#5f8f5a;stroke-width:1.3"/><g><circle cx="8" cy="8.5" r="1.3"/><circle cx="10.6" cy="7.2" r="1.3"/><circle cx="9.9" cy="10.1" r="1.3"/><circle cx="7.1" cy="11.2" r="1.2"/><circle cx="12.4" cy="9.6" r="1.2"/></g><circle cx="9.6" cy="9" r=".7" style="fill:#a8641f;stroke:none"/></svg>',
  chrys:    '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:#e0913e;stroke-width:1.5;stroke-linecap:round"><path d="M12 12L12 4.5M12 12L17.3 6.7M12 12L19.5 12M12 12L17.3 17.3M12 12L12 19.5M12 12L6.7 17.3M12 12L4.5 12M12 12L6.7 6.7"/><path d="M12 12L12 7.5M12 12L15.2 8.8M12 12L16.5 12M12 12L15.2 15.2M12 12L12 16.5M12 12L8.8 15.2M12 12L7.5 12M12 12L8.8 8.8" style="stroke:#f2b85f;stroke-width:1.2"/><circle cx="12" cy="12" r="1.8" style="fill:#c9862e;stroke:none"/></svg>',
  persimmon:'<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f2a24e;stroke:#c9762e;stroke-width:1.4;stroke-linejoin:round"><circle cx="12" cy="14" r="6.4"/><path d="M12 7.8C10.6 6.6 10.4 5.4 11.4 4.2L12.7 4.9C12.1 5.8 12 6.7 12.4 7.6Z" style="fill:#8a9a5b;stroke:#5f7040;stroke-width:1.2"/><path d="M12 8.4L14.4 9.8L13.6 12.4L10.4 12.4L9.6 9.8Z" style="fill:#a9cba0;stroke:#5f8f5a;stroke-width:1.2"/></svg>',
  camellia: '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#ef9098;stroke:#c95560;stroke-width:1.3;stroke-linejoin:round"><path d="M15 17.5C17.5 17 19.5 17.6 21 19.3C19 20.5 17 20.1 15 17.9Z" style="fill:#a9cba0;stroke:#5f8f5a;stroke-width:1.3"/><circle cx="11" cy="7.6" r="2.7"/><circle cx="15.2" cy="10.6" r="2.7"/><circle cx="13.6" cy="15.4" r="2.7"/><circle cx="8.4" cy="15.4" r="2.7"/><circle cx="6.8" cy="10.6" r="2.7"/><circle cx="11" cy="11.8" r="2.5" style="fill:#e5717e"/><circle cx="11" cy="11.8" r="1.1" style="fill:#f2c95f;stroke:none"/></svg>',
  snowman:  '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#fdfdf9;stroke:#a9bccd;stroke-width:1.4;stroke-linejoin:round"><circle cx="12" cy="15.4" r="5.4"/><circle cx="12" cy="7.4" r="3.6"/><circle cx="10.7" cy="6.8" r=".7" style="fill:#4a4038;stroke:none"/><circle cx="13.3" cy="6.8" r=".7" style="fill:#4a4038;stroke:none"/><path d="M12 7.8l2.6.7-2.6.6Z" style="fill:#e8853e;stroke:none"/><path d="M8.6 10.6C10.8 11.8 13.2 11.8 15.4 10.6" style="fill:none;stroke:#cf5a52;stroke-width:1.6;stroke-linecap:round"/><circle cx="12" cy="14" r=".7" style="fill:#4a4038;stroke:none"/><circle cx="12" cy="16.8" r=".7" style="fill:#4a4038;stroke:none"/></svg>',
  pinesnow: '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#a9cba0;stroke:#5f8f5a;stroke-width:1.4;stroke-linejoin:round"><path d="M12 10L17.5 18H6.5Z"/><path d="M12 4.5L16.2 11H7.8Z"/><path d="M11 18h2v2.6h-2Z" style="fill:#a5794f;stroke:#7c5636;stroke-width:1.2"/><path d="M8.6 10.6C10 11.7 12 11.9 13.4 11.2C14.3 11.7 15.2 11.6 15.8 11" style="fill:#ffffff;stroke:#a9bccd;stroke-width:1.2"/><path d="M12 4.2C13 5 13.2 6 12.5 7C11.5 6.3 11.3 5.3 12 4.2Z" style="fill:#ffffff;stroke:#a9bccd;stroke-width:1.1"/></svg>',
  narcissus:'<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#fdfdf9;stroke:#b9b2a2;stroke-width:1.3;stroke-linejoin:round"><path d="M9 20.5C8.2 17 8.4 14 9.6 11" style="fill:none;stroke:#5f8f5c;stroke-width:1.5;stroke-linecap:round"/><path d="M14.6 20.5C15.4 17.5 15.4 14.8 14.4 12.2" style="fill:none;stroke:#5f8f5c;stroke-width:1.4;stroke-linecap:round"/><path d="M12 8.6C13.1 6.9 15 6.4 16.9 7.3C16 9.2 14.3 10 12.2 9.8C12.6 11.8 12 13.6 10.3 14.8C9.2 13 9.4 11.1 10.8 9.4C8.8 9.4 7.3 8.5 6.5 6.7C8.5 6 10.3 6.6 11.6 8.4Z"/><circle cx="11.6" cy="8.9" r="1.7" style="fill:#f2b04e;stroke:#d0862e;stroke-width:1.1"/></svg>',
  nandina:  '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#e05a48;stroke:#b83430;stroke-width:1.2;stroke-linejoin:round"><path d="M12 20C12 16.5 12 13.5 12 11" style="fill:none;stroke:#6a5444;stroke-width:1.4;stroke-linecap:round"/><path d="M12 15.5C9.8 15 8.2 15.4 6.8 16.8C8.6 17.8 10.4 17.5 12 15.9Z" style="fill:#4f6a4a;stroke:#3a5238;stroke-width:1.1"/><circle cx="12" cy="9" r="1.9"/><circle cx="8.9" cy="10.6" r="1.7"/><circle cx="15.1" cy="10.6" r="1.7"/><circle cx="10.4" cy="12.8" r="1.6"/><circle cx="13.6" cy="12.8" r="1.6"/><path d="M8.2 7.4C9.5 5.8 11.4 5 12 5C12.6 5 14.5 5.8 15.8 7.4C14.4 6.7 13.1 6.4 12 6.4C10.9 6.4 9.6 6.7 8.2 7.4Z" style="fill:#ffffff;stroke:#a9bccd;stroke-width:1.1"/></svg>',
};
const _FLAME_ICON='<svg viewBox="0 0 24 24" style="width:11px;height:11px;fill:#f6c8a0;stroke:#c76b3f;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3C14.5 6.5 17 9 17 13A5 5 0 0 1 7 13C7 11 7.8 9.4 9 8C9.2 9.6 9.9 10.6 11 11C10.6 8 11 5.3 12 3Z"/></svg>';
// ── v4.3 · 节日佩饰：节日当天顶掉节气纹样、轻轻脉动（圣诞树/南瓜灯/跨年烟花/情人节心形）──
const FEST_MOTIFS={
  tree:    '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#a9cba0;stroke:#5f8f5a;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M12 4L8.6 9H10L6.8 14H9L5.5 19.5H18.5L15 14H17.2L14 9H15.4L12 4Z"/><path d="M11 19.5h2V21.5h-2Z" style="fill:#a5794f;stroke:#7c5636;stroke-width:1.2"/><path d="M12 2.4l.55 1.1 1.15.2-.85.85.2 1.15-1.05-.55-1.05.55.2-1.15-.85-.85 1.15-.2Z" style="fill:#f2d38a;stroke:#c9a24b;stroke-width:.9"/></svg>',
  pumpkin: '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:#f0a95c;stroke:#c07235;stroke-width:1.5;stroke-linejoin:round"><path d="M11 5.5C11 4 11.6 3 12.6 2.6L13.6 3.4C12.9 3.9 12.8 4.6 12.8 5.5Z" style="fill:#8a9a5b;stroke:#5f7040;stroke-width:1.2"/><ellipse cx="12" cy="13" rx="8" ry="7"/><path d="M12 6.3C10 6.3 8.6 9.2 8.6 13C8.6 16.8 10 19.7 12 19.7" style="fill:none;stroke-width:1.1;opacity:.55"/><path d="M9 11.4l2 1.6H7Z M15 11.4l2 1.6H13Z" style="fill:#7a4218;stroke:none"/><path d="M8.4 15.6C9.6 17 14.4 17 15.6 15.6L14.4 16.6L13.2 15.8L12 16.8L10.8 15.8L9.6 16.6Z" style="fill:#7a4218;stroke:none"/></svg>',
  firework:'<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:#e0a23e;stroke-width:1.7;stroke-linecap:round"><path d="M12 4.5V8M12 16v3.5M4.5 12H8M16 12h3.5M6.7 6.7l2.5 2.5M14.8 14.8l2.5 2.5M17.3 6.7l-2.5 2.5M9.2 14.8l-2.5 2.5"/><circle cx="12" cy="12" r="1.5" style="fill:#f2d38a;stroke:none"/><circle cx="19" cy="5" r="1.1" style="fill:#d97a94;stroke:none"/><circle cx="5" cy="18.6" r="1" style="fill:#9fc7e8;stroke:none"/></svg>',
  heart:   '<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:#f2a9bc;stroke:#d97a94;stroke-width:1.5;stroke-linejoin:round"><path d="M12 20.5C9.5 18.8 3.5 15 3.5 9.8C3.5 7 5.5 5 7.9 5C9.5 5 11.1 5.9 12 7.2C12.9 5.9 14.5 5 16.1 5C18.5 5 20.5 7 20.5 9.8C20.5 15 14.5 18.8 12 20.5Z"/></svg>'
};
const FEST_MOTIF_MAP={'圣诞节':'tree','平安夜':'tree','万圣节':'pumpkin','跨年夜':'firework','元旦':'firework','情人节':'heart'};
let _fabBadges={streak:0,season:null};
function seasonBadgeOn(){return localStorage.getItem('qf_season')!=='0';}
function toggleSeasonBadge(on){localStorage.setItem('qf_season',on?'1':'0');}
async function loadFabBadges(){
  try{const r=await (await fetch('/api/journey/streak')).json();_fabBadges.streak=r.streak||0;}catch(e){}
  try{_fabBadges.season=await (await fetch('/api/quill/season')).json();}catch(e){}
}
// v4.6：不再挂常驻小角标（此前只有左下角 20px 一颗圆点，做了 24 张图基本没人看得到）。
// 改成：浮钮平时是羽毛；鼠标一靠近，羽毛就换成当天的节气/节日插画晃一晃，把连读天数一起报出来——
// 这样每次悬浮都用得上这批插画，而不是靠运气触发的彩蛋。
function renderFabBadges(){/* 兼容旧调用点：徽章已并入悬浮换装，这里不再挂载 DOM */}

let _qSkinTimer=null,_qSkinBusy=false,_qSkinLeaveT=null;
function _qSkinIcon(){
  const s=_fabBadges.season;if(!s||!s.term)return null;
  const fest=s.festival&&FEST_MOTIF_MAP[s.festival];
  if(fest)return{svg:FEST_MOTIFS[fest],label:s.festival,fest:true};
  return{svg:SEASON_MOTIFS[s.motif]||SEASON_MOTIFS.leaf,label:s.term,fest:!!s.is_term_day};
}
function quillSkinHoverIn(){
  const fab=document.getElementById('quill-fab');if(!fab)return;
  if(_qSkinLeaveT){clearTimeout(_qSkinLeaveT);_qSkinLeaveT=null;}
  if(window._quillDragged||!seasonBadgeOn()||_qSkinBusy)return;
  const info=_qSkinIcon();if(!info)return;
  _qSkinBusy=true;
  const av=fab.querySelector('.qf-av');if(!av)return;
  if(!av.dataset.orig)av.dataset.orig=av.innerHTML;         // 记下羽毛，离开时换回来
  fab.classList.remove('q-wiggle');void fab.offsetWidth;
  fab.classList.add('q-wiggle','qf-skin-on');                // 晃一晃 + 放大插画（CSS 里 !important 覆盖内联尺寸）
  av.innerHTML=info.svg;
  if(info.fest)av.classList.add('qf-fest-glow');
  document.querySelectorAll('.qf-flare').forEach(x=>x.remove());
  const r=fab.getBoundingClientRect();
  const f=document.createElement('div');f.className='qf-flare';f.style.pointerEvents='auto';f.style.cursor='pointer';
  f.title='点一下看节气卡';
  // v4.6.2 修过头了：有连读天数时气泡只剩"连续阅读 N 天"，看着像个纯状态标签，
  // 没有任何"点它有反应"的提示——点进去的节气卡动画其实一直都在，只是气泡不再暗示可以点。
  // 现在两种情况都带上点击提示，只是不再重复节气名和诗句本身。
  const streakLine=_fabBadges.streak>=1?('连续阅读 '+_fabBadges.streak+' 天'):info.label;
  f.innerHTML='<span class="qf-flare-ic">'+info.svg+'</span><span>'+streakLine+'</span>';
  // 点这个小气泡才是查看节气卡的入口——浮钮本体的点击永远只做一件事（开聊天面板），两者不再互相抢
  f.onclick=(e)=>{e.stopPropagation();showTermCard();quillSkinHoverOut(true);};
  f.addEventListener('mouseenter',()=>{if(_qSkinLeaveT){clearTimeout(_qSkinLeaveT);_qSkinLeaveT=null;}});
  f.addEventListener('mouseleave',_qSkinScheduleLeave);
  document.body.appendChild(f);
  let x=r.left+r.width/2-f.offsetWidth/2, y=r.top-f.offsetHeight-10;
  x=Math.max(8,Math.min(window.innerWidth-f.offsetWidth-8,x));
  if(y<8)y=r.bottom+10;
  f.style.left=x+'px';f.style.top=y+'px';
  requestAnimationFrame(()=>f.classList.add('on'));
}
function _qSkinScheduleLeave(){
  if(_qSkinLeaveT)clearTimeout(_qSkinLeaveT);
  _qSkinLeaveT=setTimeout(()=>quillSkinHoverOut(),180);   // 给点缓冲：鼠标从浮钮挪去点气泡的路上不会被提前撤走
}
function quillSkinHoverOut(immediate){
  const fab=document.getElementById('quill-fab');if(!fab)return;
  _qSkinBusy=false;
  fab.classList.remove('qf-skin-on');
  const av=fab.querySelector('.qf-av');
  if(av){av.classList.remove('qf-fest-glow');if(av.dataset.orig)av.innerHTML=av.dataset.orig;}
  document.querySelectorAll('.qf-flare').forEach(el=>{el.classList.add('bye');setTimeout(()=>el.remove(),immediate?0:450);});
}
(function(){
  const fab=document.getElementById('quill-fab');if(!fab)return;
  fab.addEventListener('mouseenter',quillSkinHoverIn);
  fab.addEventListener('mouseleave',_qSkinScheduleLeave);
})();
// v4.6.1：悬浮换装期间点浮钮本体不再拦截成"打开节气卡"——mouseenter 必然先于 click 触发，
// 之前那条判断等于让鼠标点击永远打不开聊天面板（只能点出节气卡），这是上一轮的严重回归，已改回：
// 浮钮点击永远只做一件事（开面板），节气卡改由上面那个气泡自己接管点击。

// ── 长按摸头：粉色快闪 + 心心，攒 10 次解锁一句私房话 ──
function quillBubble(text,ms){
  const fab=document.getElementById('quill-fab');if(!fab)return;
  document.querySelectorAll('.q-bubble').forEach(x=>x.remove());
  const r=fab.getBoundingClientRect();
  const b=document.createElement('div');b.className='q-bubble';b.textContent=text;
  document.body.appendChild(b);
  const bw=Math.min(230,window.innerWidth-24);b.style.maxWidth=bw+'px';
  let x=r.left+r.width/2-b.offsetWidth+18, y=r.top-b.offsetHeight-10;
  x=Math.max(8,Math.min(window.innerWidth-b.offsetWidth-8,x));
  if(y<8)y=r.bottom+10;
  b.style.left=x+'px';b.style.top=y+'px';
  setTimeout(()=>{b.style.opacity='0';setTimeout(()=>b.remove(),400);},ms||4000);
}
function doQuillPat(){
  const fab=document.getElementById('quill-fab');if(!fab)return;
  qWake();
  fab.classList.remove('pat-glow');void fab.offsetWidth;fab.classList.add('pat-glow');
  setTimeout(()=>fab.classList.remove('pat-glow'),1950);
  qMood('shy');  // 小灯粉色快闪 = 害羞
  const r=fab.getBoundingClientRect();
  for(let i=0;i<3;i++){
    setTimeout(()=>{
      const h=document.createElement('span');h.className='qf-heart';h.textContent='♥';
      h.style.left=(r.left+10+Math.random()*(r.width-20))+'px';
      h.style.top=(r.top-2)+'px';
      h.style.color=['#e8879f','#f2a9bc','#d97a94'][i];
      document.body.appendChild(h);setTimeout(()=>h.remove(),1400);
    },i*220);
  }
  let n=parseInt(localStorage.getItem('quill_pat_n')||'0')+1;
  localStorage.setItem('quill_pat_n',String(n));
  if(n===10){
    setTimeout(()=>{
      quillBubble('被摸了十下……好吧，告诉你个小秘密：每次你翻开书，我都会悄悄把那页的风声记下来。这句只说给你听。',7000);
      qdConfetti();
    },600);
  }
}

// ── 书架空闲 5 分钟：Quill 打盹（垂头轻摇 + 灯转暖黄慢呼吸 + 飘小 z，偶尔翻个身），一动就醒 ──
let _qLastAct=Date.now(),_qDozing=false,_qZT=null,_qRollT=null;
function qWake(){
  _qLastAct=Date.now();
  if(!_qDozing)return;
  _qDozing=false;
  const fab=document.getElementById('quill-fab');
  if(fab){
    fab.classList.remove('dozing','roll');
    fab.classList.remove('act-swing');void fab.offsetWidth;fab.classList.add('act-swing');  // 醒来抖一下
    setTimeout(()=>fab.classList.remove('act-swing'),700);
  }
  if(_qZT){clearInterval(_qZT);_qZT=null;}
  if(_qRollT){clearInterval(_qRollT);_qRollT=null;}
  document.querySelectorAll('.qf-z').forEach(x=>x.remove());
}
function _qSpawnZ(){
  const fab=document.getElementById('quill-fab');if(!fab||!_qDozing)return;
  const r=fab.getBoundingClientRect();
  const z=document.createElement('span');z.className='qf-z';z.textContent='z';
  z.style.left=(r.right-14)+'px';z.style.top=(r.top-4)+'px';
  document.body.appendChild(z);setTimeout(()=>z.remove(),2600);
}
function qDozeCheck(){
  if(_qDozing)return;
  if(Date.now()-_qLastAct<5*60000)return;
  const fab=document.getElementById('quill-fab');
  if(!fab||fab.style.display==='none')return;
  const panel=document.getElementById('quill-panel');
  if(panel&&panel.classList.contains('show'))return;
  _qDozing=true;
  fab.classList.add('dozing');
  _qSpawnZ();
  _qZT=setInterval(_qSpawnZ,3200);
  _qRollT=setInterval(()=>{  // 睡熟了偶尔翻个身
    if(!_qDozing)return;
    fab.classList.add('roll');setTimeout(()=>fab.classList.remove('roll'),2400);
  },42000);
}
['mousemove','mousedown','keydown','wheel','touchstart','scroll'].forEach(ev=>document.addEventListener(ev,qWake,{passive:true}));
setInterval(qDozeCheck,20000);

// ── 盲盒开卷：摇一摇（或点按钮）随机翻开一本没读过的书的第一章 ──
let _qShakeOn=false,_qShakeLast=0,_qBlindBook=null;
function enableShake(){
  if(_qShakeOn||!window.DeviceMotionEvent)return;
  const bind=()=>{ _qShakeOn=true;
    window.addEventListener('devicemotion',e=>{
      const a=e.accelerationIncludingGravity;if(!a)return;
      const g=Math.abs(a.x||0)+Math.abs(a.y||0)+Math.abs(a.z||0);
      if(g>26&&Date.now()-_qShakeLast>4000){_qShakeLast=Date.now();quillBlind(true);}
    });
  };
  try{
    if(typeof DeviceMotionEvent.requestPermission==='function')
      DeviceMotionEvent.requestPermission().then(s=>{if(s==='granted')bind();}).catch(()=>{});
    else bind();
  }catch(e){}
}
function quillBlind(again){
  enableShake();  // 首次由用户手势进入，iOS 才允许申请运动权限
  const box=document.getElementById('qblind');if(!box)return;
  const pool=(DATA||[]).filter(b=>!b.rstatus&&!b.reading&&!(b.progress>0));
  if(!pool.length){toast('书架上没有还没翻开过的书啦');return;}
  box.style.display='block';box.classList.remove('revealed');
  const tip=document.getElementById('qb-tip');if(tip)tip.textContent='盲盒摇晃中…';
  box.classList.remove('shaking');void box.offsetWidth;box.classList.add('shaking');
  _qBlindBook=pool[Math.floor(Math.random()*pool.length)];
  setTimeout(()=>{
    box.classList.remove('shaking');
    if(!_qBlindBook)return;
    const t=document.getElementById('qb-t'),a=document.getElementById('qb-a');
    if(t)t.textContent='《'+_qBlindBook.t+'》';
    if(a)a.textContent=_qBlindBook.a||'';
    const go=document.getElementById('qb-go');
    if(go)go.onclick=()=>{box.style.display='none';openReader(_qBlindBook.id);};
    box.classList.add('revealed');
    if(tip)tip.textContent='手机摇一摇＝再抽一本 · 点空白处关闭';
    qdConfetti(18);
  },950);
}

// ── 读完一本：撒花 + 花园里这棵树的特写（开花的树等花园那边做了再补） ──
async function celebrateFinish(bid){
  if(localStorage.getItem('qf_finish')==='0')return;   // 设置里可关
  const b=findBook(bid);if(!b)return;
  qdConfetti();qMood('win');
  const fab=document.getElementById('quill-fab');
  if(fab){fab.classList.remove('celebrate');void fab.offsetWidth;fab.classList.add('celebrate');setTimeout(()=>fab.classList.remove('celebrate'),2300);}
  let skin=null,nth=0;
  try{
    const r=await (await fetch('/api/journey/garden')).json();
    const t=(r.trees||[]).find(x=>x.id===bid);
    if(t)skin=t.skin;
    nth=r.finished_count||0;
  }catch(e){}
  const box=document.getElementById('qfinish');if(!box)return;
  const tr=box.querySelector('.qfin-tree');
  if(tr)tr.innerHTML=treeSVG(5,skin||undefined);
  const ti=box.querySelector('.qfin-title');
  if(ti)ti.textContent='《'+b.t+'》读完啦';
  const su=box.querySelector('.qfin-sub');
  if(su)su.textContent=(nth?('书房里第 '+nth+' 本读完的书'):'又读完一本')+' · 花园里它的树长成了';
  box.style.display='block';
  qPetals();
}
function qPetals(){
  const cols=['#f2c4d0','#f7d9e0','#fbeaee','#f0b7c6'];
  for(let i=0;i<26;i++){
    const p=document.createElement('div');p.className='qf-petal';
    p.style.left=(Math.random()*100)+'vw';
    p.style.background=cols[i%cols.length];
    p.style.setProperty('--dx',(Math.random()*120-60)+'px');
    p.style.animationDuration=(2.6+Math.random()*2)+'s';
    p.style.animationDelay=(Math.random()*0.9)+'s';
    document.body.appendChild(p);
    setTimeout(()=>p.remove(),5600);
  }
}

// ── 每日播报 · 预置新闻源（勾选即订阅） ──
const QP_RSS_PRESETS=[
  {g:'中文 · 国际',items:[
    ['BBC 中文','https://feeds.bbci.co.uk/zhongwen/simp/rss.xml'],
    ['纽约时报中文网','https://cn.nytimes.com/rss/'],
    ['德国之声中文','https://rss.dw.com/xml/rss-chi-all'],
    ['法广 RFI 中文','https://www.rfi.fr/cn/rss'],
    ['联合国新闻','https://news.un.org/feed/subscribe/zh/news/all/rss.xml'],
  ]},
  {g:'English · World',items:[
    ['BBC World','https://feeds.bbci.co.uk/news/world/rss.xml'],
    ['NYT World','https://rss.nytimes.com/services/xml/rss/nyt/World.xml'],
    ['The Guardian','https://www.theguardian.com/world/rss'],
    ['Al Jazeera','https://www.aljazeera.com/xml/rss/all.xml'],
    ['NPR News','https://feeds.npr.org/1001/rss.xml'],
  ]},
  {g:'财经',items:[
    ['FT 中文网','https://www.ftchinese.com/rss/news'],
    ['BBC Business','https://feeds.bbci.co.uk/news/business/rss.xml'],
    ['CNBC Top News','https://www.cnbc.com/id/100003114/device/rss/rss.html'],
  ]},
  {g:'科技',items:[
    ['少数派','https://sspai.com/feed'],
    ['爱范儿','https://www.ifanr.com/feed'],
    ['36氪','https://36kr.com/feed'],
    ['Solidot','https://www.solidot.org/index.rss'],
    ['Hacker News','https://news.ycombinator.com/rss'],
    ['The Verge','https://www.theverge.com/rss/index.xml'],
    ['阮一峰周刊','https://www.ruanyifeng.com/blog/atom.xml'],
  ]},
  {g:'科学',items:[
    ['Nature','https://www.nature.com/nature.rss'],
    ['ScienceDaily','https://www.sciencedaily.com/rss/all.xml'],
    ['NASA','https://www.nasa.gov/feed/'],
  ]},
  {g:'体育 · 生活',items:[
    ['BBC Sport','https://feeds.bbci.co.uk/sport/rss.xml'],
    ['ESPN','https://www.espn.com/espn/rss/news'],
    ['知乎每日精选','https://www.zhihu.com/rss'],
    ['The New Yorker','https://www.newyorker.com/feed/everything'],
  ]},
];
function qpRenderPresets(){
  const box=document.getElementById('qp-rss-pre');if(!box||box.dataset.done)return;
  box.dataset.done='1';
  box.innerHTML=QP_RSS_PRESETS.map(sec=>
    '<div class="qp-grp">'+esc(sec.g)+'</div><div class="qp-rss-grid">'+
    sec.items.map(([name,url])=>'<label title="'+esc(url)+'"><input type="checkbox" data-rssp="'+esc(url)+'" onchange="qpSave()"> '+esc(name)+'</label>').join('')+
    '</div>').join('');
}

// ── 习惯打卡：每天到点提醒，月历热力图 + 目标进度条 + 晚间小结，达标授奖牌 ──
let _qhHeat=null,_qhMonthOff=0;
async function qhabitLoad(){
  const box=document.getElementById('qhabit-list');if(!box)return;
  let rows=[];
  try{rows=((await (await fetch('/api/quill/habits')).json()).habits)||[];}catch(e){}
  try{_qhHeat=await (await fetch('/api/quill/habits/heat')).json();}catch(e){_qhHeat=null;}
  if(!rows.length){
    box.innerHTML='<span style="color:var(--ink-faint)">还没有——点「＋新增」，或直接对 Quill 说"帮我建个早起打卡的习惯"</span>';
    return;
  }
  const doneN=rows.filter(h=>h.today).length;
  const dg=localStorage.getItem('qh_digest');
  const dgVal=dg===null?'21:30':dg;   // 留空＝关闭晚间小结
  let html='<div class="qh-sum"><b>今天 '+doneN+'/'+rows.length+'</b><span style="flex:1"></span>晚间小结'+
    '<input type="time" id="qh-digest" value="'+dgVal+'" title="到点提醒今天还差哪些没打卡，清空＝关闭" onchange="localStorage.setItem(\'qh_digest\',this.value)"></div>'+
    qhabitHeatHTML();
  html+=rows.map(h=>{
    const dots='<span class="qh-dots">'+h.last14.map(v=>'<i class="'+(v?'on':'')+'"></i>').join('')+'</span>';
    const fire=h.streak>0?'<span class="qh-fire">'+_FLAME_ICON+h.streak+'</span>':'';
    const medal=h.medal?'<span title="已达成 '+h.goal+' 天目标">🏅</span>':'';
    const pct=Math.min(100,Math.round(h.streak/(h.goal||21)*100));
    const bar='<div class="qh-bar'+(h.medal?' medal':'')+'" title="向奖牌推进 '+pct+'%"><i style="width:'+pct+'%"></i></div>';
    const btn=h.today?'<button class="qh-btn done" disabled>今日已打卡</button>'
                     :'<button class="qh-btn" onclick="qhabitCheck('+h.id+')">打卡</button>';
    return '<div class="qh-row"><div style="flex:1;min-width:0"><div class="qh-name">'+esc(h.name)+' '+medal+fire+'</div>'+
           dots+bar+'<div class="qh-goal">'+(h.remind_time?('每天 '+esc(h.remind_time)+' 提醒 · '):'')+'目标 '+h.goal+' 天 · 累计 '+h.total+' 天</div></div>'+
           btn+'<span class="qh-edit" onclick="qhabitEdit('+h.id+',\''+esc(h.name).replace(/'/g,"\\'")+'\',\''+esc(h.remind_time||'')+'\','+h.goal+')">改</span>'+
           '<span class="qh-x" onclick="qhabitDel('+h.id+',\''+esc(h.name).replace(/'/g,"\\'")+'\')">×</span></div>';
  }).join('');
  box.innerHTML=html;
}
function qhabitHeatHTML(){
  const now=new Date();
  const base=new Date(now.getFullYear(),now.getMonth()+_qhMonthOff,1);
  const y=base.getFullYear(),m=base.getMonth();
  const first=new Date(y,m,1).getDay();               // 周日开头，和常见打卡日历一致
  const dim=new Date(y,m+1,0).getDate();
  const days=(_qhHeat&&_qhHeat.days)||{};
  const total=(_qhHeat&&_qhHeat.habits)||0;
  const tISO=qpToday();
  let cells='<b>日</b><b>一</b><b>二</b><b>三</b><b>四</b><b>五</b><b>六</b>';
  for(let i=0;i<first;i++)cells+='<i class="qhm-cell" style="visibility:hidden"></i>';
  for(let d=1;d<=dim;d++){
    const iso=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const n=days[iso]||0;
    let cls='qhm-cell';
    if(iso>tISO)cls+=' off';
    else if(n)cls+=' h'+Math.min(3,n);
    if(total&&n>=total&&total>0)cls+=' full';          // 当天所有习惯都打了 → 打勾
    if(iso===tISO)cls+=' today';
    cells+='<i class="'+cls+'" title="'+iso+' · 打卡 '+n+' 次"></i>';
  }
  return '<div class="qhm" id="qhm-wrap">'+
    '<div class="qhm-top"><span class="qhm-nav" onclick="qhabitMonth(-1)">‹</span><b>'+y+'年'+(m+1)+'月</b>'+
    (_qhMonthOff<0?'<span class="qhm-nav" onclick="qhabitMonth(1)">›</span>':'<span style="width:8px"></span>')+
    '<span style="flex:1"></span><span>打过卡的日子会亮</span></div>'+
    '<div class="qhm-grid">'+cells+'</div></div>';
}
function qhabitMonth(d){
  _qhMonthOff=Math.min(0,Math.max(-4,_qhMonthOff+d));
  const w=document.getElementById('qhm-wrap');
  if(w)w.outerHTML=qhabitHeatHTML();
}
async function qhabitAdd(){
  const name=(prompt('习惯名（比如：早起 / 背单词 / 运动）')||'').trim();if(!name)return;
  let t=(prompt('每天几点提醒？格式 HH:MM，留空＝不提醒','08:00')||'').trim();
  if(t&&!/^\d{1,2}:\d{2}$/.test(t)){toast('时间格式不对，先不设提醒了');t='';}
  if(t)t=t.split(':').map(x=>x.padStart(2,'0')).join(':');
  const goal=parseInt(prompt('目标连续多少天？（达成给奖牌）','21')||'21')||21;
  const r=await (await fetch('/api/quill/habits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,remind_time:t,goal})})).json();
  if(r.error){toast(r.error);return;}
  if(t&&('Notification' in window)&&Notification.permission==='default')Notification.requestPermission();
  qhabitLoad();
}
async function qhabitCheck(hid){
  const r=await (await fetch('/api/quill/habits/'+hid+'/checkin',{method:'POST'})).json();
  if(r.error){toast(r.error);return;}
  qhabitLoad();
  if(r.reached_goal){showMedal(r.name,r.goal);}
  else{toast('已打卡 · 连续 '+r.streak+' 天');qMood('win');}
}
function showMedal(name,goal){
  const box=document.getElementById('qmedal');if(!box)return;
  const t=box.querySelector('.qm-title');if(t)t.textContent='「'+name+'」达成 '+goal+' 天！';
  const s=box.querySelector('.qm-sub');if(s)s.textContent='连续 '+goal+' 天没断过，这枚奖牌是你自己挣来的';
  box.style.display='block';
  qdConfetti();qMood('shy');
}
async function qhabitDel(hid,name){
  if(!confirm('删除习惯「'+name+'」和它的打卡记录？'))return;
  await fetch('/api/quill/habits/'+hid,{method:'DELETE'});qhabitLoad();
}
async function qhabitEdit(hid,name,time,goal){
  const n=(prompt('习惯名',name)||'').trim();if(!n)return;
  let t=(prompt('每天几点提醒？留空＝不提醒',time)||'').trim();
  if(t&&!/^\d{1,2}:\d{2}$/.test(t)){toast('时间格式不对，已清空提醒');t='';}
  if(t)t=t.split(':').map(x=>x.padStart(2,'0')).join(':');
  const g=parseInt(prompt('目标连续天数',String(goal))||String(goal))||goal;
  await fetch('/api/quill/habits/'+hid,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,remind_time:t,goal:g})});
  qhabitLoad();
}
async function qhabitTick(){
  const now=new Date();
  const hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  try{
    const r=await (await fetch('/api/quill/habits')).json();
    const habits=r.habits||[];
    habits.forEach(h=>{
      if(!h.remind_time||h.today||h.remind_time!==hm)return;
      const k='qh_rem_'+h.id;
      if(localStorage.getItem(k)===qpToday())return;
      localStorage.setItem(k,qpToday());
      const body=h.name+(h.streak?('（已连续 '+h.streak+' 天，别断在今天）'):'（今天开始记第一天）');
      if(('Notification' in window)&&Notification.permission==='granted'){
        const n=new Notification('Quill · 习惯打卡',{body});
        n.onclick=()=>{window.focus();openQuill&&openQuill();};
      }else toast('习惯打卡：'+body);
    });
    // 晚间小结：到点把"今天还差哪些"合成一条说完，不逐个轰炸
    const dg=localStorage.getItem('qh_digest');
    const dTime=dg===null?'21:30':dg;
    if(habits.length&&dTime&&hm===dTime&&localStorage.getItem('qh_digest_done')!==qpToday()){
      localStorage.setItem('qh_digest_done',qpToday());
      const miss=habits.filter(h=>!h.today);
      if(miss.length){
        const tails=['现在补上还来得及，别让今天的努力留白','就差一点点，补完睡觉才踏实','火苗还等着续上呢','打完卡，今天就圆满了'];
        const names=miss.slice(0,4).map(h=>h.name+(h.remind_time?'('+h.remind_time+')':'')).join('、')+(miss.length>4?'…':'');
        const body='今天 '+(habits.length-miss.length)+'/'+habits.length+'，还差：'+names+' · '+tails[now.getDate()%tails.length];
        if(('Notification' in window)&&Notification.permission==='granted'){
          const n=new Notification('Quill · 习惯小结',{body});
          n.onclick=()=>{window.focus();openQuill&&openQuill();};
        }else toast('习惯小结：'+body);
      }
    }
  }catch(e){}
}

// v4.1 启动：入口佩饰（连读火苗 + 节气），每 30 分钟静默刷新
setTimeout(loadFabBadges,1200);
setInterval(loadFabBadges,30*60000);

// ═══════════════ v4.2.0 · 节气卡（海报式，随播报送达 / 点节气徽章打开） ═══════════════
const QTERM_PHRASES={
  '立春':'东风解冻 草木萌动','雨水':'润物无声 枯木待发','惊蛰':'春雷乍响 万物苏醒','春分':'昼夜平分 春色正中',
  '清明':'天清气明 万物洁净','谷雨':'雨生百谷 春去夏至','立夏':'万物并秀 蝼蝈始鸣','小满':'物至于此 小得盈满',
  '芒种':'有芒之谷 可种可收','夏至':'一阴始生 日长之至','小暑':'温风忽至 蟋蟀居壁','大暑':'腐草为萤 土润溽暑',
  '立秋':'凉风有信 一叶知秋','处暑':'暑气渐止 秋意初生','白露':'露凝而白 秋意渐浓','秋分':'昼夜均长 寒暑平分',
  '寒露':'露气寒冷 将凝结也','霜降':'气肃而凝 露结为霜','立冬':'水始冰兮 地始冻兮','小雪':'虹藏不见 天气上升',
  '大雪':'鹖鴠不鸣 天地积阴','冬至':'一阳复始 日短之至','小寒':'雁北乡兮 鹊始巢兮','大寒':'寒气之极 阳气潜伏'};
// 11 套大纹样（海报风线稿 + 轻动效；全部内联样式，主题换肤不影响）
const QTERM_ART={
rain:'<svg viewBox="0 0 140 170"><g style="fill:#dfe7ee;stroke:#93a9c2;stroke-width:2;stroke-linejoin:round"><path d="M42 62a20 20 0 0 1 3-39.6A23 23 0 0 1 89 27a16.5 16.5 0 0 1-2 34.6Z"/></g>'+
 [0,1,2,3].map(i=>'<path d="M0 0C4.5 6 4.5 11 0 14C-4.5 11 -4.5 6 0 0Z" style="fill:#c3d4e4;stroke:#8fa9c9;stroke-width:1.6;animation:qtDrop 2s '+(i*0.5)+'s ease-in infinite" transform="translate('+(38+i*20)+',78)"/>').join('')+'</svg>',
bud:'<svg viewBox="0 0 140 170"><path d="M30 148h80" style="stroke:#c9bfa8;stroke-width:2;stroke-linecap:round"/><path d="M70 148V70" style="fill:none;stroke:#7fae7a;stroke-width:3;stroke-linecap:round"/>'+
 '<g style="transform-origin:70px 108px;animation:qtSway 3.2s ease-in-out infinite"><path d="M70 108C70 108 40 106 37 78C64 81 70 108 70 108Z" style="fill:#cfe4c8;stroke:#7fae7a;stroke-width:2;stroke-linejoin:round"/></g>'+
 '<g style="transform-origin:70px 92px;animation:qtSway 3.2s .6s ease-in-out infinite"><path d="M70 92C70 92 98 90 101 64C76 67 70 92 70 92Z" style="fill:#cfe4c8;stroke:#7fae7a;stroke-width:2;stroke-linejoin:round"/></g>'+
 '<ellipse cx="70" cy="62" rx="7" ry="10" style="fill:#a9c98f;stroke:#6d9a59;stroke-width:2;transform-origin:70px 66px;animation:qtPulse 2.6s ease-in-out infinite"/></svg>',
blossom:'<svg viewBox="0 0 140 170"><g style="transform-origin:70px 82px;animation:qtBreathe 3.6s ease-in-out infinite">'+
 [0,72,144,216,288].map(a=>'<path d="M70 82C77 66 77 52 70 44C63 52 63 66 70 82Z" style="fill:#f6cdd8;stroke:#d98ba1;stroke-width:2;stroke-linejoin:round" transform="rotate('+a+' 70 82)"/>').join('')+
 '<circle cx="70" cy="82" r="7.5" style="fill:#eec257;stroke:#c99b2e;stroke-width:1.6"/></g>'+
 '<path d="M0 0C5 1 8 5 7 10C2 9 -1 5 0 0Z" style="fill:#f6cdd8;stroke:#d98ba1;stroke-width:1.4;animation:qtPetal 4.2s .8s ease-in infinite" transform="translate(96,96)"/>'+
 '<path d="M0 0C5 1 8 5 7 10C2 9 -1 5 0 0Z" style="fill:#fbe3ea;stroke:#d98ba1;stroke-width:1.2;animation:qtPetal 5s 2.4s ease-in infinite" transform="translate(60,100)"/></svg>',
lotus:'<svg viewBox="0 0 140 170"><g style="animation:qtBob 3.4s ease-in-out infinite">'+
 '<path d="M70 96C79 82 79 62 70 48C61 62 61 82 70 96Z" style="fill:#f4c7d3;stroke:#cf7d95;stroke-width:2;stroke-linejoin:round"/>'+
 '<path d="M42 92C55 92 65 84 68 70C54 70 44 78 42 92Z" style="fill:#f4c7d3;stroke:#cf7d95;stroke-width:2;stroke-linejoin:round"/>'+
 '<path d="M98 92C85 92 75 84 72 70C86 70 96 78 98 92Z" style="fill:#f4c7d3;stroke:#cf7d95;stroke-width:2;stroke-linejoin:round"/></g>'+
 '<path d="M26 116C50 128 90 128 114 116" style="fill:none;stroke:#8fbc8f;stroke-width:2.4;stroke-linecap:round"/>'+
 '<path d="M36 130C56 138 84 138 104 130" style="fill:none;stroke:#a9c9a9;stroke-width:2;stroke-linecap:round;animation:qtShimmer 3s ease-in-out infinite"/></svg>',
wheat:['-16,6,0','0,0,.5','16,4,1'].map(s=>{const[dx,dy,dl]=s.split(',');
 return '<g style="transform-origin:'+(70+ +dx)+'px 150px;animation:qtSway 2.8s '+dl+'s ease-in-out infinite" transform="translate('+dx+','+dy+')">'+
 '<path d="M70 150V56" style="fill:none;stroke:#c9a24b;stroke-width:2.6;stroke-linecap:round"/>'+
 [0,1,2,3].map(i=>'<path d="M70 '+(60+i*13)+'C58 '+(57+i*13)+' 52 '+(49+i*13)+' 51 '+(38+i*13)+'C63 '+(41+i*13)+' 70 '+(48+i*13)+' 70 '+(60+i*13)+'Z M70 '+(60+i*13)+'C82 '+(57+i*13)+' 88 '+(49+i*13)+' 89 '+(38+i*13)+'C77 '+(41+i*13)+' 70 '+(48+i*13)+' 70 '+(60+i*13)+'Z" style="fill:#f2dfb0;stroke:#c9a24b;stroke-width:1.7;stroke-linejoin:round"/>').join('')+'</g>';}).join(''),
fan:'<svg viewBox="0 0 140 170"><g style="transform-origin:70px 148px;animation:qtRock 3s ease-in-out infinite">'+
 '<ellipse cx="70" cy="72" rx="42" ry="38" style="fill:#f6e2c8;stroke:#c98a5f;stroke-width:2.4"/>'+
 '<path d="M70 34V108" style="stroke:#c98a5f;stroke-width:1.4;opacity:.55"/><path d="M36 50C50 66 90 66 104 50" style="fill:none;stroke:#c98a5f;stroke-width:1.4;opacity:.55"/><path d="M33 82C52 74 88 74 107 82" style="fill:none;stroke:#c98a5f;stroke-width:1.4;opacity:.55"/>'+
 '<path d="M70 110V150" style="stroke:#a56b42;stroke-width:4;stroke-linecap:round"/></g></svg>',
leaf:'<svg viewBox="0 0 140 170"><g style="transform-origin:70px 80px;animation:qtSway 4s ease-in-out infinite">'+
 '<path d="M104 30C106 78 82 112 40 116C30 92 34 58 66 42C84 33 96 30 104 30Z" style="fill:#f0c896;stroke:#c07f45;stroke-width:2.2;stroke-linejoin:round"/>'+
 '<path d="M32 132C54 108 80 82 100 46" style="fill:none;stroke:#c07f45;stroke-width:1.7;stroke-linecap:round"/>'+
 '<path d="M58 96C66 96 72 92 76 84M72 74C79 74 84 70 87 63" style="fill:none;stroke:#c07f45;stroke-width:1.3;opacity:.7"/></g>'+
 '<path d="M0 0C8 2 11 8 9 15C2 13 -2 7 0 0Z" style="fill:#e8b57a;stroke:#c07f45;stroke-width:1.4;animation:qtLeafFall 5s 1s ease-in infinite" transform="translate(104,44)"/></svg>',
dew:'<svg viewBox="0 0 140 170"><path d="M46 34C58 26 82 26 94 34" style="fill:none;stroke:#8fbc8f;stroke-width:2.4;stroke-linecap:round"/>'+
 '<path d="M70 35v4" style="stroke:#79aab4;stroke-width:2;stroke-linecap:round"/>'+
 '<path d="M0 0C3.6 4.6 3.6 8.4 0 11C-3.6 8.4 -3.6 4.6 0 0Z" style="fill:#cfe6ea;stroke:#79aab4;stroke-width:1.5;animation:qtDrip 2.6s ease-in infinite" transform="translate(70,42)"/>'+
 '<path d="M70 92C86 112 94 127 94 140A24 24 0 0 1 46 140C46 127 54 112 70 92Z" style="fill:#dcecef;stroke:#79aab4;stroke-width:2.4;stroke-linejoin:round"/>'+
 '<path d="M58 138A12 12 0 0 0 65 148" style="fill:none;stroke:#79aab4;stroke-width:2;stroke-linecap:round;animation:qtGlisten 2.4s ease-in-out infinite"/></svg>',
frost:'<svg viewBox="0 0 140 170"><g style="transform-origin:70px 88px;animation:qtRotSlow 70s linear infinite">'+
 [0,60,120].map((a,i)=>'<g transform="rotate('+a+' 70 88)" style="animation:qtShimmer 3s '+(i*0.55)+'s ease-in-out infinite"><path d="M70 26v124M70 40l-9 9M70 40l9 9M70 136l-9-9M70 136l9-9M70 66l-6 6M70 66l6 6M70 110l-6-6M70 110l6-6" style="fill:none;stroke:#93b7d1;stroke-width:2.2;stroke-linecap:round"/></g>').join('')+
 '<circle cx="70" cy="88" r="3.5" style="fill:#dce9f6;stroke:#93b7d1;stroke-width:1.5"/></g></svg>',
snow:'<svg viewBox="0 0 140 170"><g style="transform-origin:70px 88px;animation:qtRotSlow 32s linear infinite">'+
 [0,60,120].map(a=>'<g transform="rotate('+a+' 70 88)"><path d="M70 30v116M70 44l-10 10M70 44l10 10M70 132l-10-10M70 132l10-10M70 70l-7 7M70 70l7 7M70 106l-7-7M70 106l7-7" style="fill:none;stroke:#8fb3d9;stroke-width:2.4;stroke-linecap:round"/></g>').join('')+
 '<circle cx="70" cy="88" r="4" style="fill:#dce9f6;stroke:#8fb3d9;stroke-width:1.6"/></g>'+
 '<circle r="3" style="fill:#c7dbef;animation:qtSnowFall 4.6s ease-in infinite" transform="translate(30,26)"/>'+
 '<circle r="2.3" style="fill:#d9e7f4;animation:qtSnowFall 6s 1.6s ease-in infinite" transform="translate(112,20)"/></svg>',
plum:'<svg viewBox="0 0 140 170"><path d="M24 150C52 128 76 100 100 46" style="fill:none;stroke:#8a6f5a;stroke-width:3;stroke-linecap:round"/>'+
 '<path d="M66 108C80 110 92 104 100 92" style="fill:none;stroke:#8a6f5a;stroke-width:2.2;stroke-linecap:round"/>'+
 [['104','40','9','qtPulse 3s'],['112','92','7',''],['58','116','6.5','qtPulse 3s 1.2s']].map(b=>{const[cx,cy,r,an]=b;
 return '<g'+(an?' style="transform-origin:'+cx+'px '+cy+'px;animation:'+an+' ease-in-out infinite"':'')+'>'+
 [0,72,144,216,288].map(a=>'<circle cx="'+cx+'" cy="'+(+cy-+r*0.62)+'" r="'+(+r*0.56)+'" style="fill:#e8a7b8;stroke:#c9788f;stroke-width:1.3" transform="rotate('+a+' '+cx+' '+cy+')"/>').join('')+
 '<circle cx="'+cx+'" cy="'+cy+'" r="'+(+r*0.34)+'" style="fill:#f2e3b8;stroke:#c9788f;stroke-width:1"/></g>';}).join('')+
 '<circle cx="84" cy="102" r="2.6" style="fill:#d98ba1"/><circle cx="44" cy="132" r="2.2" style="fill:#d98ba1"/>'+
 '<path d="M0 0C4 1 6 4 5 8C1 7 -1 4 0 0Z" style="fill:#f2c7d2;stroke:#c9788f;stroke-width:1.1;animation:qtPetal 4.6s 1.4s ease-in infinite" transform="translate(100,54)"/></svg>'};
QTERM_ART.wheat='<svg viewBox="0 0 140 170">'+QTERM_ART.wheat+'</svg>';
let _qtTimer=null;
async function showTermCard(auto){
  if(!_fabBadges.season){try{_fabBadges.season=await (await fetch('/api/quill/season')).json();}catch(e){return;}}
  const s=_fabBadges.season;if(!s||!s.term)return;
  const box=document.getElementById('qterm');if(!box)return;
  // v4.4：优先用 24 张节气专属图（62_term_art.js），旧 11 套纹样留作兜底
  const art24=(typeof QTERM_ART24!=='undefined')?QTERM_ART24[s.term]:null;
  document.getElementById('qt-art').innerHTML=art24||QTERM_ART[s.motif]||QTERM_ART.leaf;
  document.getElementById('qt-name').innerHTML=[...s.term].map((c,i)=>'<i style="animation-delay:'+(0.15+i*0.13)+'s">'+c+(i===s.term.length-1?'<span class="qt-seal"></span>':'')+'</i>').join('');
  document.getElementById('qt-phrase').textContent=QTERM_PHRASES[s.term]||'';
  document.getElementById('qt-meta').textContent=(s.date?s.date+' · ':'')+'THE 24 SOLAR TERMS';
  document.getElementById('qt-fest').textContent=s.festival?('今日 · '+s.festival):(s.is_term_day?'今日交节':'');
  box.style.display='block';requestAnimationFrame(()=>box.classList.add('on'));
  if(_qtTimer){clearTimeout(_qtTimer);_qtTimer=null;}
  if(auto)_qtTimer=setTimeout(qtClose,8000);
}
function qtClose(){
  const box=document.getElementById('qterm');if(!box)return;
  if(_qtTimer){clearTimeout(_qtTimer);_qtTimer=null;}
  box.classList.remove('on');setTimeout(()=>box.style.display='none',320);
}
function maybeShowTermCard(){
  if(!seasonBadgeOn())return;
  const t=qpToday();
  if(localStorage.getItem('qterm_day')===t)return;
  localStorage.setItem('qterm_day',t);
  if(document.hidden)return;
  showTermCard(true);
}

