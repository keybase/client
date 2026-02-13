import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters/index'
import * as T from '@/constants/types'
import * as React from 'react'
import UnfurlImage from './image'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import {formatDurationForLocation} from '@/util/timestamp'
import {getUnfurlInfo} from './use-state'
import {maxWidth} from '@/chat/conversation/messages/attachment/shared'

const UnfurlMap = React.memo(function UnfurlGeneric(p: {idx: number}) {
  const {idx} = p
  const ordinal = useOrdinal()
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  const data = Chat.useChatContext(
    C.useShallow(s => {
      const {unfurl, youAreAuthor, author} = getUnfurlInfo(s, ordinal, idx)
      if (unfurl?.unfurlType !== T.RPCChat.UnfurlType.generic) {
        return null
      }
      const {generic} = unfurl
      const {mapInfo, media, url} = generic
      const {coord, isLiveLocationDone, liveLocationEndTime, time} = mapInfo || {
        coord: {accuracy: 0, lat: 0, lon: 0},
        isLiveLocationDone: false,
        liveLocationEndTime: 0,
        time: 0,
      }
      const {height, width, url: imageURL} = media || {height: 0, url: '', width: 0}
      const {id} = s

      return {
        author,
        coord,
        height,
        id,
        imageURL,
        isLiveLocationDone,
        liveLocationEndTime,
        time,
        url,
        width,
        youAreAuthor,
      }
    })
  )

  if (!data) {
    return null
  }

  const {author, url, coord, isLiveLocationDone, liveLocationEndTime} = data
  const {height, width, imageURL, youAreAuthor, time, id} = data
  const onViewMap = () => {
    navigateAppend({
      props: {
        author,
        conversationIDKey: id,
        coord,
        isAuthor: youAreAuthor,
        isLiveLocation: !!liveLocationEndTime && !isLiveLocationDone,
        url,
      },
      selected: 'chatUnfurlMapPopup',
    })
  }

  return (
    <Kb.Box2 direction="vertical">
      <UnfurlImage
        url={imageURL}
        height={height}
        width={width}
        isVideo={false}
        autoplayVideo={false}
        onClick={onViewMap}
      />
      {!!liveLocationEndTime && (
        <Kb.Box2
          direction="horizontal"
          style={Kb.Styles.collapseStyles([styles.liveLocation, {width: maxWidth}])}
          fullWidth={true}
        >
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodyTinySemibold" style={styles.fastStyle}>
              Live location
            </Kb.Text>
            <UpdateAge time={time} />
          </Kb.Box2>
          <LiveDuration liveLocationEndTime={liveLocationEndTime} isLiveLocationDone={isLiveLocationDone} />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
})

type AgeProps = {
  time: number
}

const UpdateAge = (props: AgeProps) => {
  const {time} = props
  const [duration, setDuration] = React.useState(() => Date.now() - time)
  React.useEffect(() => {
    const timer = setInterval(() => {
      setDuration(Date.now() - time)
    }, 60000)
    return () => {
      clearInterval(timer)
    }
  }, [time])
  let durationText: string
  if (duration < 60000) {
    durationText = 'updated just now'
  } else if (duration > 14400000) {
    return null
  } else {
    durationText = `updated ${formatDurationForLocation(duration)} ago`
  }
  return (
    <Kb.Text type="BodyTiny" style={styles.fastStyle}>
      {durationText}
    </Kb.Text>
  )
}

type DurationProps = {
  liveLocationEndTime: number
  isLiveLocationDone: boolean
}

const LiveDuration = (props: DurationProps) => {
  const {liveLocationEndTime} = props
  const [duration, setDuration] = React.useState(() => liveLocationEndTime - Date.now())
  React.useEffect(() => {
    const timer = setInterval(() => {
      setDuration(liveLocationEndTime - Date.now())
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [liveLocationEndTime])

  return (
    <Kb.Text type="BodyTinySemibold" style={styles.fastStyle}>
      {props.isLiveLocationDone || duration <= 0 ? '(finished)' : formatDurationForLocation(duration)}
    </Kb.Text>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      fastStyle: {backgroundColor: Kb.Styles.globalColors.blueGrey},
      liveLocation: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        borderBottomLeftRadius: Kb.Styles.borderRadius,
        borderBottomRightRadius: Kb.Styles.borderRadius,
        justifyContent: 'space-between',
        marginTop: -2,
        padding: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default UnfurlMap
