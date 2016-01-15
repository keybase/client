/* @flow */
import engine from '../engine'
import {log} from './log/logui'

import type {Text as KBText, LogLevel} from '../constants/types/flow-types'

export default function ListenLogUi () {
  engine.listenOnConnect('ListenLogUi', () => {
    engine.listenGeneralIncomingRpc('keybase.1.logUi.log', (params: {text: KBText, level: LogLevel}, response: any) => {
      log(params, response)
    })
    console.log('Registered Listener for logUi.log')
  })
}
