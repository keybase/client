import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import AudioVideo from './audio-video'
import {formatAudioRecordDuration} from '../../util/timestamp'

type VisProps = {
  amps: Array<number>
  height: number
  maxWidth?: number
}

const ampHeightProp = (amp: number) => {
  return Math.max(0.05, Math.min(1.0, 1 - amp / -70))
}

const AudioVis = (props: VisProps) => {
  let maxHeight = 0
  const content = props.amps.map((amp, index) => {
    const heightProp = ampHeightProp(amp)
    const height = heightProp * props.height
    if (height >= maxHeight) {
      maxHeight = height
    }
    return (
      <Kb.Box2
        alignSelf="flex-end"
        direction="vertical"
        key={index}
        style={{backgroundColor: Styles.globalColors.black, height, marginRight: 2, width: 1}}
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
  duration: number
  maxWidth?: number
  url: string
  visAmps: Array<number>
}

const AudioPlayer = (props: Props) => {
  const vidRef = React.useRef<AudioVideo>(null)
  const [timeStart, setTimeStart] = React.useState(0)
  const [timeLeft, setTimeLeft] = React.useState(props.duration)
  const [paused, setPaused] = React.useState(true)
  const onClick = () => {
    if (paused) {
      if (timeStart === 0) {
        setTimeStart(Date.now())
      }
      setPaused(false)
    } else {
      setPaused(true)
    }
  }
  React.useEffect(() => {
    if (paused) {
      return
    }
    const timer = setTimeout(() => {
      const newTimeLeft = props.duration - (Date.now() - timeStart)
      if (newTimeLeft <= 0) {
        setTimeLeft(props.duration)
        setPaused(true)
        setTimeStart(0)
        if (vidRef.current) {
          vidRef.current.seek(0)
        }
      } else {
        setTimeLeft(newTimeLeft)
      }
    }, 1000)
    return () => {
      clearTimeout(timer)
    }
  }, [timeLeft, timeStart, paused, props.duration])

  return (
    <Kb.Box2 direction="horizontal" style={styles.container} gap="tiny">
      <Kb.ClickableBox onClick={props.url ? onClick : undefined} style={{justifyContent: 'center'}}>
        <Kb.Icon
          type={!paused ? 'iconfont-pause' : 'iconfont-play'}
          fontSize={24}
          style={Kb.iconCastPlatformStyles(styles.play)}
        />
      </Kb.ClickableBox>
      <Kb.Box2 direction="vertical" style={styles.visContainer} gap="xxtiny">
        <AudioVis height={32} amps={props.visAmps} maxWidth={props.maxWidth} />
        <Kb.Text type="BodyTiny" style={styles.duration}>
          {formatAudioRecordDuration(timeLeft)}
        </Kb.Text>
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
    ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.grey,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginTop: Styles.globalMargins.xtiny,
  },
  duration: {
    color: Styles.globalColors.black_50,
  },
  play: {
    color: Styles.globalColors.blue,
  },
  vis: {
    alignSelf: 'flex-start',
  },
  visContainer: {
    alignItems: 'flex-start',
    minWidth: 40,
  },
}))

export default AudioPlayer
