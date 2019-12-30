import React from 'react'
import {Box} from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'

import EditTeamDescription from '.'

const sharedProps = {
  onClose: Sb.action('onClose'),
  onSetDescription: Sb.action('onSetDescription'),
  onSubmit: Sb.action('onChangeDescription'),
  origDescription: 'First description',
  teamname: 'testteam',
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
        <EditTeamDescription {...sharedProps} origDescription="Second description" />
      </Box>
    ))
}

const storyWrapStyle = {
  borderColor: 'black',
  borderStyle: 'solid',
  borderWidth: 1,
  display: 'flex',
  height: 400,
  width: Styles.isMobile ? undefined : 500,
}

export default load
