import engine from '../engine'

import type {Text} from '../constants/types/flow-types'

export default function ListenLogUi () {
  engine.listenOnConnect(() => {
    engine.listenGeneralIncomingRpc('keybase.1.logUi.log', (params: {text: Text}) => {
      console.log('keybase.1.logUi.log:', params.text.data)
    })
    console.log('Registered Listener for logUi.log')
  })
}
