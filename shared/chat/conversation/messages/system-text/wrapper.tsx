import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemTextType from './container'

export default makeMessageWrapper('systemText', message => {
  const {default: SystemText} = require('./container') as {default: typeof SystemTextType}
  return <SystemText text={message.text.stringValue()} />
})
