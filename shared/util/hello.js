/* @flow */
// Send helloIAm message to service

import engine from '../engine'
import keybase from '../constants/types/keybase-v1'

import type {ClientDetails, config_helloIAm_rpc} from '../constants/types/flow-types'

export default function (pid: number, desc: string, argv: Array<string>, version: string): Promise<void> {
  const details: ClientDetails = {
    pid,
    desc,
    version,
    argv: argv,
    clientType: keybase.config.ClientType.gui
  }

  return new Promise((resolve, reject) => {
    engine.listenOnConnect('hello', () => {
      const params : config_helloIAm_rpc = {
        method: 'config.helloIAm',
        param: {details},
        incomingCallMap: {},
        callback: (err, resp) => {
          if (err != null) {
            console.warn('error in helloIAm', err)
            reject(err)
          } else {
            resolve()
          }
        }
      }

      engine.rpc(params)
    })
  })
}
