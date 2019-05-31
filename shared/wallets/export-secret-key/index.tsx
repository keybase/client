import * as React from 'react'
import {
  Box2,
  Button,
  CopyText,
  Icon,
  ProgressIndicator,
  Text,
  iconCastPlatformStyles,
} from '../../common-adapters'
import * as Styles from '../../styles'
import {SmallAccountID, WalletPopup} from '../common'
import * as Types from '../../constants/types/wallets'

type Props = {
  accountID: Types.AccountID
  accountName: string
  secretKey: string
  onClose: () => void
  onLoadSecretKey: () => void
  onSecretKeySeen: () => void
  username: string
}

export default class ExportSecretKeyPopup extends React.Component<Props> {
  componentDidMount() {
    this.props.onLoadSecretKey()
  }
  componentWillUnmount() {
    this.props.onSecretKeySeen()
  }

  render() {
    const header = (
      <React.Fragment>
        {this.props.accountName ? (
          <Text type="BodySmallSemibold">{this.props.accountName}</Text>
        ) : (
          <SmallAccountID accountID={this.props.accountID} />
        )}
        <Text center={true} type={Styles.isMobile ? 'BodyBig' : 'Header'} style={styles.headerText}>
          Secret key
        </Text>
      </React.Fragment>
    )

    return (
      <WalletPopup
        onExit={this.props.onClose}
        backButtonType="close"
        accountName={this.props.accountName}
        headerTitle="Secret key"
        containerStyle={styles.container}
      >
        <Icon
          type={Styles.isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={iconCastPlatformStyles(styles.icon)}
        />
        {!Styles.isMobile && header}
        <Box2 direction="horizontal" style={styles.warningContainer}>
          <Text center={true} type="BodySmallSemibold" style={styles.warningText}>
            Only paste your secret key in 100% safe places. Anyone with this key could steal your
            Stellar&nbsp;account.
          </Text>
        </Box2>
        <Box2 direction="vertical" fullWidth={true} style={styles.secretKeyContainer}>
          <CopyText multiline={true} withReveal={true} text={this.props.secretKey} />
          {!this.props.secretKey && (
            <Box2 direction="horizontal" gap="tiny" fullWidth={true} style={styles.progressContainer}>
              <ProgressIndicator style={styles.progressIndicator} type="Small" />
              <Text type="BodySmall">fetching and decrypting secret key...</Text>
            </Box2>
          )}
        </Box2>
        {!Styles.isMobile && <Button label="Close" onClick={this.props.onClose} type="Dim" />}
      </WalletPopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isMobile: {
      paddingBottom: Styles.globalMargins.xlarge,
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
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
  progressContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.fillAbsolute,
      alignItems: 'center',
      backgroundColor: Styles.globalColors.white_90,
      display: 'flex',
      justifyContent: 'center',
    },
  }),
  progressIndicator: Styles.platformStyles({
    isElectron: {
      height: 17,
      width: 17,
    },
    isMobile: {
      height: 22,
      width: 22,
    },
  }),
  secretKeyContainer: Styles.platformStyles({
    common: {
      position: 'relative',
    },
    isElectron: {
      marginBottom: Styles.globalMargins.medium,
    },
  }),
  warningContainer: {
    backgroundColor: Styles.globalColors.yellow,
    borderRadius: Styles.borderRadius,
    marginBottom: Styles.globalMargins.medium,
    padding: Styles.globalMargins.xsmall,
    width: '100%',
  },
  warningText: {
    color: Styles.globalColors.brown_75,
  },
})
