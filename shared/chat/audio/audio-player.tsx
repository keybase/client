import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import AudioVideo from './audio-video'
import {formatAudioRecordDuration} from '../../util/timestamp'

type Props = {
  duration: number
  url: string
  visUrl?: string
  visBytes?: string
  visHeight: number
  visWidth: number
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
  }, [timeLeft, paused])

  const visUrl = props.visUrl ? props.visUrl : `data:image/png;base64, ${props.visBytes}`
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} gap="tiny">
      <Kb.ClickableBox onClick={onClick} style={{justifyContent: 'center'}}>
        <Kb.Box2 direction="vertical" style={styles.button}>
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
        <Kb.Image
          src={visUrl}
          style={Styles.collapseStyles([
            styles.vis,
            {height: props.visHeight / 2, width: props.visWidth / 2},
          ])}
        />
        <Kb.Text type="BodyTiny">{formatAudioRecordDuration(timeLeft)}</Kb.Text>
      </Kb.Box2>
      <AudioVideo ref={vidRef} url={props.url} paused={paused} />
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
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.tiny,
  },
  play: {
    bottom: '50%',
    color: Styles.globalColors.white,
    left: '50%',
    marginBottom: -8,
    marginLeft: -6,
    marginRight: -8,
    marginTop: -8,
    position: 'absolute',
    right: '50%',
    top: '50%',
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
