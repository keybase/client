import * as React from 'react'
import * as Kb from '../../../../../../common-adapters/index'
import * as Styles from '../../../../../../styles'
import {formatTimeForMessages} from '../../../../../../util/timestamp'
import UnfurlImage from '../image'

export type Props = {
  isCollapsed: boolean
  title: string
  url: string
  siteName: string
  description?: string
  publishTime?: number
  imageURL?: string
  imageHeight?: number
  imageWidth?: number
  imageIsVideo?: boolean
  faviconURL?: string
  onClose?: () => void
  onCollapse: () => void
  showImageOnSide: boolean
}

class UnfurlGeneric extends React.Component<Props> {
  render() {
    const showBottomImage =
      !!this.props.imageURL &&
      !!this.props.imageHeight &&
      !!this.props.imageWidth &&
      !this.props.showImageOnSide
    return (
      <Kb.Box2 style={styles.container} gap="tiny" direction="horizontal">
        {!Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
        <Kb.Box2 style={styles.innerContainer} gap="xxtiny" direction="vertical">
          <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal">
            {!!this.props.faviconURL && <Kb.Image src={this.props.faviconURL} style={styles.favicon} />}
            <Kb.BoxGrow>
              <Kb.Text type="BodySmall" lineClamp={1}>
                {this.props.siteName}
                {!!this.props.publishTime && (
                  <Kb.Text type="BodySmall">
                    {' '}
                    • Published {formatTimeForMessages(this.props.publishTime)}
                  </Kb.Text>
                )}
              </Kb.Text>
            </Kb.BoxGrow>
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
          {!!this.props.description && (
            <Kb.Text type="Body" lineClamp={5} selectable={true}>
              {this.props.description}
              {showBottomImage && (
                <>
                  {' '}
                  <Kb.Icon
                    boxStyle={styles.collapseBox}
                    noContainer={Styles.isMobile}
                    onClick={this.props.onCollapse}
                    sizeType="Tiny"
                    type={this.props.isCollapsed ? 'iconfont-caret-right' : 'iconfont-caret-down'}
                  />
                </>
              )}
            </Kb.Text>
          )}
          {showBottomImage && !this.props.isCollapsed && (
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <UnfurlImage
                url={this.props.imageURL || ''}
                linkURL={this.props.url}
                height={this.props.imageHeight || 0}
                width={this.props.imageWidth || 0}
                widthPadding={Styles.isMobile ? Styles.globalMargins.tiny : undefined}
                style={styles.bottomImage}
                isVideo={this.props.imageIsVideo || false}
                autoplayVideo={false}
              />
            </Kb.Box2>
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
      marginTop: Styles.globalMargins.xtiny,
    },
    isMobile: {
      alignSelf: 'center',
    },
  }),
  closeBox: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      marginLeft: 'auto',
    },
  }),
  collapseBox: Styles.platformStyles({
    isElectron: {
      display: 'inline',
    },
  }),
  container: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
    },
    isElectron: {
      maxWidth: 500,
    },
  }),
  favicon: Styles.platformStyles({
    common: {
      borderRadius: Styles.borderRadius,
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
      borderColor: Styles.globalColors.greyLight,
      borderRadius: Styles.borderRadius,
      borderWidth: 1,
      padding: Styles.globalMargins.xtiny,
    },
  }),
  quoteContainer: Styles.platformStyles({
    common: {
      alignSelf: 'stretch',
      backgroundColor: Styles.globalColors.greyLight,
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
    },
    isElectron: {
      minHeight: 16,
    },
    isMobile: {
      minHeight: 21,
    },
  }),
  url: {
    ...Styles.globalStyles.fontSemibold,
  },
})

export default UnfurlGeneric
