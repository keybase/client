// @flow
import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import {formatTimeForMessages} from '../../../../../../util/timestamp'
import UnfurlImage from '../image'

export type Props = {
  title: string,
  url: string,
  siteName: string,
  description?: string,
  publishTime?: number,
  imageURL?: string,
  imageHeight?: number,
  imageWidth?: number,
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
          {!!this.props.description && <Kb.Text type="Body" lineClamp={5}>{this.props.description}</Kb.Text>}
          {!!this.props.imageURL &&
            !!this.props.imageHeight &&
            !!this.props.imageWidth &&
            !Styles.isMobile &&
            !this.props.showImageOnSide && (
              <UnfurlImage
                url={this.props.imageURL}
                height={this.props.imageHeight}
                width={this.props.imageWidth}
                style={styles.bottomImage}
                isVideo={false}
              />
            )}
        </Kb.Box2>
        {!!this.props.imageURL &&
          !Styles.isMobile &&
          this.props.showImageOnSide && <Kb.Image src={this.props.imageURL} style={styles.sideImage} />}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
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
  quoteContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.lightGrey,
      paddingLeft: Styles.globalMargins.xtiny,
      alignSelf: 'stretch',
    },
  }),
  innerContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      minWidth: 150,
    },
    isMobile: {
      borderWidth: 1,
      borderRadius: Styles.borderRadius,
      borderColor: Styles.globalColors.lightGrey,
      padding: Styles.globalMargins.tiny,
    },
  }),
  siteNameContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      justifyContent: 'space-between',
    },
  }),
  closeBox: Styles.platformStyles({
    isElectron: {
      marginLeft: 'auto',
      alignSelf: 'flex-start',
    },
  }),
  bottomImage: {
    marginTop: Styles.globalMargins.xtiny,
  },
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
      borderRadius: Styles.borderRadius,
    },
  }),
})

export default UnfurlGeneric
