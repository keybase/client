// @flow
import * as React from 'react'
import {Box2, Button, CopyText, Divider, Icon, Text, iconCastPlatformStyles} from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'

type AddressesProps = {|
  federatedAddress?: string,
  stellarAddress: string,
|}

type Props = {|
  ...AddressesProps,
  accountName: string,
  isDefaultAccount: boolean,
  onClose: () => void,
  onRequest: () => void,
|}

const ReceiveModal = (props: Props) => {
  const header = (
    <>
      <Text type="BodySmallSemibold" style={styles.accountNameText}>
        {props.accountName}
      </Text>
      <Text type={Styles.isMobile ? 'BodyBig' : 'Header'} style={styles.headerText}>
        Receive
      </Text>
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
      <Box2 centerChildren={true} direction="vertical" fullWidth={true} style={styles.sidePaddings}>
        <Icon
          type={Styles.isMobile ? 'icon-wallet-receive-64' : 'icon-wallet-receive-48'}
          style={iconCastPlatformStyles(styles.icon)}
        />
        {!Styles.isMobile && header}
        {props.isDefaultAccount && (
          <Button
            type="Wallet"
            label="Request from a Keybase user"
            onClick={props.onRequest}
            style={styles.requestButton}
            fullWidth={true}
          >
            <Icon
              type="iconfont-stellar-request"
              fontSize={Styles.isMobile ? 22 : 16}
              color={Styles.globalColors.white}
              style={iconCastPlatformStyles(styles.requestIcon)}
            />
          </Button>
        )}
      </Box2>
      {props.isDefaultAccount && (
        <Divider
          style={{
            marginBottom: 14,
            marginTop: 10,
            width: '100%',
          }}
        />
      )}
      <Box2 direction="vertical" fullWidth={true} style={styles.sidePaddings}>
        <Text type="Body" style={styles.instructionText}>
          People outside Keybase can send to:
        </Text>
        <Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.stellarAddressesContainer}>
          <Addresses federatedAddress={props.federatedAddress} stellarAddress={props.stellarAddress} />
          {!Styles.isMobile && <Button label="Close" onClick={props.onClose} type="Secondary" />}
        </Box2>
      </Box2>
    </WalletPopup>
  )
}

const Addresses = ({federatedAddress, stellarAddress}: AddressesProps) => (
  <Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.stellarAddressesContainer}>
    {!!federatedAddress && (
      <Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.stellarAddressesContainer}>
        <Text type="BodySmallSemibold">Your "federated" Stellar address:</Text>
        <CopyText buttonType="Wallet" text={federatedAddress} />
      </Box2>
    )}
    <Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.stellarAddressesContainer}>
      <Text type="BodySmallSemibold">Your public Stellar address:</Text>
      <CopyText buttonType="Wallet" text={stellarAddress} />
    </Box2>
  </Box2>
)

const styles = Styles.styleSheetCreate({
  accountNameText: {
    textAlign: 'center',
  },
  container: Styles.platformStyles({
    common: {
      paddingLeft: 0,
      paddingRight: 0,
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
    common: {
      textAlign: 'center',
    },
    isElectron: {
      marginBottom: Styles.globalMargins.small,
    },
  }),
  icon: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.tiny,
    },
    isMobile: {
      marginBottom: Styles.globalMargins.medium,
    },
  }),
  infoNoteText: {
    marginBottom: Styles.globalMargins.medium,
    textAlign: 'center',
  },
  instructionText: {
    marginBottom: Styles.globalMargins.small,
    textAlign: 'center',
  },
  orText: {
    marginBottom: Styles.globalMargins.tiny,
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
