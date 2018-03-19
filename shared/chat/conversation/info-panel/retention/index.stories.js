// @flow
import * as React from 'react'
import {Box} from '../../../../common-adapters'
import {action, storiesOf} from '../../../../stories/storybook'
import {globalStyles} from '../../../../styles'
import RetentionPicker from './'

const policyRetain = {type: 'custom', days: -1}
// const policyInherit = {type: 'inherit'}
const policy30Days = {type: 'custom', days: 30}

const load = () => {
  storiesOf('Chat/Teams/Retention', module)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Team expires / we retain', () => (
      <RetentionPicker policy={policyRetain} teamPolicy={policy30Days} onSelect={action('onSelect')} />
    ))
    .add('Team-wide', () => <RetentionPicker policy={policy30Days} onSelect={action('onSelect')} />)
}

export default load
