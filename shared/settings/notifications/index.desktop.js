// @flow
import React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Button, Text, Checkbox} from '../../common-adapters'

import type {Props} from './index'

function Notifications (props: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Text type='Header' style={{marginTop: globalMargins.xlarge}}>Email me:</Text>
      <Box style={globalStyles.flexBoxColumn}>
        {props.settings.map(s => (
          <Checkbox
            style={{marginTop: globalMargins.small}}
            key={s.name}
            onCheck={() => props.onToggle(s.name)}
            checked={s.subscribed}
            label={s.description} />))}
      </Box>
      <Text type='Header' style={{marginTop: globalMargins.medium}}>Or:</Text>
      <Checkbox
        style={{marginTop: globalMargins.small, marginBottom: globalMargins.medium}}
        onCheck={() => props.onToggleUnsubscribeAll()}
        checked={props.unsubscribedFromAll}
        label='Unsubscribe me from all mail' />
      <Button
        style={{alignSelf: 'center'}}
        type='Primary'
        label='Save'
        onClick={props.onSave} />
    </Box>
  )
}

export default Notifications
