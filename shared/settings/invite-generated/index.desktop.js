// @flow
import React from 'react'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {Box, Button, Icon, Text} from '../../common-adapters'

import type {Props} from './index'

function InviteGenerated (props: Props) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative', justifyContent: 'center', alignItems: 'center'}}>
      <Icon type='iconfont-close' style={{...globalStyles.clickable, position: 'absolute', right: 0, top: 0}} onClick={props.onClose} />
      <Icon type='icon-invite-link-48' />
      {
        props.email
        ? <Text type='Body' style={textStyle}>Yay! We emailed <Text type='BodySemibold'>{props.email}</Text>, but you can also give them the below link:</Text>
        : <Text type='Body' style={textStyle}>Yay! Please share the below link with your friend. It contains signup &amp; install instructions.</Text>
      }
      <Box style={linkContainerStyle}>
        <Icon type='iconfont-link' style={{color: globalColors.black_10, marginRight: globalMargins.tiny, height: 14}} />
        <Text type='BodySemibold' style={{...globalStyles.selectable, color: globalColors.green2}}>{props.link}</Text>
      </Box>
      <Button
        style={{marginTop: globalMargins.medium}}
        type='Primary'
        label='Close'
        onClick={props.onClose} />
    </Box>
  )
}

const textStyle = {
  textAlign: 'center',
  paddingTop: globalMargins.medium,
  width: 440,
}

const linkContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderRadius: 48,
  height: 32,
  marginTop: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  backgroundColor: globalColors.green3,
}

export default InviteGenerated
