import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemNewChannelType from './container'

export default makeMessageWrapper('systemNewChannel', message => {
  const {default: SystemNewChannel} = require('./container') as {default: typeof SystemNewChannelType}
  return <SystemNewChannel message={message} />
})
