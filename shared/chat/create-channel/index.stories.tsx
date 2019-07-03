import * as Sb from '../../stories/storybook'
import * as React from 'react'
import {Box} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import CreateChannel from '.'

const load = () => {
  Sb.storiesOf('Chat/Teams', module).add('CreateChannel', () => (
    <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
      <CreateChannel
        channelname="random"
        description="Random USA Stripes"
        errorText=""
        onBack={Sb.action('onBack')}
        onClose={Sb.action('onClose')}
        onChannelnameChange={Sb.action('onChannelnameChange')}
        onDescriptionChange={Sb.action('onDescriptionChange')}
        onSubmit={Sb.action('onSubmit')}
        teamname="stripe.usa"
      />
    </Box>
  ))
}

export default load
