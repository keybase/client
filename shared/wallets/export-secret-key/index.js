// @flow
import * as React from 'react'
import {
  Box2,
  Button,
  CopyText,
  Icon,
  InfoNote,
  MaybePopup,
  Text,
  iconCastPlatformStyles,
} from '../../common-adapters'
import {globalMargins, isMobile, platformStyles, styleSheetCreate} from '../../styles'

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
      <MaybePopup onClose={this.props.onClose}>
        <Box2 direction="vertical" style={containerStyle}>
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
        </Box2>
      </MaybePopup>
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

const containerStyle = platformStyles({
  common: {
    alignItems: 'center',
    maxWidth: 460,
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
  },
  isElectron: {
    paddingBottom: globalMargins.xlarge,
    paddingTop: globalMargins.xlarge,
    textAlign: 'center',
  },
  isMobile: {
    paddingBottom: globalMargins.medium,
    paddingTop: globalMargins.medium,
  },
})
