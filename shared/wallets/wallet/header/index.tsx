import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/wallets'
import * as Styles from '../../../styles'
import {SendButton, SmallAccountID} from '../../common'
import MaybeSwitcher from './maybe-switcher'

type Props = {
  accountID: Types.AccountID
  isDefaultWallet: boolean
  keybaseUser: string
  onBack: (() => void) | null
  onReceive: () => void
  onSettings: () => void
  thisDeviceIsLockedOut: boolean
  unreadPayments: boolean
  walletName: string | null
}

const Header = (props: Props) => {
  const backButton = props.onBack && <Kb.BackButton onClick={props.onBack} style={styles.backButton} />
  // Only show caret/unread badge when we have a switcher,
  // i.e. when isMobile is true.
  const caret = Styles.isMobile && (
    <Kb.Icon key="icon" type="iconfont-caret-down" style={styles.caret} sizeType="Tiny" />
  )
  const unread = Styles.isMobile && props.unreadPayments && (
    <Kb.Box2 direction="vertical" style={styles.unread} />
  )
  const nameAndInfo = props.walletName ? (
    <MaybeSwitcher>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          gap="xtiny"
          centerChildren={true}
          style={styles.topContainer}
        >
          {backButton}
          {props.isDefaultWallet && <Kb.Avatar size={16} username={props.keybaseUser} />}
          <Kb.Text type="BodyBig">{props.walletName}</Kb.Text>
          {caret}
          {unread}
        </Kb.Box2>
        {props.isDefaultWallet && (
          <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
            <Kb.Text type="BodySmall">Default Keybase account</Kb.Text>
          </Kb.Box2>
        )}
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true}>
          <SmallAccountID accountID={props.accountID} style={styles.smallAccountID} />
        </Kb.Box2>
      </Kb.Box2>
    </MaybeSwitcher>
  ) : (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      gap="xtiny"
      centerChildren={true}
      style={styles.topContainer}
    >
      {backButton}
      <Kb.ProgressIndicator style={styles.spinner} type="Small" />
    </Kb.Box2>
  )
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      gap="tiny"
      gapStart={true}
      gapEnd={true}
      style={styles.container}
    >
      {nameAndInfo}
      <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
        <SendButton />
        <Kb.Button
          type="Wallet"
          mode="Secondary"
          onClick={props.onReceive}
          label="Receive"
          disabled={!props.walletName}
        />
        <Kb.Button
          onClick={props.onSettings}
          mode="Secondary"
          style={styles.settingsButton}
          type="Wallet"
        >
          <Kb.Icon type="iconfont-gear" style={styles.gear} />
        </Kb.Button>
      </Kb.Box2>
      {props.thisDeviceIsLockedOut && (
        <Kb.Text center={true} type="BodySmall">
          You can only send from a mobile device more than 7 days old.
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  backButton: {
    left: 0,
    position: 'absolute',
  },
  caret: {
    marginLeft: Styles.globalMargins.xtiny,
    width: 10,
  },
  container: {
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
    flexShrink: 0,
  },
  gear: {
    position: 'relative',
    top: 1,
  },
  settingsButton: {
    minWidth: undefined,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  },
  smallAccountID: {
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
    textAlign: 'center',
  },
  spinner: {
    height: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
  topContainer: {
    position: 'relative',
  },
  unread: {
    backgroundColor: Styles.globalColors.orange,
    borderRadius: 6,
    flexShrink: 0,
    height: Styles.globalMargins.tiny,
    marginLeft: -Styles.globalMargins.tiny,
    marginTop: -Styles.globalMargins.xtiny,
    width: Styles.globalMargins.tiny,
  },
})

export default Header
