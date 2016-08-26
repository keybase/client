/* @flow */
// Send helloIAm message to service

import engine from '../engine'
import {Common} from '../constants/types/keybase-v1'
import {configHelloIAmRpc} from '../constants/types/flow-types'

export default function (pid: number, desc: string, argv: Array<string>, version: string): Promise<void> {
  const details = {
    pid,
    desc,
    version,
    argv: argv,
    clientType: Common.ClientType.gui,
  }

  return new Promise((resolve, reject) => {
    engine().listenOnConnect('hello', () => {
      configHelloIAmRpc({
        param: {details},
        callback: (err, resp) => {
          if (err != null) {
            console.warn('error in helloIAm', err)
            reject(err)
          } else {
            resolve()
          }
        },
      })
    })
  })
}
