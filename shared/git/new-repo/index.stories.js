// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
import NewRepo from '.'

const load = () => {
  storiesOf('Git/New', module)
    .add('PersonalRepo', () => (
      <Box style={{height: 500, width: '100%'}}>
        <NewRepo
          isTeam={false}
          onCreate={action('onCreate')}
          onClose={action('onClose')}
          onNewTeam={action('onNewTeam')}
          loading={false}
          error={null}
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
          loading={false}
          error={null}
        />
      </Box>
    ))
}

export default load
