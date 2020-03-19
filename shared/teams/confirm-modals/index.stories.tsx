import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import ConfirmKickOut from './confirm-kick-out'
import DeleteChannel from './delete-channel'
import {store, fakeTeamID} from '../stories'
import reallyLeaveTeam from './really-leave-team/index.stories'

const storeWithSelection = Container.produce(store, draftState => {
  draftState.teams.teamSelectedChannels = new Map([[fakeTeamID, new Set(['1', '2'])]])
})

const load = () => {
  reallyLeaveTeam()
  Sb.storiesOf('Teams/Confirm modals', module)
    .addDecorator((story: any) => <Sb.MockStore store={storeWithSelection}>{story()}</Sb.MockStore>)
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
    .add('Delete channel', () => (
      <DeleteChannel
        {...Sb.createNavigator({
          teamID: fakeTeamID,
        })}
      />
    ))
}

export default load
