// @flow
import * as React from 'react'
import {Box} from '../../../../common-adapters'
import {storiesOf} from '../../../../stories/storybook'
import {globalStyles} from '../../../../styles'
import RetentionPicker from './'

const policyRetain = {type: 'retain'}
const policyInherit = {type: 'inherit'}
const policy30Days = {type: 'expire', days: 30}

const load = () => {
  storiesOf('Chat/Teams/Retention', module)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Team expires / we retain', () => (
      <RetentionPicker type="simple" policy={policyRetain} teamPolicy={policy30Days} />
    ))
    .add('Team-wide', () => <RetentionPicker type="simple" policy={policy30Days} />)
}

export default load
