// @flow
import React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'

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

const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both']),
  PropProviders.WaitingButton(),
)

const load = () => {
  storiesOf('Teams/Edit team description', module)
    .addDecorator(provider)
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
