import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/chat2'
import MessagePopup from '../messages/message-popup'
import {Video, ResizeMode} from 'expo-av'
import logger from '../../../logger'
import {ShowToastAfterSaving} from '../messages/attachment/shared'
import type {Props} from '.'

const AutoMaxSizeImage = (p: {source: {uri: string}; onLoad: () => void; opacity: number}) => {
  const {source, onLoad, opacity} = p
  const {uri} = source
  const [width, setWidth] = React.useState(0)
  const [height, setHeight] = React.useState(0)

  React.useEffect(() => {
    Kb.NativeImage.getSize(uri, (width, height) => {
      const clamped = Constants.clampImageSize(
        width,
        height,
        Styles.dimensionWidth,
        Styles.dimensionHeight - (Styles.isIOS ? 40 : 0)
      )
      setWidth(clamped.width)
      setHeight(clamped.height)
    })
  }, [uri])

  return (
    <Kb.ZoomableBox
      contentContainerStyle={[
        styles.zoomableBoxContainer,
        {height, maxHeight: height, maxWidth: width, width},
      ]}
      maxZoom={10}
      style={styles.zoomableBox}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      <Kb.NativeFastImage
        onLoad={onLoad}
        source={source}
        resizeMode={ResizeMode.CONTAIN}
        style={[styles.fastImage, {height, opacity, width}]}
      />
    </Kb.ZoomableBox>
  )
}

const Fullscreen = (p: Props) => {
  const {path, previewHeight, message, onAllMedia, onClose, isVideo} = p
  const [loaded, setLoaded] = React.useState(false)

  const {toggleShowingPopup, showingPopup, popup} = Kb.usePopup(attachTo => (
    <MessagePopup
      attachTo={attachTo}
      conversationIDKey={message.conversationIDKey}
      ordinal={message.id}
      onHidden={toggleShowingPopup}
      position="bottom left"
      visible={showingPopup}
    />
  ))

  let content: React.ReactNode = null
  let spinner: React.ReactNode = null
  if (path) {
    if (isVideo) {
      content = (
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          centerChildren={true}
          style={styles.videoWrapper}
        >
          <Video
            source={{uri: `${path}&contentforce=true`}}
            onError={e => {
              logger.error(`Error loading vid: ${JSON.stringify(e)}`)
            }}
            onLoad={() => setLoaded(true)}
            shouldPlay={false}
            useNativeControls={true}
            style={{
              height: Math.max(previewHeight, 100),
              width: '100%',
            }}
            resizeMode={ResizeMode.CONTAIN}
          />
        </Kb.Box2>
      )
    } else {
      content = (
        <AutoMaxSizeImage source={{uri: `${path}`}} onLoad={() => setLoaded(true)} opacity={loaded ? 1 : 0} />
      )
    }
  }
  if (!loaded) {
    spinner = (
      <Kb.Box2
        direction="vertical"
        style={styles.progressWrapper}
        centerChildren={true}
        fullHeight={true}
        fullWidth={true}
      >
        <Kb.ProgressIndicator style={styles.progressIndicator} white={true} />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2
      direction="vertical"
      style={{backgroundColor: Styles.globalColors.blackOrBlack}}
      fullWidth={true}
      fullHeight={true}
    >
      {spinner}
      <ShowToastAfterSaving transferState={message.transferState} />
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerWrapper}>
        <Kb.Text type="Body" onClick={onClose} style={styles.close}>
          Close
        </Kb.Text>
        <Kb.Text type="Body" onClick={onAllMedia} style={styles.allMedia}>
          All media
        </Kb.Text>
      </Kb.Box2>
      <Kb.BoxGrow>{content}</Kb.BoxGrow>
      <Kb.Button icon="iconfont-ellipsis" style={styles.headerFooter} onClick={toggleShowingPopup} />
      {popup}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      allMedia: {
        backgroundColor: Styles.globalColors.blackOrBlack,
        color: Styles.globalColors.blueDark,
        marginLeft: 'auto',
        padding: Styles.globalMargins.small,
      },
      assetWrapper: {
        ...Styles.globalStyles.flexBoxCenter,
        flex: 1,
      },
      close: {
        backgroundColor: Styles.globalColors.blackOrBlack,
        color: Styles.globalColors.blueDark,
        padding: Styles.globalMargins.small,
      },
      fastImage: {
        height: Styles.dimensionHeight,
        width: Styles.dimensionWidth,
      },
      headerFooter: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.blackOrBlack,
        bottom: Styles.globalMargins.small,
        flexShrink: 0,
        height: 34,
        left: Styles.globalMargins.small,
        position: 'absolute',
        width: 34,
        zIndex: 3,
      },
      headerWrapper: {backgroundColor: Styles.globalColors.blackOrBlack},
      progressIndicator: {
        width: 48,
      },
      progressWrapper: {
        position: 'absolute',
      },
      safeAreaTop: {
        ...Styles.globalStyles.flexBoxColumn,
        ...Styles.globalStyles.fillAbsolute,
        backgroundColor: Styles.globalColors.blackOrBlack,
      },
      videoWrapper: {
        position: 'relative',
      },
      zoomableBox: {
        backgroundColor: Styles.globalColors.blackOrBlack,
        height: '100%',
        position: 'relative',
        width: '100%',
      },
      zoomableBoxContainer: {
        flex: 1,
        position: 'relative',
      },
    } as const)
)

export default Fullscreen
