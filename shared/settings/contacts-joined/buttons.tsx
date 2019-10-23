import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../'
type Props = {
  username: string
  small?: boolean
}
const getFollowWaitingKey = (username: string) => `settings:followButton:${username}`
const getWaveWaitingKey = (username: string) => `settings:waveButton:${username}`

export const WaveButton = (props: Props) => {
  const [waved, setWaved] = React.useState(false)
  const waving = Container.useAnyWaiting(getWaveWaitingKey(props.username))
  const dispatch = Container.useDispatch()

  const onWave = () => {
    dispatch(Chat2Gen.wa)
    setWaved(true)
  }

  return waved && !waving ? (
    <Kb.Text type="BodySmall">
      <Kb.Icon type="iconfont-check" color={Styles.globalColors.black_50} />
      Waved
    </Kb.Text>
  ) : (
    <Kb.Button onClick={onWave} small={props.small} mode="Secondary" waiting={waving}>
      <Kb.Text type="BodyBig" style={styles.blueText}>
        Wave{' '}
      </Kb.Text>
      <Kb.Emoji emojiName=":wave:" size={16} />
    </Kb.Button>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      blueText: {color: Styles.globalColors.blueDark},
    } as const)
)
