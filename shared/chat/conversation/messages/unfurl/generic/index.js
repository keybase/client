// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/index'
import * as Styles from '../../../../../styles'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import {formatTimeForMessages} from '../../../../../util/timestamp'

export type Props = {
  title: string,
  url: string,
  siteName: string,
  description?: string,
  publishTime?: number,
  image?: RPCChatTypes.UnfurlImageDisplay,
  faviconURL?: string,
  onClose?: () => void,
}

class UnfurlGeneric extends React.PureComponent<Props> {
  render() {
    return (
      <Kb.Box2 style={styles.container} direction="horizontal">
        <Kb.Box2 style={styles.innerContainer} fullWidth={true} direction="vertical">
          <Kb.Box2 style={styles.siteNameContainer} fullWidth={true} direction="horizontal">
            {this.props.faviconURL && (
              <Kb.Image
                src={this.props.faviconURL}
                style={Styles.collapseStyles([{width: 16, height: 16}])}
              />
            )}
            <Kb.Text type="BodySmall" style={styles.siteName}>
              {this.props.siteName}
            </Kb.Text>
            {this.props.publishTime && (
              <Kb.Text type="BodySmall" style={styles.publishTime}>
                • Published {formatTimeForMessages(this.props.publishTime)}
              </Kb.Text>
            )}
            {this.props.onClose && (
              <Kb.Box2 direction="horizontal" style={styles.closeContainer}>
                <Kb.Icon type="iconfont-close" onClick={this.props.onClose} fontSize={10} />
              </Kb.Box2>
            )}
          </Kb.Box2>
          <Kb.Text type="BodyPrimaryLink" style={styles.url} onClickURL={this.props.url}>
            {this.props.title}
          </Kb.Text>
          {this.props.description && <Kb.Text type="Body">{this.props.description}</Kb.Text>}
          {this.props.image && (
            <Kb.Image
              src={this.props.image.url}
              style={Styles.collapseStyles([
                styles.image,
                {
                  maxWidth: 320,
                  maxHeight: 180,
                },
              ])}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.lightGrey,
      maxWidth: 500,
    },
  }),
  innerContainer: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      marginLeft: 4,
      paddingLeft: 8,
    },
  }),
  siteNameContainer: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
    },
  }),
  closeContainer: Styles.platformStyles({
    isElectron: {
      marginLeft: 'auto',
      alignSelf: 'flex-start',
    },
  }),
  siteName: Styles.platformStyles({
    isElectron: {
      marginLeft: 8,
    },
  }),
  image: Styles.platformStyles({
    isElectron: {
      marginTop: 8,
    },
  }),
  url: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.fontSemibold,
    },
    isElectron: {
      marginTop: 3,
    },
  }),
  publishTime: Styles.platformStyles({
    isElectron: {
      marginLeft: 4,
    },
  }),
})

export default UnfurlGeneric
