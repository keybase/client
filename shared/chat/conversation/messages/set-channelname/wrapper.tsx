import {makeMessageWrapper} from '../wrapper/wrapper'
import SetChannelnameComponent from './container'

export default makeMessageWrapper('setChannelname', message => {
  if (message.newChannelname === 'general') return null
  return <SetChannelnameComponent message={message} />
})
