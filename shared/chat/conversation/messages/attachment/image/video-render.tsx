import * as React from 'react'
import * as Styles from '../../../../../styles'
import * as Kb from '../../../../../common-adapters'
import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import noop from 'lodash/noop'
import Video, {Poster} from './video'

type VideoRenderProps = {
  autoPlayOnCellular: boolean
  durationText?: string
  height: number
  width: number
  posterSrc: string
  videoSrc: string
  style: Styles.StylesCrossPlatform
}

type VideoRenderInnerProps = VideoRenderProps & {
  onLoadStart: () => void
  onReady: () => void
}

const VideoRenderDesktop = (props: VideoRenderInnerProps) => {
  const [playFromSecondsOrPause, setPlayFromSecondsOrPause] = React.useState<number | undefined>(0)
  const progressBaseRef = React.useRef(0)
  const onUnexpand = (currentSeconds?: number) => {
    setPlayFromSecondsOrPause(currentSeconds ?? 0)
    progressBaseRef.current = currentSeconds ?? 0
  }

  const dispatch = Container.useDispatch()
  const expand = () => {
    setPlayFromSecondsOrPause(undefined)
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              onHidden: onUnexpand,
              playFromSecondsOrPause: progressBaseRef.current,
              videoSrc: props.videoSrc,
            },
            selected: 'chatVideoFullScreen',
          },
        ],
      })
    )
  }
  return (
    <Kb.ClickableBox onClick={expand}>
      <Video
        posterSrc={props.posterSrc}
        videoSrc={props.videoSrc}
        mobileFullscreen={false}
        mobileOnDismissFullscreen={noop}
        muted={true}
        onProgress={(timeInSeconds: number) => (progressBaseRef.current = timeInSeconds)}
        onLoadStart={props.onLoadStart}
        onReady={props.onReady}
        playFromSecondsOrPause={playFromSecondsOrPause}
        style={Styles.collapseStyles([
          props.style,
          {
            height: props.height,
            width: props.width,
          },
        ])}
      />
    </Kb.ClickableBox>
  )
}

const VideoRenderMobile = (props: VideoRenderInnerProps) => {
  const isCellular = Container.useSelector(state => state.config.osNetworkIsCellular)
  const shouldAutoPlay = false // !isCellular || props.autoPlayOnCellular

  const [status, setStatus] = React.useState<'none' | 'playing' | 'playing-fullscreen'>(
    shouldAutoPlay ? 'playing' : 'none'
  )
  const onClick =
    status === 'none'
      ? () => setStatus('playing')
      : status === 'playing'
      ? () => setStatus('playing-fullscreen')
      : noop
  return (
    <Kb.ClickableBox onClick={onClick}>
      {status === 'none' ? (
        <Poster
          durationText={props.durationText}
          posterSrc={props.posterSrc}
          height={props.height}
          width={props.width}
        />
      ) : (
        <Video
          posterSrc={props.posterSrc}
          videoSrc={props.videoSrc}
          mobileFullscreen={status === 'playing-fullscreen'}
          mobileOnDismissFullscreen={() => setStatus('playing')}
          muted={status === 'playing'}
          playFromSecondsOrPause={0}
          onLoadStart={props.onLoadStart}
          onReady={props.onReady}
          style={Styles.collapseStyles([
            props.style,
            {
              height: props.height,
              width: props.width,
            },
          ])}
        />
      )}
    </Kb.ClickableBox>
  )
}

const VideoRenderInner = Styles.isMobile ? VideoRenderMobile : VideoRenderDesktop

export const VideoRender = (props: VideoRenderProps) => {
  const [loading, setLoading] = React.useState(false)
  return (
    <Kb.Box style={Styles.globalStyles.positionRelative}>
      <Kb.Animated to={{opacity: loading ? 0 : 1}} from={{opacity: 1}}>
        {({opacity}) => (
          <Kb.Box style={{opacity}}>
            <VideoRenderInner
              {...props}
              onLoadStart={() => setLoading(true)}
              onReady={() => setLoading(false)}
            />
          </Kb.Box>
        )}
      </Kb.Animated>
      {loading && (
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          centerChildren={true}
          style={Styles.globalStyles.fillAbsolute}
        >
          <Kb.ProgressIndicator />
        </Kb.Box2>
      )}
    </Kb.Box>
  )
}

type VideoExpandedModalProps = Container.RouteProps<{
  onHidden: (currentSeconds: number) => void
  playFromSecondsOrPause: number
  videoSrc: string
}>
export const VideoExpandedModal = (props: VideoExpandedModalProps) => {
  const onHidden = Container.getRouteProps(props, 'onHidden', noop)
  const playFromSecondsOrPause = Container.getRouteProps(props, 'playFromSecondsOrPause', 0)
  const videoSrc = Container.getRouteProps(props, 'videoSrc', '')

  const progressBaseRef = React.useRef(0)
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    onHidden(progressBaseRef.current)
  }

  return (
    <Kb.PopupDialog onClose={onClose} fill={true}>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Video
          videoSrc={videoSrc}
          mobileFullscreen={false}
          mobileOnDismissFullscreen={() => {}}
          muted={false}
          onProgress={(timeInSeconds: number) => (progressBaseRef.current = timeInSeconds)}
          playFromSecondsOrPause={playFromSecondsOrPause}
          style={styles.popupVideo}
        />
      </Kb.Box2>
    </Kb.PopupDialog>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  popupVideo: {
    height: '100%',
    width: '100%',
  },
}))
