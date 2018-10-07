// @flow
import * as React from 'react'
import {Box2, Button, CopyText, Icon, InfoNote, Text, iconCastPlatformStyles} from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'

type Props = {
  federatedAddress?: string,
  onClose: () => void,
  stellarAddress: string,
  username: string,
}

const ReceiveModal = (props: Props) => {
  const header = (
    <React.Fragment>
      <Text type="BodySmallSemibold">
        {props.username}
        ’s account
      </Text>
      <Text type={Styles.isMobile ? 'BodyBig' : 'Header'} style={styles.headerText}>
        Receive
      </Text>
    </React.Fragment>
  )

  const mobileHeaderWrapper = (
    <Box2 direction="horizontal" centerChildren={true} style={styles.header}>
      <Box2 direction="vertical">{header}</Box2>
    </Box2>
  )

  return (
    <WalletPopup
      onClose={props.onClose}
      customCancelText="Close"
      customComponent={Styles.isMobile && mobileHeaderWrapper}
      containerStyle={styles.container}
    >
      <Icon
        type={Styles.isMobile ? 'icon-wallet-receive-64' : 'icon-wallet-receive-48'}
        style={iconCastPlatformStyles(styles.icon)}
      />
      {!Styles.isMobile && header}
      <Text type="Body" style={styles.instructionText}>
        To receive Lumens or assets from non-Keybase users, pass your Stellar addresses around:
      </Text>
      <Box2 direction="vertical" style={styles.stellarAddressContainer}>
        <CopyText text={props.stellarAddress} />
      </Box2>
      {!!props.federatedAddress && (
        <React.Fragment>
          <Text type="Body" style={styles.orText}>
            or
          </Text>
          <Box2 direction="vertical" style={styles.federatedAddressContainer}>
            <CopyText text={props.federatedAddress} />
          </Box2>
        </React.Fragment>
      )}
      <InfoNote>
        <Text type="BodySmall" style={styles.infoNoteText}>
          Use the chat interface to request Lumens from a Keybase user.
        </Text>
      </InfoNote>
      {!Styles.isMobile && <Button label="Close" onClick={props.onClose} type="Secondary" />}
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isMobile: {
      paddingTop: Styles.globalMargins.medium,
      paddingBottom: Styles.globalMargins.xlarge,
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
      marginBottom: Styles.globalMargins.medium,
    },
  }),
  icon: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.small,
    },
    isMobile: {
      marginBottom: 50,
    },
  }),
  infoNoteText: {
    marginBottom: Styles.globalMargins.medium,
    textAlign: 'center',
  },
  instructionText: Styles.platformStyles({
    common: {
      textAlign: 'center',
    },
    isElectron: {
      marginBottom: Styles.globalMargins.medium,
    },
    isMobile: {marginBottom: Styles.globalMargins.small},
  }),
  orText: {
    marginBottom: Styles.globalMargins.tiny,
  },
  stellarAddressContainer: {
    marginBottom: Styles.globalMargins.tiny,
    width: '100%',
  },
  federatedAddressContainer: {
    marginBottom: Styles.globalMargins.medium,
    width: '100%',
  },
})

export default ReceiveModal
