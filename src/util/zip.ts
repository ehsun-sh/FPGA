// A minimal ZIP writer (stored, no compression): enough to download a project folder.
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string; // path inside the archive, with '/'
  data: string | Uint8Array;
}

export function zip(entries: ZipEntry[], date = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const dosTime =
    ((date.getHours() << 11) |
      (date.getMinutes() << 5) |
      (date.getSeconds() >> 1)) &
    0xffff;
  const dosDate =
    (((date.getFullYear() - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate()) &
    0xffff;
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = typeof e.data === "string" ? enc.encode(e.data) : e.data;
    const crc = crc32(data);
    const head = (sig: number, central: boolean) => {
      const b = new DataView(new ArrayBuffer(central ? 46 : 30));
      let p = 0;
      const u32 = (v: number) => (b.setUint32(p, v >>> 0, true), (p += 4));
      const u16 = (v: number) => (b.setUint16(p, v, true), (p += 2));
      u32(sig);
      if (central) u16(20); // version made by
      u16(20); // version needed
      u16(0x0800); // UTF-8 names
      u16(0); // stored
      u16(dosTime);
      u16(dosDate);
      u32(crc);
      u32(data.length);
      u32(data.length);
      u16(name.length);
      u16(0); // extra
      if (central) {
        u16(0); // comment
        u16(0); // disk
        u16(0); // internal attributes
        u32(0); // external attributes
        u32(offset);
      }
      return new Uint8Array(b.buffer);
    };
    const local = head(0x04034b50, false);
    locals.push(local, name, data);
    centrals.push(head(0x02014b50, true), name);
    offset += local.length + name.length + data.length;
  }
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
  let p = 0;
  for (const b of parts) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}
