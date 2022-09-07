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
  // console.log('aaa vis', props.amps)
  const content = props.amps.map((inamp, index) => {
    const amp = isNaN(inamp) || inamp < 0 ? 0 : inamp
    const prop = Math.min(1.0, Math.max(Math.sqrt(amp), 0.05))
    const height = Math.floor(prop * props.height)
    if (height > maxHeight) {
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
  const {duration, big, maxWidth, url, visAmps} = props
  const seekRef = React.useRef<null | ((n: number) => void)>(null)
  const lastTimeRef = React.useRef(0)
  const [timeLeft, setTimeLeft] = React.useState(duration)
  const [paused, setPaused] = React.useState(true)
  const onClick = () => {
    if (paused) {
      setPaused(false)
    } else {
      setPaused(true)
    }
  }
  React.useEffect(() => {
    if (paused) {
      return
    }
    lastTimeRef.current = Date.now()
    const interval = setInterval(() => {
      const now = Date.now()
      const diff = now - lastTimeRef.current
      const newTimeLeft = Math.max(0, timeLeft - diff)
      // console.log('aaa diff:', diff, ' left: ', timeLeft, 'newleft:', newTimeLeft, 'dur:', duration)
      if (newTimeLeft <= 0) {
        setTimeLeft(duration)
        setPaused(true)
        lastTimeRef.current = 0
        seekRef.current?.(0)
      } else {
        setTimeLeft(newTimeLeft)
      }
    }, 100)
    return () => {
      clearInterval(interval)
    }
  }, [timeLeft, paused, duration])

  const ampsRemain = Math.floor((1 - timeLeft / duration) * visAmps.length)
  return (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([styles.container, {height: big ? 56 : 40}])}
      gap="tiny"
    >
      <Kb.ClickableBox onClick={url ? onClick : undefined} style={{justifyContent: 'center'}}>
        <Kb.Icon
          type={!paused ? 'iconfont-pause' : 'iconfont-play'}
          fontSize={32}
          color={url ? Styles.globalColors.blue : Styles.globalColors.grey}
        />
      </Kb.ClickableBox>
      <Kb.Box2 direction="vertical" style={styles.visContainer} gap="xxtiny" fullHeight={true}>
        <AudioVis height={big ? 32 : 18} amps={visAmps} maxWidth={maxWidth} ampsRemain={ampsRemain} />
        <Kb.Text type="BodyTiny">{formatAudioRecordDuration(timeLeft)}</Kb.Text>
      </Kb.Box2>
      {url.length > 0 && <AudioVideo seekRef={seekRef} url={url} paused={paused} />}
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
