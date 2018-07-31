// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {storiesOf, action, PropProviders} from '../../stories/storybook'
import DeleteRepo from '.'

const load = () => {
  storiesOf('Git/Delete', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
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
