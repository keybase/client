// @flow
import * as React from 'react'
import {Avatar, Box, Button, ClickableBox, Usernames, PopupMenu} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

// For use in list RowRenderer prop
export type Props = {
  username: string,
  following: boolean,
  teamname: string,
  you: ?string,
  showMenu: boolean,
  setShowMenu: (s: boolean) => void,
  onOpenProfile: (u: string) => void,
  onChat: () => void,
  onAcceptRequest: (role: 'owners' | 'admins' | 'writers' | 'readers', sendChatNotification: boolean) => void,
  onIgnoreRequest: () => void,
}

const teamRoleMap = {
  reader: 1,
  writer: 2,
  admin: 3,
  owner: 4,
}

function toRole(r: string) {
  return teamRoleMap[r.toLowerCase()]
}

export const TeamRequestRow = (props: Props) => {
  const {
    username,
    following,
    onOpenProfile,
    you,
    onAcceptRequest,
    onChat,
    onIgnoreRequest,
    showMenu,
    setShowMenu,
  } = props
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
        <Button type="Secondary" label="Chat" onClick={() => onChat()} />
        <Button
          style={{marginLeft: globalMargins.xtiny}}
          type="Secondary"
          label="Ignore"
          onClick={() => onIgnoreRequest()}
        />
        <Button
          style={{marginLeft: globalMargins.xtiny}}
          type="Primary"
          label="Accept"
          onClick={() => setShowMenu(true)}
        />
        {showMenu &&
          <PopupMenu
            items={[
              {onClick: () => onAcceptRequest(toRole('reader'), false), title: 'Reader'},
              {onClick: () => onAcceptRequest(toRole('writer'), false), title: 'Writer'},
              {onClick: () => onAcceptRequest(toRole('admin'), false), title: 'Admin', danger: true},
              {onClick: () => onAcceptRequest(toRole('OWNER'), false), title: 'Owner', danger: true},
            ]}
            onHidden={() => setShowMenu(false)}
            style={{position: 'absolute', right: globalMargins.tiny, top: globalMargins.large}}
          />}
      </Box>
    </Box>
  )
}
