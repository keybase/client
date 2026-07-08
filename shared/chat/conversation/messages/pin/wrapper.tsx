import {makeMessageWrapper} from '../wrapper/wrapper'
import PinComponent from '.'

export default makeMessageWrapper('pin', message => {
  return <PinComponent messageID={message.pinnedMessageID} />
})
