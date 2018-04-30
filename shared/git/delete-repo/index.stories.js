// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
import DeleteRepo from '.'

const load = () => {
  storiesOf('Git/Delete', module)
    .add('DeleteRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <DeleteRepo
          name="docs"
          onClose={action('onClose')}
          onDelete={action('onDelete')}
          loading={false}
          error={null}
        />
      </Box>
    ))
    .add('DeleteTeamRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <DeleteRepo
          teamname="siggis.board"
          name="media"
          onClose={action('onClose')}
          onDelete={action('onDelete')}
          loading={false}
          error={null}
        />
      </Box>
    ))
}

export default load
