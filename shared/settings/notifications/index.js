// @flow
import React from 'react'
import {Box, Button, Checkbox, HeaderHoc, ProgressIndicator, Text} from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import {globalStyles, globalMargins} from '../../styles'

import type {Props} from './index'

const makeCheckbox = (group: string, s: Foo, props: Props) => (
  <Checkbox
    style={{marginTop: globalMargins.small}}
    key={s.name}
    disabled={!props.allowEdit}
    onCheck={() => props.onToggle(group, s.name)}
    checked={s.subscribed}
    label={s.description}
  />
)

const Notifications = (props: Props) =>
  !props.emailSettings
    ? <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ProgressIndicator type="Small" style={{width: globalMargins.medium}} />
      </Box>
    : <Box style={{...globalStyles.flexBoxColumn, padding: globalMargins.small, flex: 1}}>
        <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>Email me:</Text>
        <Box style={globalStyles.flexBoxColumn}>
          {!!props.emailSettings && props.emailSettings.map(s => makeCheckbox('email', s, props))}
        </Box>
        <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>Or:</Text>
        <Checkbox
          style={{marginTop: globalMargins.small}}
          onCheck={() => props.onToggleUnsubscribeAll()}
          disabled={!props.allowEdit}
          checked={!!props.unsubscribedFromAll}
          label="Unsubscribe me from all mail"
        />
        {!!props.pushSettings &&
          <Box style={globalStyles.flexBoxColumn}>
            <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>Push notifications:</Text>
            {props.pushSettings.map(s => makeCheckbox('app_push', s, props))}
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

export default (isMobile ? HeaderHoc(Notifications) : Notifications)
