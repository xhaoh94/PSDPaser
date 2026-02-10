import type { SpriteInfo } from './types';

// Regular expressions for Unity .meta files
const GUID_REGEX = /guid:\s*([a-f0-9]{32})/i;
const BORDER_REGEX = /spriteBorder:\s*{x:\s*([\d\.-]+),\s*y:\s*([\d\.-]+),\s*z:\s*([\d\.-]+),\s*w:\s*([\d\.-]+)}/i;

export async function parseMetaFile(content: string): Promise<{ guid: string; border?: [number, number, number, number] } | null> {
  const guidMatch = content.match(GUID_REGEX);
  if (!guidMatch) return null;

  const guid = guidMatch[1];
  let border: [number, number, number, number] | undefined;

  const borderMatch = content.match(BORDER_REGEX);
  if (borderMatch) {
    // Unity: x=Left, y=Bottom, z=Right, w=Top
    border = [
      parseFloat(borderMatch[1]), // Left
      parseFloat(borderMatch[2]), // Bottom
      parseFloat(borderMatch[3]), // Right
      parseFloat(borderMatch[4])  // Top
    ];
  }

  return { guid, border };
}

export async function scanSpriteDirectory(dirHandle: FileSystemDirectoryHandle): Promise<Map<string, SpriteInfo>> {
  const map = new Map<string, SpriteInfo>();

  async function traverse(handle: FileSystemDirectoryHandle) {
    try {
      // @ts-ignore - FileSystemDirectoryHandle is async iterable in modern browsers
      for await (const entry of handle.values()) {
        try {
          if (entry.kind === 'directory') {
            await traverse(entry as FileSystemDirectoryHandle);
          } else if (entry.kind === 'file') {
            const fileEntry = entry as FileSystemFileHandle;
            const name = fileEntry.name;
            
            if (/\.(png|jpg|jpeg)$/i.test(name)) {
              // Found an image. Look for .meta
              const metaName = `${name}.meta`;
              let metaHandle: FileSystemFileHandle | undefined;
              
              try {
                metaHandle = await handle.getFileHandle(metaName);
              } catch {
                // Meta file not found
                continue;
              }

              if (metaHandle) {
                try {
                  const metaFile = await metaHandle.getFile();
                  const metaContent = await metaFile.text();
                  const metaData = await parseMetaFile(metaContent);

                  if (metaData) {
                    const spriteName = name.substring(0, name.lastIndexOf('.'));
                    // Key: name without extension
                    // 如果已经存在，保留第一个（主目录优先级高于公共路径）
                    if (!map.has(spriteName)) {
                      map.set(spriteName, {
                        name: spriteName,
                        guid: metaData.guid,
                        fileID: '21300000', // Standard Sprite FileID
                        border: metaData.border,
                        handle: fileEntry,
                        metaHandle: metaHandle
                      });
                    }
                  }
                } catch (e) {
                  console.error(`Failed to parse meta for ${name}`, e);
                }
              }
            }
          }
        } catch (innerErr) {
          console.warn(`[UGUI] Failed to access entry in ${handle.name}:`, innerErr);
        }
      }
    } catch (err) {
      console.warn(`[UGUI] Failed to traverse directory ${handle.name}:`, err);
    }
  }

  await traverse(dirHandle);
  return map;
}

// 扫描多个目录，合并结果（主目录优先级最高）
export async function scanMultipleSpriteDirectories(
  primaryDir: FileSystemDirectoryHandle,
  commonPaths: FileSystemDirectoryHandle[]
): Promise<Map<string, SpriteInfo>> {
  // 先扫描公共路径（低优先级）
  const commonMap = new Map<string, SpriteInfo>();
  for (const commonDir of commonPaths) {
    const dirMap = await scanSpriteDirectory(commonDir);
    // 合并到 commonMap
    for (const [key, value] of dirMap) {
      if (!commonMap.has(key)) {
        commonMap.set(key, value);
      }
    }
  }
  
  // 再扫描主目录（高优先级，会覆盖公共路径中的同名资源）
  const primaryMap = await scanSpriteDirectory(primaryDir);
  
  // 合并：主目录优先
  const finalMap = new Map(commonMap);
  for (const [key, value] of primaryMap) {
    finalMap.set(key, value);
  }
  
  console.log(`[SpriteResolver] Scanned ${primaryMap.size} sprites from primary dir, ${commonMap.size} from common paths. Total: ${finalMap.size}`);
  
  return finalMap;
}
