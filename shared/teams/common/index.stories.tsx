import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import ChannelsWidget from './channels-widget'
import EnableContactsPopup from './enable-contacts'
import {fakeTeamID, store} from '../stories'

const channelsWidgetProps = {
  channels: [
    {channelname: 'general', conversationIDKey: '1'},
    {channelname: 'stir-fry', conversationIDKey: '2'},
    {channelname: 'salad', conversationIDKey: '3'},
    {channelname: 'veg', conversationIDKey: '4'},
    {channelname: 'plate-presentation', conversationIDKey: '5'},
    {channelname: 'team-sqawk', conversationIDKey: '6'},
    {channelname: 'team-beasts', conversationIDKey: '7'},
  ],
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
    .add('Enable contacts', () => <EnableContactsPopup noAccess={true} onClose={Sb.action('onClose')} />)
}

export default load
