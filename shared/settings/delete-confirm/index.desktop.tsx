import * as React from 'react'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {Box, Button, Icon, Text, Avatar, ButtonBar} from '../../common-adapters'

import {Props} from './index'

function DeleteConfirm(props: Props) {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        padding: globalMargins.medium,
      }}
    >
      <Avatar size={48} username={props.username}>
        <Icon type="iconfont-remove" style={iconStyle} color={globalColors.red} />
      </Avatar>
      <Text
        type="BodySemibold"
        style={{...globalStyles.italic, color: globalColors.redDark, textDecorationLine: 'line-through'}}
      >
        {props.username}
      </Text>
      <Text center={true} type="Header" style={{marginTop: globalMargins.medium, width: 320}}>
        Are you sure you want to permanently delete your account?
      </Text>
      <ButtonBar>
        <Button type="Dim" label="Cancel" onClick={props.onCancel} />
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
  backgroundColor: globalColors.white,
  borderColor: globalColors.white,
  borderRadius: 16,
  borderStyle: 'solid',
  borderWidth: 2,
  bottom: 0,
  padding: '1px 0px 0px 1px',
  position: 'absolute',
  right: -4,
} as const

export default DeleteConfirm
