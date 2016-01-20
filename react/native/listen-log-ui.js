import engine from '../engine'
import {logUiLog} from '../actions/notifications'

export default function ListenLogUi () {
  engine.listenOnConnect('ListenLogUi', () => {
    engine.listenGeneralIncomingRpc('keybase.1.logUi.log', (params: {text: Text, level: LogLevel}) => {
      logUiLog(params)
    })
    console.log('Registered Listener for logUi.log')
  })
}
