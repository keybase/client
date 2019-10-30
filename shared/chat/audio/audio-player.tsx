import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import AudioVideo from './audio-video'
import {formatAudioRecordDuration} from '../../util/timestamp'

type VisProps = {
  amps: Array<number>
  height: number
}

const ampHeightProp = (amp: number) => {
  return Math.max(0.05, Math.min(1.0, 1 - amp / -70))
}

const AudioVis = (props: VisProps) => {
  return (
    <Kb.Box2 direction="horizontal" gap="xxtiny" style={{height: props.height}}>
      {props.amps.map((amp, index) => {
        const heightProp = ampHeightProp(amp)
        const height = heightProp * props.height
        return (
          <Kb.Box2
            alignSelf="flex-end"
            direction="vertical"
            key={index}
            style={{backgroundColor: Styles.globalColors.black, height, width: 1}}
          />
        )
      })}
    </Kb.Box2>
  )
}

type Props = {
  duration: number
  url: string
  visAmps: Array<number>
}

const AudioPlayer = (props: Props) => {
  const vidRef = React.useRef<AudioVideo>(null)
  const [timeLeft, setTimeLeft] = React.useState(props.duration)
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
    const timer = setTimeout(() => {
      if (timeLeft - 1000 <= 0) {
        setTimeLeft(props.duration)
        setPaused(true)
        if (vidRef.current) {
          vidRef.current.seek(0)
        }
      } else {
        setTimeLeft(timeLeft - 1000)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [timeLeft, paused, props.duration])

  return (
    <Kb.Box2 direction="horizontal" style={styles.container} gap="tiny">
      <Kb.ClickableBox onClick={props.url ? onClick : undefined} style={{justifyContent: 'center'}}>
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([
            styles.button,
            {backgroundColor: props.url ? Styles.globalColors.blue : Styles.globalColors.grey},
          ])}
        >
          <Kb.Icon
            type={!paused ? 'iconfont-stop' : 'iconfont-play'}
            fontSize={14}
            style={Styles.collapseStyles([
              Kb.iconCastPlatformStyles(styles.play),
              {marginLeft: paused ? -6 : -7},
            ])}
          />
        </Kb.Box2>
      </Kb.ClickableBox>
      <Kb.Box2 direction="vertical" style={styles.visContainer} gap="xxtiny">
        <AudioVis height={32} amps={props.visAmps} />
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
    backgroundColor: Styles.globalColors.blue,
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
    marginTop: Styles.globalMargins.xtiny,
  },
  duration: {
    color: Styles.globalColors.black_50,
  },
  play: Styles.platformStyles({
    common: {
      bottom: '50%',
      color: Styles.globalColors.whiteOrWhite,
      left: '50%',
      marginBottom: -8,
      marginLeft: -6,
      marginRight: -8,
      position: 'absolute',
      right: '50%',
      top: '50%',
    },
    isElectron: {
      marginTop: -6,
    },
    isMobile: {
      marginTop: -8,
    },
  }),
  vis: {
    alignSelf: 'flex-start',
  },
  visContainer: {
    alignItems: 'flex-start',
    minWidth: 40,
  },
}))

export default AudioPlayer
