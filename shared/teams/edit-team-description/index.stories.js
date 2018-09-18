// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'

import EditTeamDescription from '.'

const sharedProps = {
  description: 'First description',
  origDescription: 'First description',
  teamname: 'testteam',
  onChangeDescription: Sb.action('onChangeDescription'),
  onClose: Sb.action('onClose'),
  onSetDescription: Sb.action('onSetDescription'),
  waitingKey: 'test',
}

const load = () => {
  Sb.storiesOf('Teams/Edit team description', module)
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
  width: Styles.isMobile ? undefined : 500,
  height: 400,
  borderColor: 'black',
  borderWidth: 1,
  borderStyle: 'solid',
  display: 'flex',
}

export default load
