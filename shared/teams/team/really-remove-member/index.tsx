import * as React from 'react'
import {Avatar, Box, Text, Icon, PopupDialog, Button, ButtonBar} from '../../../common-adapters'
import * as Styles from '../../../styles'

const MaybePopup = Styles.isMobile
  ? (props: {onClose: () => void; children: React.ReactNode}) => (
      <Box style={{height: '100%', width: '100%'}} children={props.children} />
    )
  : (props: {onClose: () => void; children: React.ReactNode}) => (
      <PopupDialog
        onClose={props.onClose}
        styleCover={styles.cover}
        styleContainer={styles.container}
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
    <Box
      style={{
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        padding: Styles.globalMargins.large,
      }}
    >
      <Avatar username={props.member} size={64} />
      <Icon type="icon-team-leave-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
      <Text
        type="Header"
        center={true}
        style={{marginBottom: Styles.globalMargins.large, marginTop: Styles.globalMargins.large}}
      >
        Are you sure you want to remove {props.member} from {props.name}?
      </Text>
      <Text center={true} type="Body" style={{maxWidth: 450}}>
        {props.member} will lose access to all the {props.name} chats and folders, and they won't be able to
        get back unless an admin invites them.
      </Text>
      <ButtonBar direction={Styles.isMobile ? 'column' : 'row'} fullWidth={Styles.isMobile}>
        <Button type="Dim" onClick={props.onClose} label="Cancel" />
        <Button
          type="Danger"
          onClick={props.onRemove}
          label={`Yes, remove ${props.member}`}
          fullWidth={Styles.isMobile}
        />
      </ButtonBar>
    </Box>
  </MaybePopup>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    height: '100%',
  },
  cover: {
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.black,
    justifyContent: 'stretch',
  },
}))

export default ReallyRemoveMember
