import * as React from 'react'
import {Box} from '../../../../../common-adapters'
import {action, storiesOf} from '../../../../../stories/storybook'
import {globalStyles} from '../../../../../styles'
import RetentionWarning from './'

const commonProps = {
  enabled: true,
  entityType: 'channel',
  exploding: false,
  onBack: action('onBack'),
  onConfirm: action('onConfirm'),
  setEnabled: action('setEnabled'),
  timePeriod: '5 days',
} as const

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
    .add('Exploding', () => <RetentionWarning {...commonProps} exploding={true} timePeriod="30 seconds" />)
}

export default load
