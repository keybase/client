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
const policy7Days = makeRetentionPolicy({type: 'expire', days: 7})

const actions = {
  setRetentionPolicy: action('setRetentionPolicy'),
  onSelect: action('onSelectPolicy'),
  onShowDropdown: action('onShowDropdown'),
  onShowWarning: action('onShowWarning'),
}

const commonProps = {
  loading: false,
  showSaveIndicator: false,
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
        entityType="channel"
        canSetPolicy={true}
        policy={policy30Days}
        teamPolicy={policyRetain}
        showInheritOption={true}
        showOverrideNotice={false}
        type="simple"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Big team', () => (
      <RetentionPicker
        entityType="big team"
        canSetPolicy={true}
        policy={policy30Days}
        showInheritOption={false}
        showOverrideNotice={true}
        type="simple"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Small team', () => (
      <RetentionPicker
        entityType="small team"
        canSetPolicy={true}
        policy={policyRetain}
        showInheritOption={false}
        showOverrideNotice={false}
        type="simple"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Adhoc', () => (
      <RetentionPicker
        entityType="adhoc"
        canSetPolicy={true}
        policy={policy30Days}
        showInheritOption={false}
        showOverrideNotice={false}
        type="simple"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Channel inheriting', () => (
      <RetentionPicker
        entityType="channel"
        canSetPolicy={true}
        policy={policyInherit}
        teamPolicy={policy30Days}
        showInheritOption={true}
        showOverrideNotice={false}
        type="simple"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Automatically show warning / set policy', () => (
      <RetentionPicker
        entityType="channel"
        canSetPolicy={true}
        policy={policyInherit}
        teamPolicy={policy30Days}
        showInheritOption={true}
        showOverrideNotice={false}
        type="auto"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Non-admin team-wide', () => (
      <RetentionPicker
        entityType="big team"
        canSetPolicy={false}
        policy={policy30Days}
        showInheritOption={false}
        showOverrideNotice={true}
        type="simple"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Non-admin channel', () => (
      <RetentionPicker
        entityType="channel"
        canSetPolicy={false}
        policy={policy30Days}
        teamPolicy={policyRetain}
        showInheritOption={true}
        showOverrideNotice={false}
        type="simple"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Non-admin channel inherit', () => (
      <RetentionPicker
        entityType="channel"
        canSetPolicy={false}
        policy={policyInherit}
        teamPolicy={policy7Days}
        showInheritOption={true}
        showOverrideNotice={false}
        type="simple"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Non-admin small team', () => (
      <RetentionPicker
        entityType="small team"
        canSetPolicy={false}
        policy={policy7Days}
        showInheritOption={false}
        showOverrideNotice={false}
        type="simple"
        {...commonProps}
        {...actions}
      />
    ))
    .add('Team-wide dropdown', () => <RetentionDropdownView items={teamWideItems} onHidden={onHidden} />)
    .add('Channel dropdown', () => <RetentionDropdownView items={channelItems} onHidden={onHidden} />)
}

export default load
