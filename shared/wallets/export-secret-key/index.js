// @flow
import * as React from 'react'
import {Box2, Button, CopyText, Icon, InfoNote, Text, iconCastPlatformStyles} from '../../common-adapters'
import {globalMargins, isMobile, styleSheetCreate, platformStyles} from '../../styles'
import WalletPopup from '../wallet-popup'

type Props = {
  secretKey: ?string,
  onClose: () => void,
  onLoadSecretKey: () => void,
  username: string,
}

export default class ExportSecretKeyPopup extends React.Component<Props> {
  componentWillMount() {
    this.props.onLoadSecretKey()
  }

  render() {
    const header = (
      <React.Fragment>
        <Text type="BodySmallSemibold">{this.props.username}’s account</Text>
        <Text type="BodyBig" style={styles.headerText}>
          Secret key
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
        onClose={this.props.onClose}
        customCancelText="Close"
        customComponent={isMobile && mobileHeaderWrapper}
        containerStyle={styles.container}
      >
        <Icon
          type={isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={iconCastPlatformStyles(styles.icon)}
        />
        {!isMobile && header}
        {!!this.props.secretKey && (
          <Box2 direction="vertical" style={styles.secretKeyContainer}>
            <CopyText withReveal={true} text={this.props.secretKey} />
          </Box2>
        )}
        <InfoNote>
          <Text type="BodySmall" style={styles.infoNoteText}>
            Only paste your secret key in 100% safe places.
          </Text>
        </InfoNote>
        {!isMobile && <Button label="Close" onClick={this.props.onClose} type="Secondary" />}
      </WalletPopup>
    )
  }
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
  progressContainer: {
    marginBottom: globalMargins.medium,
  },
  secretKeyContainer: platformStyles({
    common: {
      width: '100%',
    },
    isElectron: {
      maxWidth: 272,
      marginBottom: globalMargins.medium,
    },
    isMobile: {
      marginBottom: globalMargins.xlarge,
    },
  }),
})
