import React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Constants from '../../../constants/teams'
import * as Container from '../../../util/container'
import {default as TeamMember, TeamMemberHeader} from './index.new'
import AddToChannels from './add-to-channels'
import {teamChannels} from '../../common/index.stories'

const fakeTeamID = 'fakeTeamID'
const subteamID1 = 'subteam1'
const subteamID2 = 'subteam2'
const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams = {
    ...draftState.teams,
    teamDetails: new Map([
      [
        fakeTeamID,
        {
          ...Constants.emptyTeamDetails,
          members: new Map([
            ['jeff', {fullName: 'Jeff', status: 'active', type: 'reader', username: 'jeff'}],
            // prettier-ignore
            ['paula', {fullName: 'Paula Superlonglastnamelikereallylongforreal', status: 'active', type: 'writer', username: 'paula'}],
            ['andonuts', {fullName: '', status: 'active', type: 'writer', username: 'andonuts'}],
          ]),
          subteams: new Set([subteamID1, subteamID2]),
        },
      ],
      [
        subteamID1,
        {
          ...Constants.emptyTeamDetails,
          members: new Map([
            ['jeff', {fullName: 'Jeff', status: 'active', type: 'admin', username: 'jeff'}],
            // prettier-ignore
            ['paula', {fullName: 'Paula Superlonglastnamelikereallylongforreal', status: 'active', type: 'writer', username: 'paula'}],
            ['andonuts', {fullName: '', status: 'active', type: 'writer', username: 'andonuts'}],
          ]),
        },
      ],
    ]),
    teamMeta: new Map([
      [fakeTeamID, Constants.makeTeamMeta({teamname: 'keybase_storybook'})],
      [subteamID1, Constants.makeTeamMeta({teamname: 'keybase_storybook.public'})],
      [subteamID2, Constants.makeTeamMeta({memberCount: 12, teamname: 'keybase_storybook.secret'})],
    ]),
    teamIDToChannelInfos: new Map([[fakeTeamID, teamChannels]]),
  }
  draftState.config = {
    ...draftState.config,
    username: 'andonuts',
  }
})

const addToChannelsProps = Sb.createNavigator({teamID: fakeTeamID, usernames: ['andonuts']})

const load = () =>
  Sb.storiesOf('Teams/Member', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Header normal', () => <TeamMemberHeader teamID={fakeTeamID} username="jeff" />)
    .add('Header long name', () => <TeamMemberHeader teamID={fakeTeamID} username="paula" />)
    .add('Header self + no name', () => <TeamMemberHeader teamID={fakeTeamID} username="andonuts" />)
    .add('Rows', () => <TeamMember {...Sb.createNavigator({teamID: fakeTeamID, username: 'jeff'})} />)
    .add('Add to channels', () => <AddToChannels {...addToChannelsProps} />)

export default load
