// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type Props = {
  arrowColor: string,
  onDownload: null | (() => void),
  onShowInFinder: null | (() => void),
  title: string,
  progress: number,
  progressLabel: string,
  hasProgress: boolean,
}

class FileAttachment extends React.PureComponent<Props> {
  render() {
    const iconType = 'icon-file-24' // TODO other states
    return (
      <Kb.ClickableBox onClick={this.props.onDownload} style={styles.fullWidth}>
        <Kb.Box style={styles.containerStyle}>
          <Kb.Box style={styles.titleStyle}>
            <Kb.Icon type={iconType} style={Kb.iconCastPlatformStyles(styles.iconStyle)} />
            <Kb.Text type="BodySemibold">{this.props.title}</Kb.Text>
          </Kb.Box>
          {!!this.props.arrowColor && (
            <Kb.Box style={styles.downloadedIconWrapperStyle}>
              <Kb.Icon
                type="iconfont-download"
                style={Kb.iconCastPlatformStyles(styles.downloadedIcon)}
                color={this.props.arrowColor}
              />
            </Kb.Box>
          )}
          {!!this.props.progressLabel && (
            <Kb.Box style={styles.progressContainerStyle}>
              <Kb.Text type="BodySmall" style={styles.progressLabelStyle}>
                {this.props.progressLabel}
              </Kb.Text>
              {this.props.hasProgress && <Kb.ProgressBar ratio={this.props.progress} />}
            </Kb.Box>
          )}
          {this.props.onShowInFinder && (
            <Kb.Text type="BodySmallPrimaryLink" onClick={this.props.onShowInFinder} style={styles.linkStyle}>
              Show in {Styles.fileUIName}
            </Kb.Text>
          )}
        </Kb.Box>
      </Kb.ClickableBox>
    )
  }
}

const styles = Styles.styleSheetCreate({
  containerStyle: {
    ...Styles.globalStyles.flexBoxColumn,
  },
  downloadedIcon: {
    maxHeight: 14,
    position: 'relative',
    top: 1,
  },
  downloadedIconWrapperStyle: {
    ...Styles.globalStyles.flexBoxCenter,
    backgroundColor: Styles.globalColors.white,
    borderRadius: 20,
    bottom: 0,
    padding: 3,
    position: 'absolute',
    right: 0,
  },
  fullWidth: {width: '100%'},
  iconStyle: {
    height: 24,
    marginRight: Styles.globalMargins.tiny,
  },
  linkStyle: {
    color: Styles.globalColors.black_50,
  },
  progressContainerStyle: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  progressLabelStyle: {
    color: Styles.globalColors.black_50,
    marginRight: Styles.globalMargins.tiny,
  },
  titleStyle: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    padding: Styles.globalMargins.tiny,
  },
})

export default FileAttachment
