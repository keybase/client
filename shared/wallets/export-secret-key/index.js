// @flow
import * as React from 'react'
import {Box2, Button, CopyText, Icon, Text, iconCastPlatformStyles} from '../../common-adapters'
import * as Styles from '../../styles'
import {SmallAccountID, WalletPopup} from '../common'
import * as Types from '../../constants/types/wallets'

type Props = {
  accountID: Types.AccountID,
  accountName: string,
  secretKey: ?string,
  onClose: () => void,
  onLoadSecretKey: () => void,
  username: string,
}

export default class ExportSecretKeyPopup extends React.Component<Props> {
  componentDidMount() {
    this.props.onLoadSecretKey()
  }

  render() {
    const header = (
      <React.Fragment>
        {this.props.accountName ? (
          <Text type="BodySmallSemibold">{this.props.accountName}</Text>
        ) : (
          <SmallAccountID accountID={this.props.accountID} />
        )}
        <Text type={Styles.isMobile ? 'BodyBig' : 'Header'} style={styles.headerText}>
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
          <Text backgroundMode="Information" type="BodySmallSemibold" style={styles.warningText}>
            Only paste your secret key in 100% safe places. Anyone with this key could steal your
            Stellar&nbsp;account.
          </Text>
        </Box2>
        {!!this.props.secretKey && (
          <Box2 direction="vertical" style={styles.secretKeyContainer}>
            <CopyText withReveal={true} text={this.props.secretKey} />
          </Box2>
        )}
        {!Styles.isMobile && <Button label="Close" onClick={this.props.onClose} type="Secondary" />}
      </WalletPopup>
    )
  }
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
  progressContainer: {
    marginBottom: Styles.globalMargins.medium,
  },
  secretKeyContainer: Styles.platformStyles({
    common: {
      width: '100%',
    },
    isElectron: {
      marginBottom: Styles.globalMargins.medium,
    },
    isMobile: {
      marginBottom: Styles.globalMargins.xlarge,
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
    textAlign: 'center',
  },
})
