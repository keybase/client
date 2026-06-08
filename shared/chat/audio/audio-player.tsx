import * as React from 'react'
import * as Kb from '@/common-adapters'
import AudioVideo from './audio-video'
import {formatAudioRecordDuration} from '@/util/timestamp'

type VisProps = {
  amps: undefined | ReadonlyArray<number>
  playedRatio: number
  height: number
  maxWidth?: number
}

const AudioVis = (props: VisProps) => {
  const {amps, playedRatio, maxWidth} = props
  let threshold = Math.floor((amps?.length ?? 0) * playedRatio)
  if (threshold > 0) {
    threshold += 2 // metering actually lags so compensate while actually playing
  }

  let maxHeight = 0
  const content = amps?.map((inamp, index) => {
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
          backgroundColor: index < threshold ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.black,
          height,
          marginRight: isMobile ? 4 * Kb.Styles.hairlineWidth : 2,
          width: isMobile ? 3 * Kb.Styles.hairlineWidth : 1,
        }}
      />
    )
  })
  return isMobile ? (
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
      style={{height: maxHeight, marginTop: Kb.Styles.globalMargins.xtiny, maxWidth: maxWidth}}
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
  visAmps: undefined | ReadonlyArray<number>
}

const AudioPlayer = (props: Props) => {
  const {duration, big, maxWidth, url, visAmps} = props
  const [playedRatio, setPlayedRatio] = React.useState(0)
  const [paused, setPaused] = React.useState(true)
  // Only mount AudioVideo after the user first taps play; calling useAudioPlayer
  // unconditionally for every message in the list spawns CoreMedia threads per
  // message and exhausts VM memory.
  const [everPlayed, setEverPlayed] = React.useState(false)
  const onClick = () => {
    if (paused) {
      setEverPlayed(true)
      setPaused(false)
    } else {
      setPaused(true)
    }
  }

  const onPositionUpdated = (ratio: number) => {
    setPlayedRatio(ratio)
  }

  const onEnded = () => {
    setPaused(true)
    setPlayedRatio(0)
  }

  const timeLeft = duration - playedRatio * duration
  return (
    <Kb.Box2
      direction="horizontal"
      style={Kb.Styles.collapseStyles([styles.container, {height: big ? 56 : 40}])}
      gap="tiny"
    >
      <Kb.ClickableBox direction="vertical" justifyContent="center" onClick={url ? onClick : undefined}>
        <Kb.Icon
          type={!paused ? 'iconfont-pause' : 'iconfont-play'}
          fontSize={32}
          color={url ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.grey}
        />
      </Kb.ClickableBox>
      <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.visContainer} gap="xxtiny" fullHeight={true} justifyContent="flex-end">
        <AudioVis height={big ? 32 : 18} amps={visAmps} maxWidth={maxWidth} playedRatio={playedRatio} />
        <Kb.Text type="BodyTiny">{formatAudioRecordDuration(timeLeft)}</Kb.Text>
      </Kb.Box2>
      {url.length > 0 && everPlayed && (
        <AudioVideo url={url} paused={paused} onPositionUpdated={onPositionUpdated} onEnded={onEnded} />
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.xxtiny, Kb.Styles.globalMargins.tiny),
    ...Kb.Styles.border(Kb.Styles.globalColors.grey, 1, Kb.Styles.borderRadius),
    backgroundColor: Kb.Styles.globalColors.white,
  },
  visContainer: {
    minWidth: 40,
  },
}))

export default AudioPlayer
