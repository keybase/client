// @flow
import * as React from 'react'
import {Avatar, Box, Button, ClickableBox, Text} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

// For use in list RowRenderer prop
export type Props = {
  username: string,
  teamname: string,
  you: ?string,
  onOpenProfile: (u: string) => void,
  onChat: () => void,
  onAcceptRequest: (role: 'owners' | 'admins' | 'writers' | 'readers', sendChatNotification: boolean) => void,
  onIgnoreRequest: () => void,
}

export const TeamRequestRow = (props: Props) => {
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
      key={props.username}
    >
      <ClickableBox
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flexGrow: 1,
          flexShrink: 0,
          width: isMobile ? '100%' : 'initial',
        }}
        onClick={() => props.onOpenProfile(props.username)}
      >
        <Avatar username={props.username} size={isMobile ? 48 : 32} />
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
          <Text type={props.you === props.username ? 'BodySemiboldItalic' : 'BodySemibold'}>
            {props.username}
          </Text>
        </Box>
      </ClickableBox>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          marginTop: isMobile ? globalMargins.tiny : 0,
        }}
      >
        <Button type="Primary" label="Start a Chat" onClick={() => props.onChat()} />
        <Button
          style={{marginLeft: globalMargins.xtiny}}
          type="Danger"
          label="Ignore request"
          onClick={() => props.onIgnoreRequest()}
        />
      </Box>
    </Box>
  )
}
