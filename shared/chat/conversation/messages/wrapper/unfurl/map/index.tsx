import * as React from 'react'
import * as Types from '../../../../../../constants/types/chat2'
import * as Kb from '../../../../../../common-adapters/index'
import * as Container from '../../../../../../util/container'
import * as RouteTreeGen from '../../../../../../actions/route-tree-gen'
import * as Styles from '../../../../../../styles'
import {imgMaxWidth} from '../../../attachment/image/image-render'
import {formatDurationForLocation} from '../../../../../../util/timestamp'
import UnfurlImage from '../image'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  coord: Types.Coordinate
  imageHeight: number
  imageWidth: number
  imageURL: string
  isAuthor: boolean
  author?: string
  liveLocationEndTime?: number
  isLiveLocationDone: boolean
  time: number
  toggleMessagePopup: () => void
  url: string
}

const UnfurlMap = (props: Props) => {
  // dispatch
  const dispatch = Container.useDispatch()
  const onViewMap = !Styles.isMobile
    ? props.toggleMessagePopup
    : () => {
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              {
                props: {
                  author: props.author,
                  conversationIDKey: props.conversationIDKey,
                  coord: props.coord,
                  isAuthor: props.isAuthor,
                  isLiveLocation: !!props.liveLocationEndTime && !props.isLiveLocationDone,
                  namespace: 'chat2',
                  url: props.url,
                },
                selected: 'chatUnfurlMapPopup',
              },
            ],
          })
        )
      }

  // render
  return (
    <Kb.Box2 direction="vertical">
      <UnfurlImage
        url={props.imageURL}
        height={props.imageHeight}
        width={props.imageWidth}
        isVideo={false}
        autoplayVideo={false}
        onClick={onViewMap}
      />
      {!!props.liveLocationEndTime && (
        <Kb.Box2
          direction="horizontal"
          style={Styles.collapseStyles([styles.liveLocation, {width: imgMaxWidth()}])}
          fullWidth={true}
        >
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodyTinySemibold">Live location</Kb.Text>
            <UpdateAge time={props.time} />
          </Kb.Box2>
          <LiveDuration
            liveLocationEndTime={props.liveLocationEndTime}
            isLiveLocationDone={props.isLiveLocationDone}
          />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

type AgeProps = {
  time: number
}

const UpdateAge = (props: AgeProps) => {
  const [timerCounter, setTimerCounter] = React.useState(0)
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimerCounter(timerCounter + 1)
    }, 60000)
    return () => {
      clearInterval(timer)
    }
  }, [timerCounter])
  const duration = Date.now() - props.time
  let durationText = ''
  if (duration < 60000) {
    durationText = 'updated just now'
  } else if (duration > 14400000) {
    return null
  } else {
    durationText = `updated ${formatDurationForLocation(duration)} ago`
  }
  return <Kb.Text type="BodyTiny">{durationText}</Kb.Text>
}

type DurationProps = {
  liveLocationEndTime: number
  isLiveLocationDone: boolean
}

const LiveDuration = (props: DurationProps) => {
  const [timerCounter, setTimerCounter] = React.useState(0)
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimerCounter(timerCounter + 1)
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [timerCounter])

  const duration = props.liveLocationEndTime - Date.now()
  return (
    <Kb.Text type="BodyTinySemibold">
      {props.isLiveLocationDone || duration <= 0 ? '(finished)' : formatDurationForLocation(duration)}
    </Kb.Text>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      liveLocation: {
        backgroundColor: Styles.globalColors.blueGrey,
        borderBottomLeftRadius: Styles.borderRadius,
        borderBottomRightRadius: Styles.borderRadius,
        justifyContent: 'space-between',
        marginTop: -2,
        padding: Styles.globalMargins.tiny,
      },
    } as const)
)

export default UnfurlMap
