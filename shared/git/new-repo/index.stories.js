// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {storiesOf, action, PropProviders} from '../../stories/storybook'
import NewRepo from '.'

const load = () => {
  storiesOf('Git/New', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('PersonalRepo', () => (
      <Box style={{height: 500, width: '100%'}}>
        <NewRepo
          isTeam={false}
          onCreate={action('onCreate')}
          onClose={action('onClose')}
          onNewTeam={action('onNewTeam')}
          error={null}
          waitingKey="test"
        />
      </Box>
    ))
    .add('TeamRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <NewRepo
          isTeam={true}
          onClose={action('onClose')}
          onCreate={action('onCreate')}
          onNewTeam={action('onNewTeam')}
          teams={['fortgreenmoms', 'siggis', 'siggis.board']}
          error={null}
          waitingKey="test"
        />
      </Box>
    ))
}

export default load
