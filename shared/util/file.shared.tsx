import pathParse from 'path-parse'

function findAvailableFilename(
  checkExists: (arg0: string) => Promise<boolean>,
  filepath: string
): Promise<string> {
  const {name, ext, dir} = pathParse(filepath)

  return new Promise((resolve, reject) => {
    let i = 1
    let fp = filepath
    function tryNextFilepath() {
      if (i > 1000) {
        throw new Error('unable to find available filename')
      }
      checkExists(fp)
        .then(filepathExists => {
          if (!filepathExists) {
            resolve(fp)
            return
          }

          fp = [dir, `${name} (${i})${ext}`].join('/')
          i++
          tryNextFilepath()
        })
        .catch(reject)
    }

    tryNextFilepath()
  })
}

export {findAvailableFilename}
