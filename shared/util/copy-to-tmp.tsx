import {promises as fs} from 'fs'
import os from 'os'
import path from 'path'

export default async (originalFilePath: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'keybase-copyToTmp-'))
  const dst = path.join(dir, path.basename(originalFilePath))
  await fs.copyFile(originalFilePath, dst)
  return dst
}
