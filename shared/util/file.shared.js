// @flow

import pathParse from 'path-parse'

function findAvailableFilename(checkExists: string => Promise<boolean>, filepath: string): Promise<string> {
  const {name, ext, dir} = pathParse(filepath)

  return new Promise((resolve, reject) => {
    let i = 1
    function tryNextFilepath() {
      if (i > 1000) {
        throw new Error('unable to find available filename')
      }
      checkExists(filepath)
        .then(filepathExists => {
          if (!filepathExists) {
            resolve(filepath)
            return
          }

          filepath = [dir, `${name} (${i})${ext}`].join('/')
          i++
          tryNextFilepath()
        })
        .catch(reject)
    }

    tryNextFilepath()
  })
}

export {findAvailableFilename}
