/* @flow */
// Send helloIAm message to service

import engine from '../engine'
import keybase from '../constants/types/keybase_v1'

import type {ClientDetails} from '../constants/types/flow-types'

export default function (pid: number, desc: string, argv: Array<string>): Promise<void> {
  const details: ClientDetails = {
    pid,
    desc,
    version: __VERSION__, // eslint-disable-line no-undef
    argv: argv,
    clientType: keybase.config.ClientType.gui
  }

  return new Promise((resolve, reject) => {
    engine.listenOnConnect('hello', () => {
      engine.rpc('config.helloIAm', {details}, {}, (err, resp) => {
        if (err != null) {
          console.error('error in helloIAm', err)
          reject(err)
        } else {
          resolve()
        }
      })
    })
  })
}
