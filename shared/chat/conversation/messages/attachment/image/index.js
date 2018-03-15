// @flow
import * as React from 'react'
import {Box, Text, ClickableBox, Icon, ProgressBar} from '../../../../../common-adapters'
import {globalStyles, globalMargins, globalColors, fileUIName, platformStyles} from '../../../../../styles'
import {ImageRender} from './image-render'

type Props = {
  arrowColor: string,
  height: number,
  isPreviewLoaded: boolean,
  loadPreview: null | (() => void),
  onClick: () => void,
  onShowMenu: () => void,
  onShowInFinder: null | (() => void),
  path: string,
  title: string,
  width: number,
  progress: number,
  progressLabel: string,
}

class ImageAttachment extends React.PureComponent<Props> {
  componentWillMount() {
    if (this.props.loadPreview) {
      this.props.loadPreview()
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.loadPreview && !this.props.loadPreview) {
      nextProps.loadPreview()
    }
  }

  render() {
    return (
      <ClickableBox
        style={imageContainerStyle}
        onClick={this.props.onClick}
        onLongPress={this.props.onShowMenu}
      >
        <Text type="BodySemibold" style={titleStyle}>
          {this.props.title}
        </Text>
        <Box
          style={{
            ...(this.props.isPreviewLoaded ? loadedStyle : loadingStyle),
            height: this.props.height,
            width: this.props.width,
          }}
        >
          {!!this.props.path && (
            <ImageRender
              src={this.props.path}
              style={{
                ...imageStyle,
                height: this.props.height,
                width: this.props.width,
              }}
            />
          )}
          {!!this.props.arrowColor && (
            <Box style={downloadedIconWrapperStyle}>
              <Icon type="iconfont-download" style={{color: this.props.arrowColor, maxHeight: 14}} />
            </Box>
          )}
        </Box>
        {!!this.props.progressLabel && (
          <Box style={progressContainerStyle}>
            <Text type={'BodySmall'} style={progressLabelStyle}>
              {this.props.progressLabel}
            </Text>
            <ProgressBar ratio={this.props.progress} />
          </Box>
        )}
        {this.props.onShowInFinder && (
          <Text type="BodySmallPrimaryLink" onClick={this.props.onShowInFinder} style={linkStyle}>
            Show in {fileUIName}
          </Text>
        )}
      </ClickableBox>
    )
  }
}

const titleStyle = platformStyles({
  isMobile: {
    backgroundColor: globalColors.fastBlank,
  },
  isElectron: {
    wordBreak: 'break-word',
  },
})

const progressLabelStyle = {
  color: globalColors.black_40,
  marginRight: globalMargins.tiny,
}

const downloadedIconWrapperStyle = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.fastBlank,
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

const imageContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  padding: globalMargins.xtiny,
  width: '100%',
}

const imageStyle = {
  backgroundColor: globalColors.fastBlank,
  maxWidth: 320,
  position: 'relative',
}

const loadedStyle = {
  ...imageStyle,
}

const loadingStyle = {
  ...imageStyle,
  backgroundColor: globalColors.black_05,
  borderRadius: globalMargins.xtiny,
}

const linkStyle = {
  color: globalColors.black_60,
}

export default ImageAttachment
