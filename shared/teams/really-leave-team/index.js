// @flow
import * as React from 'react'
import {Avatar, Box, Text, Icon, Button, MaybePopup, ButtonBar} from '../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../styles'

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
        You will lose access to all the {props.name} chats and folders, and you won't be able to get back
        unless an admin invites you.
      </Text>
      <ButtonBar direction={isMobile ? 'column' : 'row'} fullWidth={isMobile}>
        <Button type="Secondary" onClick={props.onClose} label="Cancel" />
        <Button type="Danger" onClick={props.onLeave} label={`Yes, leave ${props.name}`} fullWidth={true} />
      </ButtonBar>
    </Box>
  </MaybePopup>
)

export default ReallyLeaveTeam
