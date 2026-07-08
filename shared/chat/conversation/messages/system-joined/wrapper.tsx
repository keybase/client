import {makeMessageWrapper} from '../wrapper/wrapper'
import SystemJoined from './container'

export default makeMessageWrapper('systemJoined', message => {
  return <SystemJoined message={message} />
})
