// @flow
import * as React from 'react'
import {
  Box,
  Text,
  ClickableBox,
  Icon,
  ProgressBar,
  ProgressIndicator,
  iconCastPlatformStyles,
} from '../../../../../common-adapters'
import {
  globalStyles,
  globalMargins,
  globalColors,
  fileUIName,
  platformStyles,
  styleSheetCreate,
  collapseStyles,
} from '../../../../../styles'
import {ImageRender} from './image-render'
import {isMobile} from '../../../../../util/container'

type Props = {
  arrowColor: string,
  hasProgress: boolean,
  height: number,
  onClick: () => void,
  onShowInFinder: null | (() => void),
  path: string,
  progress: number,
  progressLabel: string,
  showPlayButton: boolean,
  title: string,
  toggleShowingMenu: () => void,
  width: number,
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
        style={styles.imageContainer}
        onClick={this.props.onClick}
        onLongPress={this.props.toggleShowingMenu}
      >
        <Text type="BodySemibold" style={styles.title}>
          {this.props.title}
        </Text>
        <Box
          style={collapseStyles([
            styles.loading,
            !this.state.loaded && styles.spinner,
            {
              height: this.props.height,
              width: this.props.width,
            },
          ])}
        >
          {!!this.props.path && (
            <ImageRender
              src={this.props.path}
              onLoad={this._setLoaded}
              loaded={this.state.loaded}
              style={collapseStyles([
                styles.image,
                {
                  height: this.props.height,
                  opacity: this.state.loaded ? 1 : 0,
                  width: this.props.width,
                },
              ])}
            />
          )}
          {!this.state.loaded && <ProgressIndicator style={styles.progress} />}
          {this.props.showPlayButton && (
            <Icon type="icon-play-64" style={iconCastPlatformStyles(styles.playButton)} />
          )}
          {!!this.props.arrowColor && (
            <Box style={styles.downloadedIconWrapper}>
              <Icon
                type="iconfont-download"
                style={iconCastPlatformStyles(styles.downloadIcon)}
                color={this.props.arrowColor}
              />
            </Box>
          )}
        </Box>
        <Box style={styles.progressContainer}>
          <Text type={'BodySmall'} style={styles.progressLabel}>
            {this.props.progressLabel ||
              '\u00A0' /* always show this so we don't change sizes when we're uploading. This is a short term thing, ultimately we should hoist this type of overlay up over the content so it can go away and we won't be left with a gap */}
          </Text>
          {this.props.hasProgress && <ProgressBar ratio={this.props.progress} />}
        </Box>
        {this.props.onShowInFinder && (
          <Text
            type="BodySmallPrimaryLink"
            onClick={this.props.onShowInFinder}
            style={styles.link}
            className={!isMobile ? 'hover-underline' : undefined}
          >
            Show in {fileUIName}
          </Text>
        )}
      </ClickableBox>
    )
  }
}

const styles = styleSheetCreate({
  spinner: platformStyles({
    isElectron: {
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
    },
    isMobile: {
      ...globalStyles.flexBoxCenter,
      alignItems: 'center',
      margin: 'auto',
      flex: 1,
    },
  }),
  downloadIcon: {maxHeight: 14},
  downloadedIconWrapper: {
    ...globalStyles.flexBoxCenter,
    backgroundColor: globalColors.fastBlank,
    borderRadius: 20,
    bottom: 0,
    padding: 3,
    position: 'absolute',
    right: 0,
  },
  image: {
    backgroundColor: globalColors.fastBlank,
    maxWidth: 320,
    position: 'relative',
  },
  imageContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    padding: globalMargins.xtiny,
    width: '100%',
  },
  link: {
    color: globalColors.black_60,
  },
  loading: {
    backgroundColor: globalColors.black_05,
    borderRadius: globalMargins.xtiny,
    maxWidth: 320,
    position: 'relative',
  },
  playButton: {
    bottom: '50%',
    left: '50%',
    marginBottom: -32,
    marginLeft: -32,
    marginRight: -32,
    marginTop: -32,
    position: 'absolute',
    right: '50%',
    top: '50%',
  },
  progressContainer: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  progressLabel: {
    color: globalColors.black_40,
    marginRight: globalMargins.tiny,
  },
  title: platformStyles({
    isElectron: {
      wordBreak: 'break-word',
    },
    isMobile: {
      backgroundColor: globalColors.fastBlank,
    },
  }),
  progress: platformStyles({
    isElectron: {
      margin: 'auto',
    },
    isMobile: {
      width: 48,
      position: 'absolute',
      margin: 'auto',
    },
  }),
})

export default ImageAttachment
