import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemCreateTeamType from './container'

export default makeMessageWrapper('systemCreateTeam', message => {
  const {default: SystemCreateTeam} = require('./container') as {default: typeof SystemCreateTeamType}
  return <SystemCreateTeam message={message} />
})
