// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import * as PropProviders from '../../stories/prop-providers'
import {storiesOf, action} from '../../stories/storybook'
import DeleteRepo from '.'

const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const load = () => {
  storiesOf('Git/Delete', module)
    .addDecorator(provider)
    .add('DeleteRepo', () => (
      <Box style={{height: '100%', width: '100%'}}>
        <DeleteRepo
          name="docs"
          onClose={action('onClose')}
          onDelete={action('onDelete')}
          error={null}
          waitingKey="test"
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
          error={null}
          waitingKey="test"
        />
      </Box>
    ))
}

export default load
