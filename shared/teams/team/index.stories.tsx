import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Team from '.'
import * as Container from '../../util/container'
import {store, fakeTeamID} from '../stories'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import makeRows from './rows'
import {useAllChannelMetas} from '../common/channel-hooks'

const teamID = fakeTeamID
const getRows = (selectedTab: Types.TabKey) =>
  makeRows(
    Constants.getTeamMeta(store, teamID),
    Constants.getTeamDetails(store, teamID),
    selectedTab,
    store.config.username,
    Constants.getCanPerformByID(store, teamID),
    store.teams.invitesCollapsed,
    // this hook is mocked in stories and it's fine to call here
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAllChannelMetas(teamID)
  )
const getProps = (selectedTab: Types.TabKey) => ({
  sections: [
    {data: [{key: 'header-inner', type: 'header' as const}], key: 'header'},
    {data: getRows(selectedTab), header: {key: 'tabs', type: 'tabs' as const}, key: 'body'},
  ],
  selectedTab,
  setSelectedTab: Sb.action('setSelectedTab'),
  teamID,
})

const storeWithSelection = Container.produce(store, draftState => {
  draftState.teams.teamSelectedChannels = new Map([[teamID, new Set(['hellos', 'team-beasts'])]])
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
