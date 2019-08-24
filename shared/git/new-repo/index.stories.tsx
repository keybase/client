import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box} from '../../common-adapters'
import NewRepo from '.'

const props = {
  loadTeams: Sb.action('loadTeams'),
  onClose: Sb.action('onClose'),
  onCreate: Sb.action('onCreate'),
  onNewTeam: Sb.action('onNewTeam'),
  waitingKey: 'test',
}

const load = () => {
  Sb.storiesOf('Git/New', module)
    .add('PersonalRepo', () => (
      <Box style={{height: 500, width: '100%'}}>
        <NewRepo {...props} isTeam={false} />
      </Box>
    ))
    .add('TeamRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <NewRepo {...props} isTeam={true} teams={['fortgreenmoms', 'siggis', 'siggis.board']} />
      </Box>
    ))
}

export default load
