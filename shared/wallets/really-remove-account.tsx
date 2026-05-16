import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import WalletPopup from './wallet-popup'
import {loadAccountsWaitingKey} from '@/constants/strings'
import {copyToClipboard} from '@/util/storeless-actions'

type OwnProps = {
  accountID: string
  name: string
}

const ReallyRemoveAccountPopup = (props: OwnProps) => {
  const {accountID, name} = props
  const waiting = C.Waiting.useAnyWaiting(loadAccountsWaitingKey)
  const [showingToast, setShowToast] = React.useState(false)
  const attachmentRef = React.useRef<Kb.MeasureRef | null>(null)
  const setShowToastFalseLater = Kb.useTimeout(() => setShowToast(false), 2000)

  const [secretKeyState, setSecretKeyState] = React.useState({accountID: '', sk: ''})
  const sk = secretKeyState.accountID === accountID ? secretKeyState.sk : ''
  const loading = !sk
  const getSecretKey = C.useRPC(T.RPCStellar.localGetWalletAccountSecretKeyLocalRpcPromise)
  const deleteAccount = C.useRPC(T.RPCStellar.localDeleteWalletAccountLocalRpcPromise)
  const navigateUp = C.Router2.navigateUp
  const onFinish = () => {
    deleteAccount([{accountID, userAcknowledged: 'yes'}, loadAccountsWaitingKey], () => {
      navigateUp()
    }, () => {})
  }

  React.useEffect(() => {
    let canceled = false
    getSecretKey(
      [{accountID}],
      r => {
        if (!canceled) {
          setSecretKeyState({accountID, sk: r})
        }
      },
      () => {}
    )
    return () => {
      canceled = true
    }
  }, [getSecretKey, accountID])

  const onCopy = () => {
    setShowToast(true)
    setShowToastFalseLater()
    copyToClipboard(sk)
  }
  return (
    <WalletPopup
      containerStyle={styles.background}
      bottomButtons={[
        <Kb.Button
          fullWidth={Kb.Styles.isMobile}
          key={0}
          label="Copy secret key"
          onClick={onCopy}
          type="Default"
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
      <Kb.Box2 centerChildren={true} direction="vertical" flex={1} fullWidth={true}>
        <Kb.ImageIcon
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
