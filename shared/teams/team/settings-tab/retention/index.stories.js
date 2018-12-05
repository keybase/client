// @flow
import * as React from 'react'
import {makeRetentionPolicy} from '../../../../constants/teams'
import {Box} from '../../../../common-adapters'
import {action, storiesOf} from '../../../../stories/storybook'
import {globalStyles} from '../../../../styles'
import RetentionPicker from './'

const policyRetain = makeRetentionPolicy({type: 'retain'})
const policyInherit = makeRetentionPolicy({type: 'inherit'})
const policy30Days = makeRetentionPolicy({days: 30, type: 'expire'})
const policy7Days = makeRetentionPolicy({days: 7, type: 'expire'})

const actions = {
  onSelect: action('onSelectPolicy'),
  onShowDropdown: action('onShowDropdown'),
  onShowWarning: action('onShowWarning'),
  saveRetentionPolicy: action('saveRetentionPolicy'),
}

const commonProps = {
  loading: false,
  showSaveIndicator: false,
}

const load = () => {
  storiesOf('Teams/Settings/Retention', module)
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
}

export default load
