// @flow
import * as React from 'react'
import {Box2, Button, CopyText, Icon, InfoNote, Text, iconCastPlatformStyles} from '../../common-adapters'
import {globalMargins, isMobile, styleSheetCreate, platformStyles} from '../../styles'
import WalletPopup from '../wallet-popup'

type Props = {
  federatedAddress?: string,
  onClose: () => void,
  stellarAddress: string,
  username: string,
}

const ReceiveModal = (props: Props) => {
  const header = (
    <React.Fragment>
      <Text type="BodySmallSemibold">{props.username}’s account</Text>
      <Text type="BodyBig" style={styles.headerText}>
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
      customComponent={isMobile && mobileHeaderWrapper}
      containerStyle={styles.container}
    >
      <Icon
        type={isMobile ? 'icon-wallet-receive-64' : 'icon-wallet-receive-48'}
        style={iconCastPlatformStyles(styles.icon)}
      />
      {!isMobile && header}
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
      {!isMobile && <Button label="Close" onClick={props.onClose} type="Secondary" />}
    </WalletPopup>
  )
}

const styles = styleSheetCreate({
  container: platformStyles({
    isMobile: {
      paddingTop: globalMargins.medium,
      paddingBottom: globalMargins.xlarge,
    },
  }),
  header: platformStyles({
    isMobile: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      right: 0,
      top: 0,
      flex: 1,
    },
  }),
  headerText: platformStyles({
    common: {
      textAlign: 'center',
    },
    isElectron: {
      marginBottom: globalMargins.medium,
    },
  }),
  icon: platformStyles({
    isElectron: {
      marginBottom: globalMargins.small,
    },
    isMobile: {
      marginBottom: 50,
    },
  }),
  infoNoteText: {
    marginBottom: globalMargins.medium,
    textAlign: 'center',
  },
  instructionText: platformStyles({
    common: {
      textAlign: 'center',
    },
    isElectron: {
      marginBottom: globalMargins.medium,
    },
    isMobile: {marginBottom: globalMargins.small},
  }),
  orText: {
    marginBottom: globalMargins.tiny,
  },
  stellarAddressContainer: {
    marginBottom: globalMargins.tiny,
    width: '100%',
  },
  federatedAddressContainer: {
    marginBottom: globalMargins.medium,
    width: '100%',
  },
})

export default ReceiveModal
