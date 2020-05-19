import * as React from 'react'
import * as Styles from '../../../../../styles'
import * as Kb from '../../../../../common-adapters'
import * as Container from '../../../../../util/container'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import noop from 'lodash/noop'
import Video from './video'

type VideoRendererProps = {
  autoPlayOnCellular: boolean
  height: number
  width: number
  posterSrc: string
  videoSrc: string
  style: Styles.StylesCrossPlatform
}

export const VideoRender = (props: VideoRendererProps) => {
  const isCellular = Container.useSelector(state => state.config.osNetworkIsCellular)
  const shouldAutoPlay = !isCellular || props.autoPlayOnCellular
  const [playFromSecondsOrPause, setPlayFromSecondsOrPause] = React.useState<number | undefined>(
    shouldAutoPlay ? 0 : undefined
  )
  const [mobileFullscreen, setMobileFullscreen] = React.useState(false)
  const [muted, setMuted] = React.useState(true)
  const progressBaseRef = React.useRef(0)
  const onUnexpand = Styles.isMobile
    ? () => {
        setMuted(true)
        setMobileFullscreen(false)
      }
    : (currentSeconds?: number) => {
        setPlayFromSecondsOrPause(currentSeconds ?? 0)
        progressBaseRef.current = currentSeconds ?? 0
      }

  const dispatch = Container.useDispatch()
  const expand = Styles.isMobile
    ? () => {
        setMuted(false)
        setMobileFullscreen(true)
      }
    : () => {
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
        mobileFullscreen={mobileFullscreen}
        mobileOnDismissFullscreen={onUnexpand}
        muted={muted}
        onProgress={(timeInSeconds: number) => (progressBaseRef.current = timeInSeconds)}
        progressUpdateInterval={250}
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
    <Kb.PopupDialog
      onClose={onClose}
      fill={true}
      styleClipContainer={{backgroundColor: Styles.globalColors.blackOrBlack}}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Video
          videoSrc={videoSrc}
          mobileFullscreen={false}
          mobileOnDismissFullscreen={() => {}}
          muted={false}
          onProgress={(timeInSeconds: number) => (progressBaseRef.current = timeInSeconds)}
          progressUpdateInterval={250}
          playFromSecondsOrPause={playFromSecondsOrPause}
          style={{height: '100%', width: '100%'}}
        />
      </Kb.Box2>
    </Kb.PopupDialog>
  )
}
