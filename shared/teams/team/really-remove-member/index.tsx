import * as React from 'react'
import {Avatar, Box, Text, Icon, PopupDialog, Button, ButtonBar} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../../styles'

const MaybePopup = isMobile
  ? (props: {onClose: () => void; children: React.ReactNode}) => (
      <Box style={{height: '100%', width: '100%'}} children={props.children} />
    )
  : (props: {onClose: () => void; children: React.ReactNode}) => (
      <PopupDialog
        onClose={props.onClose}
        styleCover={_styleCover}
        styleContainer={_styleContainer}
        children={props.children}
      />
    )

type Props = {
  onClose: () => void
  onRemove: () => void
  member: string
  name: string
}

const ReallyRemoveMember = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, padding: globalMargins.large}}>
      <Avatar username={props.member} size={64} />
      <Icon type="icon-team-leave-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
      <Text
        type="Header"
        center={true}
        style={{marginBottom: globalMargins.large, marginTop: globalMargins.large}}
      >
        Are you sure you want to remove {props.member} from {props.name}?
      </Text>
      <Text center={true} type="Body" style={{maxWidth: 450}}>
        {props.member} will lose access to all the {props.name} chats and folders, and they won't be able to
        get back unless an admin invites them.
      </Text>
      <ButtonBar direction={isMobile ? 'column' : 'row'} fullWidth={isMobile}>
        <Button type="Dim" onClick={props.onClose} label="Cancel" />
        <Button
          type="Danger"
          onClick={props.onRemove}
          label={`Yes, remove ${props.member}`}
          fullWidth={isMobile}
        />
      </ButtonBar>
    </Box>
  </MaybePopup>
)

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: globalColors.black,
  justifyContent: 'stretch',
}

const _styleContainer = {
  height: '100%',
}
export default ReallyRemoveMember
