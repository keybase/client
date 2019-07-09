import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'
import QRCodeGen from 'qrcode-generator'

type AddressesProps = {
  federatedAddress?: string
  stellarAddress: string
}

type Props = {
  accountName: string
  isDefaultAccount: boolean
  onClose: () => void
  onRequest: () => void
} & AddressesProps

const ReceiveModal = (props: Props) => {
  const header = (
    <>
      <Kb.Text center={true} type="BodySmallSemibold">
        {props.accountName}
      </Kb.Text>
      <Kb.Text center={true} type={Styles.isMobile ? 'BodyBig' : 'Header'} style={styles.headerText}>
        Receive
      </Kb.Text>
    </>
  )

  return (
    <WalletPopup
      accountName={props.accountName}
      headerTitle="Receive"
      backButtonType="close"
      onExit={props.onClose}
      containerStyle={styles.container}
    >
      <Kb.Box2 centerChildren={true} direction="vertical" fullWidth={true} style={styles.sidePaddings}>
        <Kb.Icon
          type={Styles.isMobile ? 'icon-wallet-receive-64' : 'icon-wallet-receive-48'}
          style={Kb.iconCastPlatformStyles(styles.icon)}
        />
        {!Styles.isMobile && header}
        {props.isDefaultAccount && (
          <Kb.Button
            type="Wallet"
            label="Request from a Keybase user"
            onClick={props.onRequest}
            style={styles.requestButton}
            fullWidth={true}
          >
            <Kb.Icon
              type="iconfont-stellar-request"
              sizeType="Small"
              color={Styles.globalColors.white}
              style={Kb.iconCastPlatformStyles(styles.requestIcon)}
            />
          </Kb.Button>
        )}
      </Kb.Box2>
      {props.isDefaultAccount && (
        <Kb.Divider
          style={{
            marginBottom: 14,
            marginTop: 10,
            width: '100%',
          }}
        />
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.sidePaddings}>
        <Kb.Text center={true} type="Body" style={styles.instructionText}>
          People outside Keybase can send to:
        </Kb.Text>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.stellarAddressesContainer}>
          <Addresses federatedAddress={props.federatedAddress} stellarAddress={props.stellarAddress} />
          {!Styles.isMobile && (
            <Kb.Button label="Close" onClick={props.onClose} type="Dim" style={styles.closeButton} />
          )}
        </Kb.Box2>
      </Kb.Box2>
    </WalletPopup>
  )
}

const Addresses = ({federatedAddress, stellarAddress}: AddressesProps) => (
  <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.stellarAddressesContainer}>
    {!!federatedAddress && (
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.stellarAddressesContainer}>
        <Kb.Text type="BodySmallSemibold">Your "federated" Stellar address:</Kb.Text>
        <Kb.CopyText buttonType="Wallet" text={federatedAddress} />
      </Kb.Box2>
    )}
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.stellarAddressesContainer}>
      <Kb.Text type="BodySmallSemibold">Your public Stellar address:</Kb.Text>
      <Kb.CopyText buttonType="Wallet" text={stellarAddress} />
    </Kb.Box2>
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.stellarAddressesContainer}>
      <Kb.Text type="BodySmallSemibold">Your Stellar QR code:</Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.qrContainer} centerChildren={true}>
        {/* use federatedAddress if available when more of the ecosystem supports it */}
        <QrImage address={stellarAddress} />
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

const QrImage = ({address}) => {
  const qr = QRCodeGen(4, 'L')
  qr.addData(address)
  qr.make()
  const size = qr.getModuleCount() * (6 / 2) // retina
  // Purple2
  const url = qr.createDataURL(8, 0, [0x84, 0x5c, 0xdb])
  return <Kb.Image src={url} style={{height: size, width: size}} />
}

const styles = Styles.styleSheetCreate({
  closeButton: {
    alignSelf: 'center',
  },
  container: Styles.platformStyles({
    common: {
      paddingLeft: 0,
      paddingRight: 0,
    },
    isElectron: {
      paddingBottom: 0,
      paddingTop: 0,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.xlarge,
      paddingTop: Styles.globalMargins.medium,
    },
  }),
  header: Styles.platformStyles({
    isMobile: {
      ...Styles.globalStyles.fillAbsolute,
      flex: 1,
    },
  }),
  headerText: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.small,
    },
  }),
  icon: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.xtiny,
    },
    isMobile: {
      marginBottom: Styles.globalMargins.medium,
    },
  }),
  instructionText: {
    marginBottom: Styles.globalMargins.small,
  },
  orText: {
    marginBottom: Styles.globalMargins.tiny,
  },
  qrContainer: {
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.tiny,
  },
  requestButton: {
    flex: 0,
    width: '100%',
  },
  requestIcon: {marginRight: Styles.globalMargins.tiny},
  sidePaddings: {
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  stellarAddressesContainer: {
    alignItems: 'flex-start',
  },
})

export default ReceiveModal
