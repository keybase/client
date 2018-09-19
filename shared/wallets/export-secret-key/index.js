// @flow
import * as React from 'react'
import {Box2, Button, CopyText, Icon, InfoNote, Text, iconCastPlatformStyles} from '../../common-adapters'
import * as Styles from '../../styles'
import {WalletPopup} from '../common'

type Props = {
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
        <Text type="BodySmallSemibold">{this.props.username}’s account</Text>
        <Text type={Styles.isMobile ? 'BodyBig' : 'Header'} style={styles.headerText}>
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
        customComponent={Styles.isMobile && mobileHeaderWrapper}
        containerStyle={styles.container}
      >
        <Icon
          type={Styles.isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={iconCastPlatformStyles(styles.icon)}
        />
        {!Styles.isMobile && header}
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
      marginBottom: Styles.globalMargins.xlarge,
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
      maxWidth: 272,
      marginBottom: Styles.globalMargins.medium,
    },
    isMobile: {
      marginBottom: Styles.globalMargins.xlarge,
    },
  }),
})
