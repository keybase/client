import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
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
  const onFinish = () => {
    deleteAccount([{accountID, userAcknowledged: 'yes'}, loadAccountsWaitingKey], () => {
      C.Router2.navigateUp()
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
    <>
      {isMobile && <Kb.SafeAreaViewTop style={styles.background} />}
      <Kb.ScrollView
        alwaysBounceVertical={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
          <Kb.IconAuto
            type={isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
            style={styles.icon}
          />
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
          <Kb.Text center={true} type="BodySmall" style={styles.warningText}>
            If you save this secret key, you can use it in other wallets outside Keybase
          </Kb.Text>

          <Kb.Toast visible={showingToast} attachTo={attachmentRef} position="top center">
            {isMobile && <Kb.Icon type="iconfont-clipboard" color="white" />}
            <Kb.Text center={true} type="BodySmall" style={styles.toastText}>
              Copied to clipboard
            </Kb.Text>
          </Kb.Toast>
        </Kb.Box2>
      </Kb.ScrollView>
      <Kb.ModalFooter>
        <Kb.ButtonBar direction={isMobile ? 'column' : 'row'} fullWidth={isMobile} style={styles.buttonBar}>
          <Kb.Button
            fullWidth={isMobile}
            label="Copy secret key"
            onClick={onCopy}
            type="Default"
            ref={attachmentRef}
            waiting={loading}
            disabled={waiting}
          />
          <Kb.Button
            fullWidth={isMobile}
            label="Finish"
            onClick={onFinish}
            type="Dim"
            waiting={waiting}
            disabled={loading}
          />
        </Kb.ButtonBar>
      </Kb.ModalFooter>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  background: {backgroundColor: Kb.Styles.globalColors.yellow},
  buttonBar: Kb.Styles.platformStyles({
    isElectron: {minHeight: 0},
  }),
  container: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.yellow,
      flexGrow: 1,
    },
    isElectron: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xlarge, Kb.Styles.globalMargins.medium),
      textAlign: 'center',
    },
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
  scrollContent: {...Kb.Styles.globalStyles.flexBoxColumn, ...Kb.Styles.globalStyles.flexGrow},
  scrollView: Kb.Styles.globalStyles.flexOne,
  toastText: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.white},
    isMobile: {
      ...Kb.Styles.paddingH(10),
      paddingTop: 5,
    },
  }),
  warningText: Kb.Styles.platformStyles({
    common: {color: Kb.Styles.globalColors.brown_75},
    isMobile: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.medium),
    },
  }),
}))

export default ReallyRemoveAccountPopup
