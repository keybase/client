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
  setEnabled: action('setEnabled'),
  onConfirm: action('onConfirm'),
  onBack: action('onBack'),

  loading: false,
  showSaveIndicator: false,
}

const load = () => {
  storiesOf('Teams/Retention/Warning', module)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Channel', () => <RetentionWarning {...commonProps} />)
    .add('Big team', () => <RetentionWarning {...commonProps} entityType="big team" />)
}

export default load
