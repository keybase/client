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
  const styles = useStyles()
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
    <Kb.ModalScreen
      padding="none"
      footer={
        <Kb.Box2 direction={isMobile ? 'vertical' : 'horizontal'} gap="tiny" fullWidth={true}>
          <Kb.Button
            fullWidth={isMobile}
            label="Copy secret key"
            onClick={onCopy}
            type="Default"
            ref={attachmentRef}
            waiting={loading}
            disabled={waiting}
            style={styles.button}
          />
          <Kb.Button
            fullWidth={isMobile}
            label="Finish"
            onClick={onFinish}
            type="Dim"
            waiting={waiting}
            disabled={loading}
            style={styles.button}
          />
        </Kb.Box2>
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" gap="tiny" style={styles.container}>
        <Kb.IconAuto
          type={isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={styles.icon}
        />
        <Kb.Text center={true} style={styles.warningText} type="BodyBig">
          One last thing! Make sure you keep a copy of your secret key before removing{' '}
          <Kb.Text type="BodyBigExtrabold" style={styles.warningText}>
            {name}
          </Kb.Text>
          .
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
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  button: Kb.Styles.platformStyles({isElectron: {flex: 1}}),
  container: {
    backgroundColor: theme.yellow,
    flexGrow: 1,
    justifyContent: 'center',
    padding: Kb.Styles.globalMargins.medium,
  },
  icon: {marginBottom: Kb.Styles.globalMargins.small},
  toastText: Kb.Styles.platformStyles({
    common: {color: theme.white},
    isMobile: {
      ...Kb.Styles.paddingH(10),
      paddingTop: 5,
    },
  }),
  warningText: Kb.Styles.platformStyles({
    common: {color: theme.brown_75},
    isElectron: {wordBreak: 'break-word'},
  }),
}))

export default ReallyRemoveAccountPopup
