import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemJoinedType from './container'

export default makeMessageWrapper('systemJoined', message => {
  const {default: SystemJoined} = require('./container') as {default: typeof SystemJoinedType}
  return <SystemJoined message={message} />
})
