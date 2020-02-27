import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import ChannelsWidget from './channels-widget'

const fakeTeamID = 'fakeTeamID'
// prettier-ignore
export const teamChannels = new Map([
  ['0', {...Constants.initialChannelInfo, channelname: 'general', numParticipants: 25}],
  ['1', {...Constants.initialChannelInfo, channelname: 'random', numParticipants: 1}],
  ['2', {...Constants.initialChannelInfo, channelname: 'hellos', numParticipants: 13}],
  ['3', {...Constants.initialChannelInfo, channelname: 'NY_MemorialDay', numParticipants: 23}],
  ['4', {...Constants.initialChannelInfo, channelname: 'sandwiches', numParticipants: 12}],
  ['5', {...Constants.initialChannelInfo, channelname: 'soups', numParticipants: 3}],
  ['6', {...Constants.initialChannelInfo, channelname: 'stir-fry', numParticipants: 1}],
  ['7', {...Constants.initialChannelInfo, channelname: 'ice-cream', numParticipants: 7}],
  ['8', {...Constants.initialChannelInfo, channelname: 'salad', numParticipants: 23}],
  ['9', {...Constants.initialChannelInfo, channelname: 'veg', numParticipants: 20}],
  ['10', {...Constants.initialChannelInfo, channelname: 'plate-presentation', numParticipants: 19}],
  ['11', {...Constants.initialChannelInfo, channelname: 'team-sqawk', numParticipants: 6}],
  ['12', {...Constants.initialChannelInfo, channelname: 'team-birbs', numParticipants: 14}],
  ['13', {...Constants.initialChannelInfo, channelname: 'team-beasts', numParticipants: 9}],
  ['14', {...Constants.initialChannelInfo, channelname: 'team-dogs-of-the-sea-and-other-creatures', numParticipants: 12}],
])
const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams = {
    ...draftState.teams,
    teamIDToChannelInfos: new Map([[fakeTeamID, teamChannels]]),
  }
  draftState.config = {
    ...draftState.config,
    username: 'andonuts',
  }
})

const channelsWidgetProps = {
  channels: ['general', 'stir-fry', 'salad', 'veg', 'plate-presentation', 'team-sqawk', 'team-beasts'],
  onAddChannel: Sb.action('onAddChannel'),
  onRemoveChannel: Sb.action('onRemoveChannel'),
  teamID: fakeTeamID,
}

const load = () => {
  Sb.storiesOf('Teams/Common', module)
    .addDecorator(story => (
      <Sb.MockStore store={store}>
        <Kb.Box style={{padding: 20}}>{story()}</Kb.Box>
      </Sb.MockStore>
    ))
    .add('Channels widget', () => <ChannelsWidget {...channelsWidgetProps} />)
}

export default load
