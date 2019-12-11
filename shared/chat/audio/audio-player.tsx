import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import AudioVideo from './audio-video'
import {formatAudioRecordDuration} from '../../util/timestamp'
import {isMobile} from '../../constants/platform'

type VisProps = {
  amps: Array<number>
  ampsRemain: number
  height: number
  maxWidth?: number
}

const AudioVis = (props: VisProps) => {
  let maxHeight = 0
  const content = props.amps.map((inamp, index) => {
    const amp = isNaN(inamp) || inamp < 0 ? 0 : inamp
    const prop = Math.min(1.0, Math.max(Math.sqrt(amp), 0.05))
    const height = Math.floor(prop * props.height)
    if (height >= maxHeight) {
      maxHeight = height
    }
    return (
      <Kb.Box2
        alignSelf="flex-end"
        direction="vertical"
        key={index}
        style={{
          backgroundColor: index < props.ampsRemain ? Styles.globalColors.blue : Styles.globalColors.black,
          height,
          marginRight: isMobile ? 4 * Styles.hairlineWidth : 2,
          width: isMobile ? 3 * Styles.hairlineWidth : 1,
        }}
      />
    )
  })
  return Styles.isMobile ? (
    <Kb.ScrollView
      horizontal={true}
      style={{height: maxHeight, maxWidth: props.maxWidth}}
      showsHorizontalScrollIndicator={false}
    >
      {content}
    </Kb.ScrollView>
  ) : (
    <Kb.Box2
      direction="horizontal"
      style={{height: maxHeight, marginTop: Styles.globalMargins.xtiny, maxWidth: props.maxWidth}}
    >
      {content}
    </Kb.Box2>
  )
}

type Props = {
  big: boolean
  duration: number
  maxWidth?: number
  url: string
  visAmps: Array<number>
}

const AudioPlayer = (props: Props) => {
  const vidRef = React.useRef<AudioVideo>(null)
  const [timeStart, setTimeStart] = React.useState(0)
  const [timeLeft, setTimeLeft] = React.useState(props.duration)
  const [timePaused, setTimePaused] = React.useState(0)
  const [timePauseButton, setTimePauseButton] = React.useState(0)
  const [paused, setPaused] = React.useState(true)
  const onClick = () => {
    if (paused) {
      if (timeStart === 0) {
        setTimeStart(Date.now())
      } else if (timePauseButton > 0) {
        setTimePaused(timePaused + (Date.now() - timePauseButton))
      }
      setPaused(false)
      setTimePauseButton(0)
    } else {
      setTimePauseButton(Date.now())
      setPaused(true)
    }
  }
  React.useEffect(() => {
    if (paused) {
      return
    }
    const timer = setTimeout(() => {
      const diff = Date.now() - timeStart - timePaused
      const newTimeLeft = props.duration - diff
      if (newTimeLeft <= 0) {
        setTimeLeft(props.duration)
        setPaused(true)
        setTimeStart(0)
        setTimePaused(0)
        setTimePauseButton(0)
        if (vidRef.current) {
          vidRef.current.seek(0)
        }
      } else {
        setTimeLeft(newTimeLeft)
      }
    }, 100)
    return () => {
      clearTimeout(timer)
    }
  }, [timeLeft, timeStart, timePaused, paused, props.duration])

  const ampsRemain = Math.floor((1 - timeLeft / props.duration) * props.visAmps.length)
  return (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([styles.container, {height: props.big ? 56 : 40}])}
      gap="tiny"
    >
      <Kb.ClickableBox onClick={props.url ? onClick : undefined} style={{justifyContent: 'center'}}>
        <Kb.Icon
          type={!paused ? 'iconfont-pause' : 'iconfont-play'}
          fontSize={32}
          color={props.url ? Styles.globalColors.blue : Styles.globalColors.grey}
        />
      </Kb.ClickableBox>
      <Kb.Box2 direction="vertical" style={styles.visContainer} gap="xxtiny" fullHeight={true}>
        <AudioVis
          height={props.big ? 32 : 18}
          amps={props.visAmps}
          maxWidth={props.maxWidth}
          ampsRemain={ampsRemain}
        />
        <Kb.Text type="BodyTiny">{formatAudioRecordDuration(timeLeft)}</Kb.Text>
      </Kb.Box2>
      {props.url.length > 0 && <AudioVideo ref={vidRef} url={props.url} paused={paused} />}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: {
    borderRadius: 15,
    height: 30,
    position: 'relative',
    width: 30,
  },
  container: {
    ...Styles.padding(Styles.globalMargins.xxtiny, Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.grey,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
  },
  vis: {
    alignSelf: 'flex-start',
  },
  visContainer: {
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    minWidth: 40,
  },
}))

export default AudioPlayer
