import {makeMessageWrapper} from '../wrapper/wrapper'
import type SetChannelnameType from './container'

export default makeMessageWrapper('setChannelname', message => {
  if (message.newChannelname === 'general') return null
  const {default: SetChannelnameComponent} = require('./container') as {default: typeof SetChannelnameType}
  return <SetChannelnameComponent message={message} />
})
