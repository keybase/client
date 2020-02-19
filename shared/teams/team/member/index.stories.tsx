import React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Constants from '../../../constants/teams'
import * as Container from '../../../util/container'
import {TeamMemberHeader} from './index.new'
import AddToChannels from './add-to-channels'

const fakeTeamID = 'fakeTeamID'
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
        },
      ],
    ]),
    teamMeta: new Map([[fakeTeamID, Constants.makeTeamMeta({teamname: 'keybase_storybook'})]]),
  }
  draftState.config = {
    ...draftState.config,
    username: 'andonuts',
  }
})

const load = () =>
  Sb.storiesOf('Teams/Member', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Header normal', () => <TeamMemberHeader teamID={fakeTeamID} username="jeff" />)
    .add('Header long name', () => <TeamMemberHeader teamID={fakeTeamID} username="paula" />)
    .add('Header self + no name', () => <TeamMemberHeader teamID={fakeTeamID} username="andonuts" />)
    .add('Add to channels', () => <AddToChannels teamID={fakeTeamID} username="andonuts" />)

export default load
