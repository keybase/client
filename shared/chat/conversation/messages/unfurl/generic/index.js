// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/index'
import * as Styles from '../../../../../styles'
import {formatTimeForMessages} from '../../../../../util/timestamp'

export type Props = {
  title: string,
  url: string,
  siteName: string,
  description?: string,
  publishTime?: number,
  imageURL?: string,
  faviconURL?: string,
  onClose?: () => void,
  showImageOnSide: boolean,
}

class UnfurlGeneric extends React.PureComponent<Props> {
  render() {
    return (
      <Kb.Box2 style={styles.container} direction="horizontal">
        <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />
        <Kb.Box2 style={styles.innerContainer} gap="xxtiny" direction="vertical">
          <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal">
            {!!this.props.faviconURL && <Kb.Image src={this.props.faviconURL} style={styles.favicon} />}
            <Kb.Text type="BodySmall">
              {this.props.siteName}
              {!!this.props.publishTime && (
                <Kb.Text type="BodySmall">
                  {' '}
                  • Published {formatTimeForMessages(this.props.publishTime)}
                </Kb.Text>
              )}
            </Kb.Text>
            {!!this.props.onClose && (
              <Kb.Box2 direction="horizontal" style={styles.closeContainer}>
                <Kb.Icon type="iconfont-close" onClick={this.props.onClose} fontSize={10} />
              </Kb.Box2>
            )}
          </Kb.Box2>
          <Kb.Text type="BodyPrimaryLink" style={styles.url} onClickURL={this.props.url}>
            {this.props.title}
          </Kb.Text>
          {!!this.props.description && <Kb.Text type="Body">{this.props.description}</Kb.Text>}
          {!!this.props.imageURL &&
            !this.props.showImageOnSide && <Kb.Image src={this.props.imageURL} style={styles.bottomImage} />}
        </Kb.Box2>
        {!!this.props.imageURL &&
          this.props.showImageOnSide && <Kb.Image src={this.props.imageURL} style={styles.sideImage} />}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      maxWidth: 500,
    },
  }),
  quoteContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.lightGrey,
      paddingLeft: Styles.globalMargins.xtiny,
    },
    isElectron: {
      alignSelf: 'stretch',
    },
  }),
  innerContainer: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      paddingLeft: Styles.globalMargins.tiny,
      minWidth: 150,
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
  bottomImage: Styles.platformStyles({
    isElectron: {
      marginTop: Styles.globalMargins.tiny,
      maxWidth: 320,
      maxHeight: 180,
    },
  }),
  sideImage: Styles.platformStyles({
    isElectron: {
      maxWidth: 80,
      maxHeight: 80,
    },
  }),
  url: {
    ...Styles.globalStyles.fontSemibold,
  },
  favicon: Styles.platformStyles({
    common: {
      width: 16,
      height: 16,
    },
  }),
})

export default UnfurlGeneric
