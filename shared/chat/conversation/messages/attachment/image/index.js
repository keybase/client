// @flow
import * as React from 'react'
import {Box, Text, ClickableBox, Icon, ProgressBar} from '../../../../../common-adapters'
import {globalStyles, globalMargins, globalColors, fileUIName, platformStyles} from '../../../../../styles'
import {ImageRender} from './image-render'
import {isMobile} from '../../../../../util/container'

type Props = {
  arrowColor: string,
  height: number,
  onClick: () => void,
  onShowInFinder: null | (() => void),
  path: string,
  title: string,
  toggleShowingMenu: () => void,
  width: number,
  progress: number,
  progressLabel: string,
  hasProgress: boolean,
}

type State = {
  loaded: boolean,
}

class ImageAttachment extends React.PureComponent<Props, State> {
  state = {loaded: false}
  _setLoaded = () => this.setState({loaded: true})
  render() {
    return (
      <ClickableBox
        style={imageContainerStyle}
        onClick={this.props.onClick}
        onLongPress={this.props.toggleShowingMenu}
      >
        <Text type="BodySemibold" style={titleStyle}>
          {this.props.title}
        </Text>
        <Box
          style={{
            ...loadingStyle,
            height: this.props.height,
            width: this.props.width,
          }}
        >
          {!!this.props.path && (
            <ImageRender
              src={this.props.path}
              onLoad={this._setLoaded}
              style={{
                ...imageStyle,
                height: this.props.height,
                width: this.props.width,
                opacity: this.state.loaded ? 1 : 0,
              }}
            />
          )}
          {!!this.props.arrowColor && (
            <Box style={downloadedIconWrapperStyle}>
              <Icon type="iconfont-download" style={{maxHeight: 14}} color={this.props.arrowColor} />
            </Box>
          )}
        </Box>
        <Box style={progressContainerStyle}>
          <Text type={'BodySmall'} style={progressLabelStyle}>
            {this.props.progressLabel ||
              '\u00A0' /* always show this so we don't change sizes when we're uploading. This is a short term thing, ultimately we should hoist this type of overlay up over the content so it can go away and we won't be left with a gap */}
          </Text>
          {this.props.hasProgress && <ProgressBar ratio={this.props.progress} />}
        </Box>
        {this.props.onShowInFinder && (
          <Text
            type="BodySmallPrimaryLink"
            onClick={this.props.onShowInFinder}
            style={linkStyle}
            className={!isMobile ? 'hover-underline' : undefined}
          >
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

const loadingStyle = {
  ...imageStyle,
  backgroundColor: globalColors.black_05,
  borderRadius: globalMargins.xtiny,
}

const linkStyle = {
  color: globalColors.black_60,
}

export default ImageAttachment
