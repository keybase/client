import * as Container from '../../../../../../util/container'
import * as Kb from '../../../../../../common-adapters/index'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../../../../../actions/route-tree-gen'
import * as Styles from '../../../../../../styles'
import UnfurlImage from './image'
import shallowEqual from 'shallowequal'
import {ConvoIDContext, OrdinalContext} from '../../../ids-context'
import {formatDurationForLocation} from '../../../../../../util/timestamp'
import {getUnfurlInfo} from './use-redux'
import {maxWidth} from '../../../attachment/shared'

const UnfurlMap = React.memo(function UnfurlGeneric(p: {idx: number}) {
  const {idx} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)

  const data = Container.useSelector(state => {
    const {unfurl, youAreAuthor, author} = getUnfurlInfo(state, conversationIDKey, ordinal, idx)
    if (unfurl?.unfurlType !== RPCChatTypes.UnfurlType.generic) {
      return null
    }
    const {generic} = unfurl
    const {mapInfo, media, url} = generic
    const {coord, isLiveLocationDone, liveLocationEndTime, time} = mapInfo || {
      coord: 0,
      isLiveLocationDone: false,
      liveLocationEndTime: 0,
      time: 0,
    }
    const {height, width, url: imageURL} = media || {height: 0, url: '', width: 0}

    return {
      author,
      coord,
      height,
      imageURL,
      isLiveLocationDone,
      liveLocationEndTime,
      time,
      url,
      width,
      youAreAuthor,
    }
  }, shallowEqual)

  const dispatch = Container.useDispatch()

  if (!data) {
    return null
  }

  const {author, url, coord, isLiveLocationDone, liveLocationEndTime} = data
  const {height, width, imageURL, youAreAuthor, time} = data
  const onViewMap = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              author,
              conversationIDKey,
              coord,
              isAuthor: youAreAuthor,
              isLiveLocation: !!liveLocationEndTime && !isLiveLocationDone,
              url,
            },
            selected: 'chatUnfurlMapPopup',
          },
        ],
      })
    )
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
          style={Styles.collapseStyles([styles.liveLocation, {width: maxWidth}])}
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
  const [duration, setDuration] = React.useState(Date.now() - time)
  React.useEffect(() => {
    const timer = setInterval(() => {
      setDuration(Date.now() - time)
    }, 60000)
    return () => {
      clearInterval(timer)
    }
  }, [time])
  let durationText = ''
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
  const [duration, setDuration] = React.useState(liveLocationEndTime - Date.now())
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      fastStyle: {backgroundColor: Styles.globalColors.blueGrey},
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
