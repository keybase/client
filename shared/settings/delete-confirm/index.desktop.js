// @flow
import * as React from 'react'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {Box, Button, Icon, Text, Avatar, ButtonBar} from '../../common-adapters'

import type {Props} from './index'

function DeleteConfirm(props: Props) {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: globalMargins.medium,
      }}
    >
      <Avatar size={48} username={props.username}>
        <Icon type="iconfont-remove" style={iconStyle} color={globalColors.red} />
      </Avatar>
      <Text
        type="BodySemibold"
        style={{...globalStyles.italic, color: globalColors.red, textDecorationLine: 'line-through'}}
      >
        {props.username}
      </Text>
      <Text type="Header" style={{marginTop: globalMargins.medium, width: 320, textAlign: 'center'}}>
        Are you sure you want to permanently delete your account?
      </Text>
      <ButtonBar>
        <Button type="Secondary" label="Cancel" onClick={props.onCancel} />
        <Button
          disabled={!props.allowDeleteForever}
          type="Danger"
          label="Yes, permanently delete it"
          onClick={props.onDeleteForever}
        />
      </ButtonBar>
    </Box>
  )
}

const iconStyle = {
  position: 'absolute',
  bottom: 0,
  right: -4,
  backgroundColor: globalColors.white,
  borderRadius: 16,
  borderColor: globalColors.white,
  borderStyle: 'solid',
  borderWidth: 2,
  padding: '1px 0px 0px 1px',
}

export default DeleteConfirm
