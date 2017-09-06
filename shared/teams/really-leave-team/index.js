// @flow
import * as React from 'react'
import {Avatar, Box, Text, Icon, PopupDialog, Button} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
// import {isMobile} from '../../constants/platform'

const ReallyLeaveTeam = (props: any) => (
  <PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, padding: globalMargins.large}}>
      <Avatar teamname={props.name} size={64} />
      <Icon type="iconfont-keybase" />
      <Text type="BodyBig" style={{marginBottom: globalMargins.large, marginTop: globalMargins.large}}>
        Are you sure you want to leave {props.name}?
      </Text>
      <Text type="Body" style={{maxWidth: 430, textAlign: 'center'}}>
        You will loose access to all the
        {' '}
        {props.name}
        {' '}
        chats and folders, and you won't be able to get back unless an admin invites you.
      </Text>
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
        <Button
          type="Secondary"
          onClick={props.onClose}
          label="Cancel"
          style={{marginRight: globalMargins.small}}
        />
        <Button type="Danger" onClick={props.onLeave} label={`Yes, leave ${props.name}`} />
      </Box>
    </Box>
  </PopupDialog>
)

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: globalColors.black_75,
  justifyContent: 'stretch',
}

const _styleContainer = {
  height: '100%',
}
export default ReallyLeaveTeam
