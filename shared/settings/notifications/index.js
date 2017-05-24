// @flow
import React from 'react'
import {Box, Button, Checkbox, ProgressIndicator, Text} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

import type {Props} from './index'

const makeCheckbox = (
  group: string,
  s: {name: string, description: string, subscribed: boolean},
  props: Props
) => (
  <Checkbox
    style={{marginRight: globalMargins.medium, marginTop: globalMargins.tiny}}
    key={s.name}
    disabled={!props.allowEdit}
    onCheck={() => props.onToggle(group, s.name)}
    checked={s.subscribed}
    label={s.description}
  />
)

const renderGroup = (groupName: string, props: Props) => {
  const labels = {
    title: {
      app_push: 'Phone - push notifications:',
      email: 'Email me:',
    },
    unsub: {
      app_push: 'Unsubscribe me from all push notifications',
      email: 'Unsubscribe me from all mail',
    },
  }

  return (
    <Box style={{...globalStyles.flexBoxColumn, marginBottom: globalMargins.medium}}>
      <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>{labels.title[groupName]}</Text>
      <Box style={{...globalStyles.flexBoxColumn, marginBottom: globalMargins.small}}>
        {props.groups[groupName].settings &&
          props.groups[groupName].settings.map(s => makeCheckbox(groupName, s, props))}
      </Box>
      <Text type="BodyBig">Or:</Text>
      <Checkbox
        style={{marginTop: globalMargins.small}}
        onCheck={() => props.onToggleUnsubscribeAll(groupName)}
        disabled={!props.allowEdit}
        checked={props.groups[groupName] && !!props.groups[groupName].unsubscribedFromAll}
        label={labels.unsub[groupName]}
      />
    </Box>
  )
}
const Notifications = (props: Props) =>
  !props.groups.email || !props.groups.email.settings
    ? <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center'}}>
        <ProgressIndicator type="Small" style={{width: globalMargins.medium}} />
      </Box>
    : <Box style={{...globalStyles.scrollable, padding: globalMargins.small, flex: 1}}>
        {props.groups.email && props.groups.email.settings && renderGroup('email', props)}
        {props.groups.app_push && props.groups.app_push.settings && renderGroup('app_push', props)}
        <Button
          style={{alignSelf: 'center', marginTop: globalMargins.small}}
          type="Primary"
          label="Save"
          disabled={!props.allowSave || !props.allowEdit}
          onClick={props.onSave}
          waiting={props.waitingForResponse}
        />
      </Box>

export default Notifications
