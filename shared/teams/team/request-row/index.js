// @flow
import * as React from 'react'
import {Avatar, Box, Button, ClickableBox, Icon, Meta, Text, Usernames} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {isMobile} from '../../../constants/platform'

export type Props = {
  username: string,
  following: boolean,
  teamname: string,
  you: ?string,
  onOpenProfile: (u: string) => void,
  onChat: () => void,
  onIgnoreRequest: () => void,
  onAccept: () => void,
}
export const TeamRequestRow = (props: Props) => {
  const {username, following, onOpenProfile, you, onChat, onIgnoreRequest, onAccept} = props
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'center',
        flexShrink: 0,
        height: isMobile ? 112 : 48,
        padding: globalMargins.tiny,
        width: '100%',
      }}
    >
      <ClickableBox
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flexGrow: 1,
          flexShrink: 0,
          width: isMobile ? '100%' : 'initial',
        }}
        onClick={() => onOpenProfile(username)}
      >
        <Avatar username={username} size={isMobile ? 48 : 32} />
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
          <Usernames
            type="BodySemibold"
            colorFollowing={true}
            users={[{username, following, you: you === username}]}
          />
          <Box style={globalStyles.flexBoxRow}>
            <Meta title="PLEASE DECIDE" style={styleCharm} />
          </Box>
        </Box>
      </ClickableBox>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          marginTop: isMobile ? globalMargins.tiny : 0,
        }}
      >
        <Button small={true} style={{backgroundColor: globalColors.green, marginLeft: globalMargins.xtiny}} type="Primary" label="Let in as..." onClick={onAccept} />
        <Button
          small={true} style={{marginLeft: globalMargins.xtiny}}
          type="Danger"
          label="Ignore"
          onClick={onIgnoreRequest}
        />
        {!isMobile && 
        <Icon
          onClick={onChat}
          type="iconfont-chat"
          style={{fontSize: 20, marginLeft: globalMargins.tiny}}
       />}
      </Box>
    </Box>
  )
}

const styleCharm = {
  backgroundColor: globalColors.orange,
  borderRadius: 1,
  marginRight: 4,
  alignSelf: 'center',
}