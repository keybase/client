// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {storiesOf, action, PropProviders} from '../../stories/storybook'

import EditTeamDescription from '.'

const sharedProps = {
  description: 'First description',
  origDescription: 'First description',
  teamname: 'testteam',
  onChangeDescription: action('onChangeDescription'),
  onClose: action('onClose'),
  onSetDescription: action('onSetDescription'),
  waitingKey: 'test',
}

const load = () => {
  storiesOf('Teams/Edit team description', module)
    .addDecorator(PropProviders.createPropProviderWithCommon())
    .add('Description unchanged', () => (
      <Box style={storyWrapStyle}>
        <EditTeamDescription {...sharedProps} />
      </Box>
    ))
    .add('Description changed', () => (
      <Box style={storyWrapStyle}>
        <EditTeamDescription {...sharedProps} description="Second description" />
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
