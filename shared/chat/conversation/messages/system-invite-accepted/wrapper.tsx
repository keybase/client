import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemInviteAcceptedType from './container'

export default makeMessageWrapper('systemInviteAccepted', message => {
  const {default: SystemInviteAccepted} = require('./container') as {default: typeof SystemInviteAcceptedType}
  return <SystemInviteAccepted key="systemInviteAccepted" message={message} />
})
