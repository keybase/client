/* @flow */
import engine from '../engine'
import {log} from './log/logui'

export default function ListenLogUi () {
  engine().listenOnConnect('ListenLogUi', () => {
    const params = {
      'keybase.1.logUi.log': (params, response) => {
        log(params)
        response.result()
      },
    }

    engine().listenGeneralIncomingRpc(params)
    console.log('Registered Listener for logUi.log')
  })
}
