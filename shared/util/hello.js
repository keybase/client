// @flow
// Send helloIAm message to service

import engine from '../engine'
import {commonClientType, configHelloIAmRpcPromise} from '../constants/types/flow-types'

export default function(
  pid: number,
  desc: string,
  argv: Array<string>,
  version: string,
  isMain: boolean
): Promise<void> {
  const details = {
    pid,
    desc,
    version,
    argv: argv,
    clientType: isMain ? commonClientType.guiMain : commonClientType.guiHelper,
  }

  return new Promise((resolve, reject) => {
    engine().listenOnConnect('hello', () => {
      configHelloIAmRpcPromise({
        param: {details},
      })
        .then(reps => {
          resolve()
        })
        .catch(err => {
          console.warn('error in helloIAm', err)
          reject(err)
        })
    })
  })
}
