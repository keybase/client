import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemUsersAddedToConvType from './container'

export default makeMessageWrapper('systemUsersAddedToConversation', message => {
  const {default: SystemUsersAddedToConv} = require('./container') as {default: typeof SystemUsersAddedToConvType}
  return <SystemUsersAddedToConv message={message} />
})
