import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import TeamRow from './team-row'

const ids = ['1', '2', '3']
const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams = {
    ...draftState.teams,
    teamMeta: new Map([
      ['1', Constants.makeTeamMeta({memberCount: 32, teamname: 'keybase_storybook'})],
      ['2', Constants.makeTeamMeta({isOpen: true, memberCount: 11947, teamname: 'fan_club'})],
      ['3', Constants.makeTeamMeta({isOpen: false, memberCount: 234, teamname: 'club_penguin'})],
    ]),
  }
})

const load = () =>
  Sb.storiesOf('Teams', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Team rows', () => (
      <>
        {ids.map((id, index) => (
          <TeamRow key={id} teamID={id} firstItem={index === 0} showChat={index !== 2} />
        ))}
      </>
    ))

export default load
