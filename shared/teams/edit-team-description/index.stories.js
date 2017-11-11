// @flow
import React from 'react'
import {Box} from '../../common-adapters'
import {storiesOf, action} from '../../stories/storybook'
import {withState} from 'recompose'

import {OpenTeamSettingButton, MakeOpenTeamConfirm, MakeTeamClosed} from '.'

const MakeOpenTeamConfirmWithState = withState('defaultRole', 'onChangeDefaultRole', 'reader')(props => (
  <Box style={storyWrapStyle}>
    <MakeOpenTeamConfirm
      teamNameInput={''}
      onChangeTeamNameInput={action('onChangeTeamNameInput')}
      onCancel={action('onCancel')}
      confirmEnabled={props.confirmEnabled}
      defaultRole={props.defaultRole}
      onChangeDefaultRole={props.onChangeDefaultRole}
      onMakeTeamOpen={action('onMakeTeamOpen')}
    />
  </Box>
))

const load = () => {
  storiesOf('Open Team Access/Button', module)
    .add('OpenTeamSettingButtonWithOpenTeam', () => (
      <Box style={storyWrapStyle}>
        <OpenTeamSettingButton onClick={action('onClick')} isOpen={true} />
      </Box>
    ))
    .add('OpenTeamSettingButtonWithClosedTeam', () => (
      <Box style={storyWrapStyle}>
        <OpenTeamSettingButton onClick={action('onClick')} isOpen={false} />
      </Box>
    ))

  storiesOf('Open Team Access/Confirm Make Open', module)
    .add('Confirm disabled', () => <MakeOpenTeamConfirmWithState confirmEnabled={false} />)
    .add('Confirm enabled', () => <MakeOpenTeamConfirmWithState confirmEnabled={true} />)

  storiesOf('Open Team Access/Confirm Make Closed', module).add('OpenTeamSettingButtonWithOpenTeam', () => (
    <Box style={storyWrapStyle}>
      <MakeTeamClosed onMakeTeamClosed={action('makeTeamClosed')} />
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
