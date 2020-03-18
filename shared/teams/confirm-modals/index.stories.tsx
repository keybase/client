import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ConfirmKickOut from './confirm-kick-out'
import {store, fakeTeamID} from '../stories'
import reallyLeaveTeam from './really-leave-team/index.stories'

const load = () => {
  reallyLeaveTeam()
  Sb.storiesOf('Teams/Confirm modals', module)
    .addDecorator(Sb.updateStoreDecorator(store, () => {}))
    .add('Kick out of team - single', () => (
      <ConfirmKickOut {...Sb.createNavigator({members: ['chris'], teamID: fakeTeamID})} />
    ))
    .add('Kick out of team - multiple', () => (
      <ConfirmKickOut
        {...Sb.createNavigator({
          members: ['chris', 'adamjspooner', 'ayoubd', 'chrisnojima', 'jzila', 'max'],
          teamID: fakeTeamID,
        })}
      />
    ))
}

export default load
