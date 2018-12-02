// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/index'
import * as Styles from '../../../../../styles'
import UnfurlImage from '../image'

export type Props = {
  imageHeight: number,
  imageWidth: number,
  imageURL: string,
  isVideo: boolean,
  faviconURL?: string,
  onClose?: () => void,
}

class UnfurlGiphy extends React.Component<Props> {
  render() {
    return (
      <Kb.Box2 style={styles.container} gap="tiny" direction="horizontal">
        {!Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
        <Kb.Box2 style={styles.innerContainer} gap="xtiny" direction="vertical">
          <Kb.Box2 style={styles.siteNameContainer} fullWidth={true} gap="tiny" direction="horizontal">
            <Kb.Box2 direction="horizontal" gap="tiny">
              {!!this.props.faviconURL && <Kb.Image src={this.props.faviconURL} style={styles.favicon} />}
              <Kb.Text type="BodySmall">Giphy</Kb.Text>
            </Kb.Box2>
            {!!this.props.onClose && (
              <Kb.Icon
                type="iconfont-close"
                onClick={this.props.onClose}
                className="unfurl-closebox"
                fontSize={12}
              />
            )}
          </Kb.Box2>
          <UnfurlImage
            url={this.props.imageURL}
            height={this.props.imageHeight}
            width={this.props.imageWidth}
            isVideo={this.props.isVideo}
          />
        </Kb.Box2>
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
      paddingRight: 0,
    },
  }),
  favicon: {
    width: 16,
    height: 16,
    borderRadius: Styles.borderRadius,
  },
  siteNameContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      justifyContent: 'space-between',
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
      paddingBottom: Styles.globalMargins.xxtiny,
    },
  }),
  quoteContainer: {
    backgroundColor: Styles.globalColors.lightGrey,
    paddingLeft: Styles.globalMargins.xtiny,
    alignSelf: 'stretch',
  },
  imageContainer: Styles.platformStyles({
    isMobile: {
      alignSelf: 'flex-start',
      padding: Styles.globalMargins.xxtiny,
    },
  }),
  innerContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      minWidth: 150,
    },
    isMobile: {
      flex: 1,
      borderWidth: 1,
      borderRadius: Styles.borderRadius,
      borderColor: Styles.globalColors.lightGrey,
    },
  }),
})

export default UnfurlGiphy
