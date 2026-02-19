import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import WalletPopup from './wallet-popup'
import * as Wallets from '@/stores/wallets'
import {useState as useWalletsState} from '@/stores/wallets'
import {useConfigState} from '@/stores/config'

type OwnProps = {accountID: string}

const ReallyRemoveAccountPopup = (props: OwnProps) => {
  const {accountID} = props
  const waiting = C.Waiting.useAnyWaiting(Wallets.loadAccountsWaitingKey)
  const name = useWalletsState(s => s.accountMap.get(accountID)?.name) ?? ''
  const [showingToast, setShowToast] = React.useState(false)
  const attachmentRef = React.useRef<Kb.MeasureRef | null>(null)
  const setShowToastFalseLater = Kb.useTimeout(() => setShowToast(false), 2000)

  const copyToClipboard = useConfigState(s => s.dispatch.defer.copyToClipboard)

  const [sk, setSK] = React.useState('')
  const loading = !sk
  const getSecretKey = C.useRPC(T.RPCStellar.localGetWalletAccountSecretKeyLocalRpcPromise)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const removeAccount = useWalletsState(s => s.dispatch.removeAccount)
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
      headerStyle={Kb.Styles.collapseStyles([styles.background, styles.header])}
      bottomButtons={[
        <Kb.Button
          fullWidth={Kb.Styles.isMobile}
          key={0}
          label="Copy secret key"
          onClick={onCopy}
          type="Wallet"
          ref={attachmentRef}
          waiting={loading}
          disabled={waiting}
        />,
        <Kb.Button
          fullWidth={Kb.Styles.isMobile}
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
          type={Kb.Styles.isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={styles.icon}
        />
        <Kb.Box2 direction="vertical">
          <Kb.Text center={true} style={styles.warningText} type="Header">
            One last thing! Make sure you keep a copy of your secret key before removing{' '}
          </Kb.Text>
          <Kb.Text
            center={true}
            type="HeaderItalic"
            style={Kb.Styles.collapseStyles([styles.warningText, styles.mainText] as const)}
          >
            {name}.
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text center={true} type="BodySmall" style={styles.warningText}>
          If you save this secret key, you can use it in other wallets outside Keybase
        </Kb.Text>

        <Kb.Toast visible={showingToast} attachTo={attachmentRef} position="top center">
          {Kb.Styles.isMobile && <Kb.Icon type="iconfont-clipboard" color="white" />}
          <Kb.Text center={true} type="BodySmall" style={styles.toastText}>
            Copied to clipboard
          </Kb.Text>
        </Kb.Toast>
      </Kb.Box2>
      <Kb.SafeAreaView />
    </WalletPopup>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  background: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.yellow},
  }),
  flexOne: {flex: 1},
  header: {borderBottomWidth: 0},
  icon: Kb.Styles.platformStyles({
    common: {marginBottom: Kb.Styles.globalMargins.large},
    isElectron: {marginTop: Kb.Styles.globalMargins.medium},
    isMobile: {marginTop: Kb.Styles.globalMargins.xlarge},
  }),
  mainText: Kb.Styles.platformStyles({
    common: {paddingBottom: Kb.Styles.globalMargins.small},
    isElectron: {wordBreak: 'break-all'},
  }),
  toastText: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.white},
    isMobile: {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 5,
    },
  }),
  warningText: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.brown_75},
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.medium,
      paddingRight: Kb.Styles.globalMargins.medium,
    },
  }),
}))

export default ReallyRemoveAccountPopup
