// @flow
import * as React from 'react'
import {Box} from '../../../../../common-adapters'
import {action, storiesOf} from '../../../../../stories/storybook'
import {globalStyles} from '../../../../../styles'
import RetentionWarning from './'

const commonProps = {
  days: 5,
  enabled: true,
  entityType: 'channel',
  onBack: action('onBack'),
  onConfirm: action('onConfirm'),
  setEnabled: action('setEnabled'),
}

const load = () => {
  storiesOf('Teams/Settings/Retention/Warning', module)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Ad hoc', () => <RetentionWarning {...commonProps} entityType="adhoc" />)
    .add('Channel', () => <RetentionWarning {...commonProps} entityType="channel" />)
    .add('Small team', () => <RetentionWarning {...commonProps} entityType="small team" />)
    .add('Big team', () => <RetentionWarning {...commonProps} entityType="big team" />)
    .add('Disabled', () => <RetentionWarning {...commonProps} enabled={false} />)
}

export default load
