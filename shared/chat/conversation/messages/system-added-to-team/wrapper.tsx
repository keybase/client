import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemAddedToTeamType from './container'

export default makeMessageWrapper('systemAddedToTeam', message => {
  const {default: SystemAddedToTeam} = require('./container') as {default: typeof SystemAddedToTeamType}
  return <SystemAddedToTeam message={message} />
})
