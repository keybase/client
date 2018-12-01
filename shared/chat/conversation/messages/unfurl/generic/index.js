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

class UnfurlGeneric extends React.Component<Props> {
  render() {
    return (
      <Kb.Box2 style={styles.container} gap="tiny" direction="horizontal">
        {!Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
        <Kb.Box2 style={styles.innerContainer} gap="xxtiny" direction="vertical">
          <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal">
            <Kb.Box2 direction="horizontal" gap="tiny">
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
            </Kb.Box2>
            {!!this.props.onClose && (
              <Kb.Icon
                type="iconfont-close"
                onClick={this.props.onClose}
                style={styles.closeBox}
                className="unfurl-closebox"
                fontSize={12}
              />
            )}
          </Kb.Box2>
          <Kb.Text type="BodyPrimaryLink" style={styles.url} onClickURL={this.props.url}>
            {this.props.title}
          </Kb.Text>
          {!!this.props.description && <Kb.Text type="Body">{this.props.description}</Kb.Text>}
          {!!this.props.imageURL && !Styles.isMobile && !this.props.showImageOnSide && (
            <Kb.Image src={this.props.imageURL} style={styles.bottomImage} />
          )}
        </Kb.Box2>
        {!!this.props.imageURL && !Styles.isMobile && this.props.showImageOnSide && (
          <Kb.Image src={this.props.imageURL} style={styles.sideImage} />
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  bottomImage: Styles.platformStyles({
    common: {
      marginTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      maxHeight: 180,
      maxWidth: 320,
    },
  }),
  closeBox: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      marginLeft: 'auto',
    },
  }),
  container: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
    },
    isElectron: {
      maxWidth: 500,
    },
    isMobile: {
      paddingRight: 66,
    },
  }),
  favicon: Styles.platformStyles({
    common: {
      height: 16,
      width: 16,
    },
  }),
  innerContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      minWidth: 150,
    },
    isMobile: {
      borderColor: Styles.globalColors.lightGrey,
      borderRadius: Styles.borderRadius,
      borderWidth: 1,
      padding: Styles.globalMargins.tiny,
    },
  }),
  quoteContainer: Styles.platformStyles({
    common: {
      alignSelf: 'stretch',
      backgroundColor: Styles.globalColors.lightGrey,
      paddingLeft: Styles.globalMargins.xtiny,
    },
  }),
  sideImage: Styles.platformStyles({
    isElectron: {
      maxHeight: 80,
      maxWidth: 80,
    },
  }),
  siteNameContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      justifyContent: 'space-between',
    },
  }),
  url: {
    ...Styles.globalStyles.fontSemibold,
  },
})

export default UnfurlGeneric
