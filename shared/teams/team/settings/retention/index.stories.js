// @flow
import * as React from 'react'
import {makeRetentionPolicy} from '../../../../constants/teams'
import {Box} from '../../../../common-adapters'
import {action, storiesOf} from '../../../../stories/storybook'
import {globalStyles} from '../../../../styles'
import RetentionPicker from './'

const policyRetain = makeRetentionPolicy({type: 'retain'})
// const policyInherit = {type: 'inherit'}
const policy30Days = makeRetentionPolicy({type: 'expire', days: 30})

const load = () => {
  storiesOf('Chat/Teams/Retention', module)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Team expires / we retain', () => (
      <RetentionPicker
        isTeamWide={false}
        policy={policyRetain}
        teamPolicy={policy30Days}
        onSelect={action('onSelect')}
      />
    ))
    .add('Team-wide', () => (
      <RetentionPicker isTeamWide={true} policy={policy30Days} onSelect={action('onSelect')} />
    ))
}

export default load
