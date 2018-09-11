// @flow
import * as React from 'react'
import {Icon, Text, ClickableBox, Box, ProgressBar} from '../../../../../common-adapters'
import {globalStyles, globalMargins, globalColors, fileUIName} from '../../../../../styles'

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
      <ClickableBox onClick={this.props.onDownload}>
        <Box style={containerStyle}>
          <Box style={titleStyle}>
            <Icon type={iconType} style={iconStyle} />
            <Text type="BodySemibold">{this.props.title}</Text>
          </Box>
          {!!this.props.arrowColor && (
            <Box style={downloadedIconWrapperStyle}>
              <Icon type="iconfont-download" style={{maxHeight: 14}} color={this.props.arrowColor} />
            </Box>
          )}
          {!!this.props.progressLabel && (
            <Box style={progressContainerStyle}>
              <Text type="BodySmall" style={progressLabelStyle}>
                {this.props.progressLabel}
              </Text>
              {this.props.hasProgress && <ProgressBar ratio={this.props.progress} />}
            </Box>
          )}
          {this.props.onShowInFinder && (
            <Text type="BodySmallPrimaryLink" onClick={this.props.onShowInFinder} style={linkStyle}>
              Show in {fileUIName}
            </Text>
          )}
        </Box>
      </ClickableBox>
    )
  }
}

const progressLabelStyle = {
  color: globalColors.black_40,
  marginRight: globalMargins.tiny,
}

const iconStyle = {
  height: 24,
  marginRight: globalMargins.tiny,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
}

const titleStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  padding: globalMargins.tiny,
}

const downloadedIconWrapperStyle = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.white,
  borderRadius: 20,
  bottom: 0,
  padding: 3,
  position: 'absolute',
  right: 0,
}

const progressContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const linkStyle = {
  color: globalColors.black_60,
}

export default FileAttachment
