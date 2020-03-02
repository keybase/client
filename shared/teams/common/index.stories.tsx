import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import ChannelsWidget from './channels-widget'
import {fakeTeamID, store} from '../stories'

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
