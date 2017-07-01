// @flow
import React from 'react'
import {Box, Button, Checkbox, ProgressIndicator, Text} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

import type {NotificationsSettingsState} from '../../constants/settings'
import type {Props} from './index'

const SubscriptionCheckbox = (props: {
  allowEdit: boolean,
  description: string,
  groupName: string,
  name: string,
  onToggle: (groupName: string, name: string) => void,
  subscribed: boolean,
}) => (
  <Checkbox
    style={{marginRight: globalMargins.medium, marginTop: globalMargins.tiny}}
    key={props.name}
    disabled={!props.allowEdit}
    onCheck={() => props.onToggle(props.groupName, props.name)}
    checked={props.subscribed}
    label={props.description}
  />
)

const Group = (props: {
  allowEdit: boolean,
  groupName: string,
  onToggle: (groupName: string, name: string) => void,
  onToggleUnsubscribeAll: () => void,
  settings: ?Array<NotificationsSettingsState>,
  title: string,
  unsub: string,
  unsubscribedFromAll: boolean,
}) => (
  <Box style={{...globalStyles.flexBoxColumn, marginBottom: globalMargins.medium}}>
    <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>{props.title}</Text>
    <Box style={{...globalStyles.flexBoxColumn, marginBottom: globalMargins.small}}>
      {props.settings &&
        props.settings.map(s => (
          <SubscriptionCheckbox
            allowEdit={props.allowEdit}
            description={s.description}
            groupName={props.groupName}
            key={props.groupName + s.name}
            name={s.name}
            onToggle={props.onToggle}
            subscribed={s.subscribed}
          />
        ))}
    </Box>
    <Text type="BodyBig">Or:</Text>
    <Checkbox
      style={{marginTop: globalMargins.small}}
      onCheck={props.onToggleUnsubscribeAll}
      disabled={!props.allowEdit}
      checked={!!props.unsubscribedFromAll}
      label={`Unsubscribe me from all ${props.unsub} notifications.`}
    />
  </Box>
)

const Notifications = (props: Props) =>
  !props.groups.email || !props.groups.email.settings
    ? <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center'}}>
        <ProgressIndicator type="Small" style={{width: globalMargins.medium}} />
      </Box>
    : <Box style={{...globalStyles.scrollable, flex: 1, padding: globalMargins.small}}>
        <Group
          allowEdit={props.allowEdit}
          groupName="email"
          onToggle={props.onToggle}
          onToggleUnsubscribeAll={() => props.onToggleUnsubscribeAll('email')}
          title="Email me:"
          unsub="mail"
          settings={props.groups.email && props.groups.email.settings}
          unsubscribedFromAll={props.groups.email && props.groups.email.unsubscribedFromAll}
        />

        {props.groups.app_push &&
          props.groups.app_push.settings &&
          <Group
            allowEdit={props.allowEdit}
            groupName="app_push"
            onToggle={props.onToggle}
            onToggleUnsubscribeAll={() => props.onToggleUnsubscribeAll('app_push')}
            title="Phone - push notifications:"
            unsub="push"
            settings={props.groups.app_push.settings}
            unsubscribedFromAll={props.groups.app_push.unsubscribedFromAll}
          />}

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
