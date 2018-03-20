// @flow
import * as React from 'react'
import {makeRetentionPolicy} from '../../../../constants/teams'
import {Box} from '../../../../common-adapters'
import {action, storiesOf} from '../../../../stories/storybook'
import {globalStyles} from '../../../../styles'
import RetentionPicker from './'
import {RetentionDropdownView} from './dropdown'

const policyRetain = makeRetentionPolicy({type: 'retain'})
const policyInherit = makeRetentionPolicy({type: 'inherit'})
const policy30Days = makeRetentionPolicy({type: 'expire', days: 30})

const actions = {
  onSelect: action('onSelect'),
  onShowDropdown: action('onShowDropdown'),
}

const onClick = action('onClick')
const onHidden = action('onHidden')
const teamWideItems = [
  {title: '1 day', onClick},
  {title: '7 days', onClick},
  {title: '30 days', onClick},
  {title: '90 days', onClick},
  {title: '365 days', onClick},
  {title: 'Keep forever', onClick},
]
const channelItems = [{title: 'Use team default (30 days)', onClick}, ...teamWideItems]

const load = () => {
  storiesOf('Chat/Teams/Retention', module)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Channel', () => (
      <RetentionPicker isTeamWide={false} policy={policyRetain} teamPolicy={policy30Days} {...actions} />
    ))
    .add('Team-wide', () => <RetentionPicker isTeamWide={true} policy={policy30Days} {...actions} />)
    .add('Channel inheriting from team', () => (
      <RetentionPicker isTeamWide={false} policy={policyInherit} teamPolicy={policy30Days} {...actions} />
    ))
    .add('Team-wide dropdown', () => <RetentionDropdownView items={teamWideItems} onHidden={onHidden} />)
    .add('Channel dropdown', () => <RetentionDropdownView items={channelItems} onHidden={onHidden} />)
}

export default load
