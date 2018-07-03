// @flow
import React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {Box} from '../../common-adapters'
import {storiesOf, action, createPropProvider} from '../../stories/storybook'
import {isMobile} from '../../constants/platform'
import CreateChannel from '.'

const provider = createPropProvider(PropProviders.Usernames(), PropProviders.Avatar())

const load = () => {
  storiesOf('Chat/Teams', module)
    .addDecorator(provider)
    .add('CreateChannel', () => (
      <Box style={{minWidth: isMobile ? undefined : 400, width: '100%'}}>
        <CreateChannel
          channelname="random"
          description="Random USA Stripes"
          errorText=""
          onBack={action('onBack')}
          onClose={action('onClose')}
          onChannelnameChange={action('onChannelnameChange')}
          onDescriptionChange={action('onDescriptionChange')}
          onSubmit={action('onSubmit')}
          teamname="stripe.usa"
        />
      </Box>
    ))
}

export default load
