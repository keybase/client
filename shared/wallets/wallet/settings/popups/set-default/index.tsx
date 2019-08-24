import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {WalletPopup} from '../../../../common'

type Props = {
  accountName: string
  onAccept: () => void
  onClose: () => void
  username: string
  waiting: boolean
}

const SetDefaultAccountPopup = (props: Props) => {
  const buttons = [
    <Kb.Button
      key={0}
      fullWidth={Styles.isMobile}
      type="Dim"
      onClick={props.onClose}
      label="Cancel"
      disabled={props.waiting}
    />,
    <Kb.Button
      key={1}
      waiting={props.waiting}
      fullWidth={Styles.isMobile}
      type="Wallet"
      onClick={props.onAccept}
      label="Set as default account"
    />,
  ]

  return (
    <WalletPopup
      onExit={props.onClose}
      backButtonType="cancel"
      headerStyle={styles.header}
      bottomButtons={Styles.isMobile ? buttons.reverse() : buttons}
    >
      <Kb.Box2 centerChildren={true} direction="vertical" style={styles.flexOne} fullWidth={true}>
        <Kb.Box style={styles.avatarAndIcon}>
          <Kb.Icon type={Styles.isMobile ? 'icon-wallet-64' : 'icon-wallet-48'} />
          <Kb.Avatar size={32} username={props.username} style={Kb.avatarCastPlatformStyles(styles.avatar)} />
        </Kb.Box>
        <Kb.Text
          center={true}
          type="Header"
          style={Styles.collapseStyles([styles.mainText, styles.sidePaddings])}
        >
          Set <Kb.Text type="HeaderItalic">{props.accountName}</Kb.Text> as your default Keybase account?
        </Kb.Text>
        <Kb.Text center={true} type="Body" style={styles.sidePaddings}>
          All transactions and overall activity with <Kb.Text type="BodyItalic">{props.accountName}</Kb.Text>{' '}
          will now be tied to your Keybase identity. Your account's name remains encrypted and only visible to
          you.
        </Kb.Text>
      </Kb.Box2>
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate({
  avatar: Styles.platformStyles({
    common: {position: 'absolute'},
    isElectron: {
      left: -12,
      top: 26,
    },
    isMobile: {
      bottom: -2,
      left: -8,
    },
  }),
  avatarAndIcon: Styles.platformStyles({
    common: {
      marginBottom: Styles.globalMargins.large,
      position: 'relative',
    },
    isMobile: {marginTop: Styles.globalMargins.large},
  }),
  flexOne: {flex: 1},
  header: {
    borderBottomWidth: 0,
  },
  mainText: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
    },
    isElectron: {marginBottom: Styles.globalMargins.medium},
    isMobile: {marginBottom: Styles.globalMargins.small},
  }),
  sidePaddings: Styles.platformStyles({
    isMobile: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
  }),
})

export default SetDefaultAccountPopup
