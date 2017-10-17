// @flow
import * as React from 'react'
import {Avatar, Box, Text, Icon, Button, MaybePopup} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'

type Props = {
  onClose: () => void,
  onLeave: () => void,
  name: string,
}

const ReallyLeaveTeam = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, padding: globalMargins.large}}>
      <Avatar teamname={props.name} size={64} />
      <Icon type="icon-team-leave-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
      <Text type="Header" style={{marginBottom: globalMargins.large, marginTop: globalMargins.large}}>
        Are you sure you want to leave {props.name}?
      </Text>
      <Text type="Body" style={{maxWidth: 430, textAlign: 'center'}}>
        You will lose access to all the
        {' '}
        {props.name}
        {' '}
        chats and folders, and you won't be able to get back unless an admin invites you.
      </Text>
      <Box
        style={{
          ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
          flex: 1,
        }}
      >
        <Button
          type="Secondary"
          onClick={props.onClose}
          label="Cancel"
          style={
            isMobile
              ? {marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}
              : {marginRight: globalMargins.tiny}
          }
        />
        <Button type="Danger" onClick={props.onLeave} label={`Yes, leave ${props.name}`} />
      </Box>
    </Box>
  </MaybePopup>
)

export default ReallyLeaveTeam
