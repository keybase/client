// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box} from '../../common-adapters'
import NewRepo from '.'

const load = () => {
  Sb.storiesOf('Git/New', module)
    .add('PersonalRepo', () => (
      <Box style={{height: 500, width: '100%'}}>
        <NewRepo
          isTeam={false}
          onCreate={Sb.action('onCreate')}
          onClose={Sb.action('onClose')}
          onNewTeam={Sb.action('onNewTeam')}
          error={null}
          waitingKey="test"
        />
      </Box>
    ))
    .add('TeamRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <NewRepo
          isTeam={true}
          onClose={Sb.action('onClose')}
          onCreate={Sb.action('onCreate')}
          onNewTeam={Sb.action('onNewTeam')}
          teams={['fortgreenmoms', 'siggis', 'siggis.board']}
          error={null}
          waitingKey="test"
        />
      </Box>
    ))
}

export default load
