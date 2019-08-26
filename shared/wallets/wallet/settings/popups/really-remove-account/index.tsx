import React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {WalletPopup} from '../../../../common'

type Props = {
  name: string
  loading: boolean
  waiting: boolean
  onCopyKey: () => void
  onFinish: () => void
  onCancel: () => void
  onLoadSecretKey: () => void
  onSecretKeySeen: () => void
}

const ReallyRemoveAccountPopup = (props: Props) => {
  const [showingToast, setShowToast] = React.useState(false)
  const attachmentRef = React.useRef<Kb.Button>(null)
  const setShowToastFalseLater = Kb.useTimeout(() => setShowToast(false), 2000)
  React.useEffect(() => {
    props.onLoadSecretKey()
    return () => {
      props.onSecretKeySeen()
    } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const {onCopyKey} = props
  const onCopy = React.useCallback(() => {
    setShowToast(true)
    onCopyKey()
    setShowToastFalseLater()
  }, [onCopyKey, setShowToastFalseLater])
  return (
    <WalletPopup
      onExit={props.onCancel}
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
          waiting={props.loading}
          disabled={props.waiting}
        />,
        <Kb.Button
          fullWidth={Styles.isMobile}
          key={1}
          label="Finish"
          onClick={props.onFinish}
          type="Dim"
          waiting={props.waiting}
          disabled={props.loading}
        />,
      ]}
      safeAreaViewBottomStyle={styles.background}
      safeAreaViewTopStyle={styles.background}
    >
      <Kb.Box2 centerChildren={true} direction="vertical" style={styles.flexOne} fullWidth={true}>
        <Kb.Icon
          type={Styles.isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={Kb.iconCastPlatformStyles(styles.icon)}
        />
        <Kb.Box2 direction="vertical">
          <Kb.Text center={true} style={styles.warningText} type="Header">
            One last thing! Make sure you keep a copy of your secret key before removing{' '}
          </Kb.Text>
          <Kb.Text
            center={true}
            type="HeaderItalic"
            style={Styles.collapseStyles([styles.warningText, styles.mainText])}
          >
            {props.name}.
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text center={true} type="BodySmall" style={styles.warningText}>
          If you save this secret key, you can use it in other wallets outside Keybase, or even import it back
          into Keybase later.
        </Kb.Text>

        <Kb.Toast visible={showingToast} attachTo={() => attachmentRef.current} position={'top center'}>
          {Styles.isMobile && <Kb.Icon type="iconfont-clipboard" color="white" fontSize={22} />}
          <Kb.Text center={true} type="BodySmall" style={styles.toastText}>
            Copied to clipboard
          </Kb.Text>
        </Kb.Toast>
      </Kb.Box2>
      <Kb.SafeAreaView />
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate({
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
})

export default ReallyRemoveAccountPopup
