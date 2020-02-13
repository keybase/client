import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import ChannelsWidget from './channels-widget'

const fakeTeamID = 'fakeTeamID'
const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.teams = {
    ...draftState.teams,
    teamIDToChannelInfos: new Map([
      [
        fakeTeamID,
        new Map([
          ['1', {...Constants.initialChannelInfo, channelname: 'random'}],
          ['2', {...Constants.initialChannelInfo, channelname: 'hellos'}],
          ['3', {...Constants.initialChannelInfo, channelname: 'NY_MemorialDay'}],
          ['4', {...Constants.initialChannelInfo, channelname: 'sandwiches'}],
          ['5', {...Constants.initialChannelInfo, channelname: 'soups'}],
          ['6', {...Constants.initialChannelInfo, channelname: 'stir-fry'}],
          ['7', {...Constants.initialChannelInfo, channelname: 'ice-cream'}],
          ['8', {...Constants.initialChannelInfo, channelname: 'salad'}],
          ['9', {...Constants.initialChannelInfo, channelname: 'veg'}],
          ['10', {...Constants.initialChannelInfo, channelname: 'plate-presentation'}],
          ['11', {...Constants.initialChannelInfo, channelname: 'team-sqawk'}],
          ['12', {...Constants.initialChannelInfo, channelname: 'team-birbs'}],
          ['13', {...Constants.initialChannelInfo, channelname: 'team-beasts'}],
          ['14', {...Constants.initialChannelInfo, channelname: 'team-dogs-of-the-sea-and-other-creatures'}],
        ]),
      ],
    ]),
  }
  draftState.config = {
    ...draftState.config,
    username: 'andonuts',
  }
})

const channelsWidgetProps = {
  channels: ['stir-fry', 'salad', 'veg', 'plate-presentation', 'team-sqawk', 'team-beasts'],
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
