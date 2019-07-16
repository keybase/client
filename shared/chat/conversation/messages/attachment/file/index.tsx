import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type Props = {
  arrowColor: string
  onDownload?: () => void
  onShowInFinder?: () => void
  title: string
  fileName: string
  progress: number
  progressLabel: string
  hasProgress: boolean
  errorMsg: string
}

class FileAttachment extends React.PureComponent<Props> {
  render() {
    const iconType = 'icon-file-32'
    return (
      <Kb.ClickableBox onClick={this.props.onDownload} style={styles.fullWidth}>
        <Kb.Box style={styles.containerStyle}>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" centerChildren={true}>
            <Kb.Icon type={iconType} style={Kb.iconCastPlatformStyles(styles.iconStyle)} />
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.titleStyle}>
              <Kb.Text type="BodySemibold">{this.props.title}</Kb.Text>
              {this.props.fileName !== this.props.title && (
                <Kb.Text type="BodyTiny">{this.props.fileName}</Kb.Text>
              )}
            </Kb.Box2>
          </Kb.Box2>
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
          {!!this.props.errorMsg && (
            <Kb.Box style={styles.progressContainerStyle}>
              <Kb.Text type="BodySmall" style={styles.error}>
                Failed to download attachment, please retry
              </Kb.Text>
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
  error: {color: Styles.globalColors.redDark},
  fullWidth: {width: '100%'},
  iconStyle: {
    height: 32,
    width: 32,
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
    flex: 1,
  },
})

export default FileAttachment
