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
}

export const TeamRequestRow = (props: Props) => {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 0,
        height: isMobile ? 56 : 48,
        padding: globalMargins.tiny,
        width: '100%',
      }}
    >
      <ClickableBox
        style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}
        onClick={() => props.onOpenProfile(props.username)}
      >
        <Avatar username={props.username} size={isMobile ? 48 : 32} />
        <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.small}}>
          <Text type={props.you === props.username ? 'BodySemiboldItalic' : 'BodySemibold'}>
            {props.username}
          </Text>
        </Box>
      </ClickableBox>
      <Button type="Primary" label="Start a Chat" onClick={() => props.onChat()} />
    </Box>
  )
}
