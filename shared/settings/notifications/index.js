// @flow
import React from 'react'
import {Box, Button, Checkbox, HeaderHoc, NativeScrollView, ProgressIndicator, Text} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import {globalStyles, globalMargins} from '../../styles'

import type {Props} from './index'

const makeCheckbox = (
  group: string,
  s: {name: string, description: string, subscribed: boolean},
  props: Props
) => (
  <Checkbox
    style={{marginTop: globalMargins.small, marginRight: globalMargins.medium}}
    key={s.name}
    disabled={!props.allowEdit}
    onCheck={() => props.onToggle(group, s.name)}
    checked={s.subscribed}
    label={s.description}
  />
)

const MobileNotifications = (props: Props) =>
  <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
    <Notifications {...props} />
  </NativeScrollView>

const Notifications = (props: Props) =>
  !props.groups.email
    ? <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ProgressIndicator type="Small" style={{width: globalMargins.medium}} />
      </Box>
    : <Box style={{...globalStyles.flexBoxColumn, padding: globalMargins.small, flex: 1}}>
        <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>Email me:</Text>
        <Box style={globalStyles.flexBoxColumn}>
          {props.groups.email.settings &&
            props.groups.email.settings.map(s => makeCheckbox('email', s, props))}
        </Box>
        <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>Or:</Text>
        <Checkbox
          style={{marginTop: globalMargins.small}}
          onCheck={() => props.onToggleUnsubscribeAll('email')}
          disabled={!props.allowEdit}
          checked={props.groups.email && !!props.groups.email.unsubscribedFromAll}
          label="Unsubscribe me from all mail"
        />

        {!!props.groups.app_push &&
          props.groups.app_push.settings &&
          <Box style={globalStyles.flexBoxColumn}>
            <Text type="BodyBig" style={{marginTop: globalMargins.large}}>Push notifications:</Text>
            {props.groups.app_push.settings.map(s => makeCheckbox('app_push', s, props))}
            <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>Or:</Text>
            <Checkbox
              style={{marginTop: globalMargins.small}}
              onCheck={() => props.onToggleUnsubscribeAll('app_push')}
              disabled={!props.allowEdit}
              checked={!!props.groups.app_push && !!props.groups.app_push.unsubscribedFromAll}
              label="Unsubscribe me from all push notifications"
            />
          </Box>}

        <Button
          style={{alignSelf: 'center', marginTop: globalMargins.small}}
          type="Primary"
          label="Save"
          disabled={!props.allowSave || !props.allowEdit}
          onClick={props.onSave}
          waiting={props.waitingForResponse}
        />
      </Box>

export default (isMobile ? HeaderHoc(MobileNotifications) : Notifications)
