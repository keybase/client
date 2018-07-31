// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {storiesOf, action, PropProviders} from '../../stories/storybook'
import {isMobile} from '../../constants/platform'
import CreateChannel from '.'

const load = () => {
  storiesOf('Chat/Teams', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
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
