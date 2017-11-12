// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'

import EditTeamDescription from '.'

const load = () => {
  storiesOf('Edit team description', module)
    .add('Description unchanged', () => (
      <Box style={storyWrapStyle}>
        <EditTeamDescription
          description="First description"
          origDescription="First description"
          teamname="testteam"
          onChangeDescription={action('onChangeDescription')}
          onClose={action('onClose')}
          onSetDescription={action('onSetDescription')}
        />
      </Box>
    ))
    .add('Description changed', () => (
      <Box style={storyWrapStyle}>
        <EditTeamDescription
          description="Second description"
          origDescription="First description"
          teamname="testteam"
          onChangeDescription={action('onChangeDescription')}
          onClose={action('onClose')}
          onSetDescription={action('onSetDescription')}
        />
      </Box>
    ))
}

const storyWrapStyle = {
  width: 500,
  height: 400,
  borderColor: 'black',
  borderWidth: 1,
  borderStyle: 'solid',
  display: 'flex',
}

export default load
