import {makeMessageWrapper} from '../wrapper/wrapper'
import SystemUsersAddedToConv from './container'

export default makeMessageWrapper('systemUsersAddedToConversation', message => {
  return <SystemUsersAddedToConv message={message} />
})
