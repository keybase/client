import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Box} from '../../common-adapters'
import DeleteRepo from '.'

const load = () => {
  Sb.storiesOf('Git/Delete', module)
    .add('DeleteRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <DeleteRepo
          name="docs"
          onClose={Sb.action('onClose')}
          onDelete={Sb.action('onDelete')}
          waitingKey="test"
        />
      </Box>
    ))
    .add('DeleteTeamRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <DeleteRepo
          teamname="siggis.board"
          name="media"
          onClose={Sb.action('onClose')}
          onDelete={Sb.action('onDelete')}
          waitingKey="test"
        />
      </Box>
    ))
}

export default load
