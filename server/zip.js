// A minimal ZIP writer for the download of the handwriting samples: files are written one after the other to
// a stream (the response), so a large package never sits in memory as a whole. Entries are stored without
// compression (the PNGs are compressed already); names are UTF-8. No ZIP64: the caller keeps a package below
// 65 535 files and 4 GB.
import { crc32 } from 'node:zlib';

/** DOS date and time of a Date (ZIP has no time zone) */
function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export class ZipWriter {
  /** @param {(chunk: Buffer) => void} write */
  constructor(write) {
    this.write = write;
    this.offset = 0;
    this.central = [];
  }

  /** @param {string} name @param {Buffer} data @param {Date} [when] */
  add(name, data, when = new Date()) {
    if (this.central.length >= 65_535) throw new Error('too many files for a ZIP without ZIP64');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const { time, date } = dosTime(when);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // made by
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(this.offset, 42);
    this.central.push(Buffer.concat([cd, nameBuf]));
    this.write(Buffer.concat([local, nameBuf]));
    this.write(data);
    this.offset += local.length + nameBuf.length + data.length;
  }

  end() {
    const dir = Buffer.concat(this.central);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(this.central.length, 8);
    eocd.writeUInt16LE(this.central.length, 10);
    eocd.writeUInt32LE(dir.length, 12);
    eocd.writeUInt32LE(this.offset, 16);
    this.write(dir);
    this.write(eocd);
  }
}
