import { inflateRawSync } from 'zlib';

export interface ZipTextEntry {
  name: string;
  content: string;
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;

export function readZipTextEntries(buffer: Buffer, extensions: string[]): ZipTextEntry[] {
  const entries: ZipTextEntry[] = [];
  const allowedExtensions = extensions.map(extension => extension.toLowerCase());
  let offset = 0;

  while (offset < buffer.length - 4) {
    const signature = buffer.readUInt32LE(offset);

    if (signature === CENTRAL_DIRECTORY_SIGNATURE) {
      break;
    }

    if (signature !== LOCAL_FILE_HEADER_SIGNATURE) {
      offset += 1;
      continue;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);
    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    const fileName = buffer.subarray(fileNameStart, fileNameEnd).toString('utf-8');
    const dataStart = fileNameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > buffer.length || fileName.endsWith('/')) {
      offset = Math.max(dataEnd, offset + 30);
      continue;
    }

    const lowerName = fileName.toLowerCase();
    const shouldRead = allowedExtensions.some(extension => lowerName.endsWith(extension));

    if (shouldRead) {
      const compressedData = buffer.subarray(dataStart, dataEnd);
      let contentBuffer: Buffer;

      if (compressionMethod === 0) {
        contentBuffer = compressedData;
      } else if (compressionMethod === 8) {
        contentBuffer = inflateRawSync(compressedData);
      } else {
        throw new Error(`Unsupported ZIP compression method ${compressionMethod} for ${fileName}`);
      }

      if (uncompressedSize > 0 && contentBuffer.length !== uncompressedSize) {
        throw new Error(`ZIP entry size mismatch for ${fileName}`);
      }

      entries.push({
        name: fileName,
        content: contentBuffer.toString('utf-8')
      });
    }

    offset = dataEnd;
  }

  return entries;
}
