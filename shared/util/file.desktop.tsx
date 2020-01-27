import {findAvailableFilename} from './file.shared'
import {Encoding} from './file'

export const downloadFolder = __STORYBOOK__
  ? ''
  : KB.__process.env.XDG_DOWNLOAD_DIR || KB.__path.join(KB.__os.homedir(), 'Downloads')

export function downloadFilePathNoSearch(filename: string) {
  return KB.__path.join(downloadFolder, filename)
}

export function downloadFilePath(suffix: string) {
  return findAvailableFilename(exists, KB.__path.join(downloadFolder, suffix))
}

export function exists(filepath: string) {
  return new Promise<boolean>(resolve => {
    KB.__fs.access(filepath, KB.__fs.constants.F_OK, err => {
      resolve(!err)
    })
  })
}

export function mkdirp(target: string) {
  const initDir = KB.__path.isAbsolute(target) ? KB.__path.sep : ''
  target.split(KB.__path.sep).reduce((parentDir, childDir) => {
    const curDir = KB.__path.resolve(parentDir, childDir)
    if (!KB.__fs.existsSync(curDir)) {
      KB.__fs.mkdirSync(curDir)
    }

    return curDir
  }, initDir)
}

export function copy(from: string, to: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirp(KB.__path.dirname(to))
    KB.__fs.readFile(from, (err, data) => {
      if (err) {
        reject(err)
      } else {
        KB.__fs.writeFile(to, data, err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      }
    })
  })
}

export function unlink(filepath: string): Promise<void> {
  return new Promise(resolve => KB.__fs.unlink(filepath, () => resolve()))
}

export function writeStream(filepath: string, encoding: string, append?: boolean) {
  const ws = KB.__fs.createWriteStream(filepath, {encoding, flags: append ? 'a' : 'w'})
  return Promise.resolve({
    close: () => ws.end(),
    write: d => {
      ws.write(d)
      return Promise.resolve()
    },
  })
}

export function readFile(filepath: string, encoding: Encoding) {
  return new Promise((resolve, reject) => {
    KB.__fs.readFile(filepath, {encoding}, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}
