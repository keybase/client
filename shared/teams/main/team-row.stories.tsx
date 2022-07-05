import * as React from 'react'
import * as Sb from '../../stories/storybook'
import TeamRow from './team-row'
import {fakeTeamIDs, store} from '../stories'

const load = () =>
  Sb.storiesOf('Teams', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Team rows', () => (
      <>
        {fakeTeamIDs.map((id, index) => (
          <TeamRow key={id} teamID={id} firstItem={index === 0} showChat={index !== 2} />
        ))}
      </>
    ))

export default load
