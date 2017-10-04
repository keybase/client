// @flow
import * as React from 'react'
import {Avatar, Box, Button, ClickableBox, Usernames} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

// For use in list RowRenderer prop
export type Props = {
  username: string,
  following: boolean,
  teamname: string,
  you: ?string,
  onOpenProfile: (u: string) => void,
  onChat: () => void,
  onAcceptRequest: (role: 'owners' | 'admins' | 'writers' | 'readers', sendChatNotification: boolean) => void,
  onIgnoreRequest: () => void,
}

export const TeamRequestRow = (props: Props) => {
  const {username, following, onOpenProfile, you, onChat, onIgnoreRequest} = props
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
      key={username}
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
        </Box>
      </ClickableBox>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          marginTop: isMobile ? globalMargins.tiny : 0,
        }}
      >
        <Button type="Primary" label="Start a Chat" onClick={() => onChat()} />
        <Button
          style={{marginLeft: globalMargins.xtiny}}
          type="Danger"
          label="Ignore request"
          onClick={() => onIgnoreRequest()}
        />
      </Box>
    </Box>
  )
}
