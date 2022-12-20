import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import AudioVideo from './audio-video'
import {formatAudioRecordDuration} from '../../util/timestamp'
import {isMobile} from '../../constants/platform'

type VisProps = {
  amps: Array<number>
  playedRatio: number
  height: number
  maxWidth?: number
}

const AudioVis = (props: VisProps) => {
  const {amps, playedRatio, maxWidth} = props
  let threshold = Math.floor(amps.length * playedRatio)
  if (threshold > 0) {
    threshold += 2 // metering actually lags so compensate while actually playing
  }

  let maxHeight = 0
  const content = amps.map((inamp, index) => {
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
          backgroundColor: index < threshold ? Styles.globalColors.blue : Styles.globalColors.black,
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
      style={{height: maxHeight, maxWidth: maxWidth}}
      showsHorizontalScrollIndicator={false}
    >
      {content}
    </Kb.ScrollView>
  ) : (
    <Kb.Box2
      direction="horizontal"
      style={{height: maxHeight, marginTop: Styles.globalMargins.xtiny, maxWidth: maxWidth}}
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
  const [playedRatio, setPlayedRatio] = React.useState(0)
  const [paused, setPaused] = React.useState(true)
  const onClick = () => {
    if (paused) {
      setPaused(false)
    } else {
      setPaused(true)
    }
  }

  const onPositionUpdated = React.useCallback(
    (ratio: number) => {
      setPlayedRatio(ratio)
    },
    [setPlayedRatio]
  )

  const onEnded = React.useCallback(() => {
    setPaused(true)
    setPlayedRatio(0)
  }, [setPaused, setPlayedRatio])

  const timeLeft = duration - playedRatio * duration
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
        <AudioVis height={big ? 32 : 18} amps={visAmps} maxWidth={maxWidth} playedRatio={playedRatio} />
        <Kb.Text type="BodyTiny">{formatAudioRecordDuration(timeLeft)}</Kb.Text>
      </Kb.Box2>
      {url.length > 0 && (
        <AudioVideo
          seekRef={seekRef}
          url={url}
          paused={paused}
          onPositionUpdated={onPositionUpdated}
          onEnded={onEnded}
        />
      )}
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
