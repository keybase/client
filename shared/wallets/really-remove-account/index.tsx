import * as C from '../../constants'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as RPCStellarTypes from '../../constants/types/rpc-stellar-gen'
import * as React from 'react'
import * as Styles from '../../styles'
import WalletPopup from '../wallet-popup'

type OwnProps = {accountID: string}

const ReallyRemoveAccountPopup = (props: OwnProps) => {
  const {accountID} = props
  const waiting = Container.useAnyWaiting(Constants.loadAccountsWaitingKey)
  const name = C.useWalletsState(s => s.accountMap.get(accountID)?.name) ?? ''
  const [showingToast, setShowToast] = React.useState(false)
  const attachmentRef = React.useRef<Kb.ClickableBox>(null)
  const setShowToastFalseLater = Kb.useTimeout(() => setShowToast(false), 2000)

  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)

  const [sk, setSK] = React.useState('')
  const loading = !sk
  const getSecretKey = Container.useRPC(RPCStellarTypes.localGetWalletAccountSecretKeyLocalRpcPromise)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const removeAccount = C.useWalletsState(s => s.dispatch.removeAccount)
  const onFinish = () => {
    removeAccount(accountID)
    navigateUp()
  }

  React.useEffect(() => {
    setSK('')
    getSecretKey(
      [{accountID}],
      r => {
        setSK(r)
      },
      () => {}
    )
  }, [getSecretKey, accountID])

  const onCopy = React.useCallback(() => {
    setShowToast(true)
    setShowToastFalseLater()
    copyToClipboard(sk)
  }, [copyToClipboard, setShowToastFalseLater, sk])
  return (
    <WalletPopup
      onExit={onCancel}
      backButtonType="cancel"
      containerStyle={styles.background}
      headerStyle={Styles.collapseStyles([styles.background, styles.header])}
      bottomButtons={[
        <Kb.Button
          fullWidth={Styles.isMobile}
          key={0}
          label="Copy secret key"
          onClick={onCopy}
          type="Wallet"
          ref={attachmentRef}
          waiting={loading}
          disabled={waiting}
        />,
        <Kb.Button
          fullWidth={Styles.isMobile}
          key={1}
          label="Finish"
          onClick={onFinish}
          type="Dim"
          waiting={waiting}
          disabled={loading}
        />,
      ]}
      safeAreaViewBottomStyle={styles.background}
      safeAreaViewTopStyle={styles.background}
    >
      <Kb.Box2 centerChildren={true} direction="vertical" style={styles.flexOne} fullWidth={true}>
        <Kb.Icon
          type={Styles.isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={styles.icon}
        />
        <Kb.Box2 direction="vertical">
          <Kb.Text center={true} style={styles.warningText} type="Header">
            One last thing! Make sure you keep a copy of your secret key before removing{' '}
          </Kb.Text>
          <Kb.Text
            center={true}
            type="HeaderItalic"
            style={Styles.collapseStyles([styles.warningText, styles.mainText] as const)}
          >
            {name}.
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text center={true} type="BodySmall" style={styles.warningText}>
          If you save this secret key, you can use it in other wallets outside Keybase
        </Kb.Text>

        <Kb.Toast visible={showingToast} attachTo={() => attachmentRef.current} position="top center">
          {Styles.isMobile && <Kb.Icon type="iconfont-clipboard" color="white" />}
          <Kb.Text center={true} type="BodySmall" style={styles.toastText}>
            Copied to clipboard
          </Kb.Text>
        </Kb.Toast>
      </Kb.Box2>
      <Kb.SafeAreaView />
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  background: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.yellow},
  }),
  flexOne: {flex: 1},
  header: {borderBottomWidth: 0},
  icon: Styles.platformStyles({
    common: {marginBottom: Styles.globalMargins.large},
    isElectron: {marginTop: Styles.globalMargins.medium},
    isMobile: {marginTop: Styles.globalMargins.xlarge},
  }),
  mainText: Styles.platformStyles({
    common: {paddingBottom: Styles.globalMargins.small},
    isElectron: {wordBreak: 'break-all'},
  }),
  toastText: Styles.platformStyles({
    common: {color: Styles.globalColors.white},
    isMobile: {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 5,
    },
  }),
  warningText: Styles.platformStyles({
    common: {color: Styles.globalColors.brown_75},
    isMobile: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
  }),
}))

export default ReallyRemoveAccountPopup
