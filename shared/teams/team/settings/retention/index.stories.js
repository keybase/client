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
  setRetentionPolicy: action('setRetentionPolicy'),
  onSelect: action('onSelectPolicy'),
  onShowDropdown: action('onShowDropdown'),
  onShowWarning: action('onShowWarning'),
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
  storiesOf('Teams/Retention', module)
    .addDecorator(story => (
      <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>{story()}</Box>
    ))
    .add('Channel', () => (
      <RetentionPicker
        loading={false}
        isTeamWide={false}
        isTeam={true}
        policy={policyRetain}
        teamPolicy={policy30Days}
        type="simple"
        {...actions}
      />
    ))
    .add('Team-wide', () => (
      <RetentionPicker
        loading={false}
        isTeamWide={true}
        isTeam={true}
        policy={policy30Days}
        type="simple"
        {...actions}
      />
    ))
    .add('Channel inheriting from team', () => (
      <RetentionPicker
        loading={false}
        isTeamWide={false}
        isTeam={true}
        policy={policyInherit}
        teamPolicy={policy30Days}
        type="simple"
        {...actions}
      />
    ))
    .add('Automatic show warning / set', () => (
      <RetentionPicker
        loading={false}
        isTeamWide={false}
        isTeam={true}
        policy={policyInherit}
        teamPolicy={policy30Days}
        type="auto"
        {...actions}
      />
    ))
    .add('Team-wide dropdown', () => <RetentionDropdownView items={teamWideItems} onHidden={onHidden} />)
    .add('Channel dropdown', () => <RetentionDropdownView items={channelItems} onHidden={onHidden} />)
}

export default load
