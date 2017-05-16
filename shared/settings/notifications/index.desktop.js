// @flow
import React from 'react'
import {Box, Button, Text, Checkbox, ProgressIndicator} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

import type {Props} from './index'

const Notifications = (props: Props) =>
  !props.settings
    ? <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ProgressIndicator type="Small" style={{width: globalMargins.medium}} />
      </Box>
    : <Box style={{...globalStyles.flexBoxColumn, padding: globalMargins.medium, flex: 1}}>
        <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>Email me:</Text>
        <Box style={globalStyles.flexBoxColumn}>
          {!!props.settings &&
            props.settings.map(s => (
              <Checkbox
                style={{marginTop: globalMargins.small}}
                key={s.name}
                disabled={!props.allowEdit}
                onCheck={() => props.onToggle(s.name)}
                checked={s.subscribed}
                label={s.description}
              />
            ))}
        </Box>
        <Text type="BodyBig" style={{marginTop: globalMargins.medium}}>Or:</Text>
        <Checkbox
          style={{marginTop: globalMargins.small, marginBottom: globalMargins.medium}}
          onCheck={() => props.onToggleUnsubscribeAll()}
          disabled={!props.allowEdit}
          checked={!!props.unsubscribedFromAll}
          label="Unsubscribe me from all mail"
        />
        <Button
          style={{alignSelf: 'center'}}
          type="Primary"
          label="Save"
          disabled={!props.allowSave || !props.allowEdit}
          onClick={props.onSave}
          waiting={props.waitingForResponse}
        />
      </Box>

export default Notifications
