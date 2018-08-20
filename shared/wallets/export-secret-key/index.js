// @flow
import * as React from 'react'
import {Box2, Button, CopyText, Icon, InfoNote, Text, iconCastPlatformStyles} from '../../common-adapters'
import {globalMargins, isMobile, styleSheetCreate} from '../../styles'
import WalletPopup from '../wallet-popup'

type Props = {
  secretKey: ?string,
  onClose: () => void,
  onLoadSecretKey: () => void,
  username: string,
}

export default class extends React.Component<Props> {
  componentWillMount() {
    this.props.onLoadSecretKey()
  }

  render() {
    return (
      <WalletPopup onClose={this.props.onClose}>
        <Icon
          type={isMobile ? 'icon-wallet-receive-64' : 'icon-wallet-receive-48'}
          style={iconCastPlatformStyles(styles.icon)}
        />
        <Text type="BodySmallSemibold">{this.props.username}’s wallet</Text>
        <Text type="Header" style={styles.headerText}>
          Secret key
        </Text>
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
        <Button label="Close" onClick={this.props.onClose} type="Secondary" />
      </WalletPopup>
    )
  }
}

const styles = styleSheetCreate({
  headerText: {
    marginBottom: globalMargins.medium,
  },
  icon: {
    marginBottom: globalMargins.small,
  },
  infoNoteText: {
    marginBottom: globalMargins.medium,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: globalMargins.medium,
  },
  secretKeyContainer: {
    marginBottom: globalMargins.medium,
    maxWidth: 272,
    width: '100%',
  },
})
