import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
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

const ReceiveModal = (props: Props) => (
  <Kb.Modal
    allowOverflow={true}
    footer={{
      content: (
        <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
          <Kb.Button fullWidth={true} label="Close" onClick={props.onClose} type="Dim" />
        </Kb.ButtonBar>
      ),
    }}
    header={{
      icon: !Styles.isMobile && <Kb.Icon type="icon-wallet-receive-48" style={styles.icon} />,
      leftButton: Styles.isMobile && (
        <Kb.Text type="BodyBigLink" onClick={props.onClose}>
          Close
        </Kb.Text>
      ),
      style: styles.header,
      subTitle: props.accountName,
      subTitleAbove: true,
      title: 'Receive',
    }}
    onClose={props.onClose}
  >
    {props.isDefaultAccount && (
      <>
        <Kb.Box2 centerChildren={true} direction="vertical" fullWidth={true} style={styles.container}>
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
              style={styles.requestIcon}
            />
          </Kb.Button>
        </Kb.Box2>
        <Kb.Divider />
      </>
    )}
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Text center={true} type="Body" style={styles.instructionText}>
        People outside Keybase can send to:
      </Kb.Text>
      <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.stellarAddressesContainer}>
        <Addresses federatedAddress={props.federatedAddress} stellarAddress={props.stellarAddress} />
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Modal>
)

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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      buttonBar: {
        minHeight: 'auto',
      },
      container: {
        ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
      },
      header: Styles.platformStyles({
        isElectron: {paddingTop: 20},
      }),
      icon: {
        position: 'absolute',
        top: -24,
      },
      instructionText: {
        marginBottom: Styles.globalMargins.small,
      },
      orText: {
        marginBottom: Styles.globalMargins.tiny,
      },
      qrContainer: {
        backgroundColor: Styles.globalColors.whiteOrWhite,
        borderColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        padding: Styles.globalMargins.tiny,
      },
      requestButton: {
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
    } as const)
)

export default ReceiveModal
