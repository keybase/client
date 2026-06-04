import {makeMessageWrapper} from '../wrapper/wrapper'
import type PinType from '.'

export default makeMessageWrapper('pin', message => {
  const {default: PinComponent} = require('.') as {default: typeof PinType}
  return <PinComponent messageID={message.pinnedMessageID} />
})
