import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Team from '.'
import * as Container from '../../util/container'
import {store, fakeTeamID} from '../stories'
import * as Types from '../../constants/types/teams'

const teamID = fakeTeamID

const getProps = (selectedTab: Types.TabKey) =>
  Sb.createNavigator({
    initialTab: selectedTab,
    teamID,
  })

const storeWithSelection = Container.produce(store, draftState => {
  draftState.teams.teamSelectedChannels = new Map([[teamID, new Set(['1', '2'])]])
  draftState.teams.teamSelectedMembers = new Map([[teamID, new Set(['paula'])]])
})

const load = () => {
  Sb.storiesOf('Teams/Team', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Channels', () => <Team {...getProps('channels')} />)
    .add('Members', () => <Team {...getProps('members')} />)
  Sb.storiesOf('Teams/Team', module)
    .addDecorator((story: any) => <Sb.MockStore store={storeWithSelection}>{story()}</Sb.MockStore>)
    .add('Channels with selection', () => <Team {...getProps('channels')} />)
    .add('Members with selection', () => <Team {...getProps('members')} />)
}

export default load
