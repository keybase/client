// @flow
import * as React from 'react'
import {Avatar, Box, Button, ClickableBox, Icon, Meta, Usernames} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../styles'

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
        <Button
          label="Let in as..."
          onClick={onAccept}
          small={true}
          style={{backgroundColor: globalColors.green, marginLeft: globalMargins.xtiny}}
          type="Primary"
        />
        <Button
          label="Ignore"
          onClick={onIgnoreRequest}
          small={true}
          style={{marginLeft: globalMargins.xtiny}}
          type="Danger"
        />
        {!isMobile && (
          <Icon
            onClick={onChat}
            style={{marginLeft: globalMargins.small, marginRight: globalMargins.tiny}}
            type="iconfont-chat"
          />
        )}
      </Box>
    </Box>
  )
}

const styleCharm = {
  alignSelf: 'center',
  backgroundColor: globalColors.orange,
  borderRadius: 1,
  marginRight: globalMargins.xtiny,
}
