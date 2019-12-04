import * as React from 'react'
import {Box2} from './box'
import Icon from './icon'
import Text from './text'
import Button from './button'
import Emoji from './emoji'
import * as Styles from '../styles'
import * as Container from '../util/container'
import HiddenString from '../util/hidden-string'
import * as Chat2Gen from '../actions/chat2-gen'

const Kb = {
  Box2,
  Icon,
  Text,
  Button,
  Emoji,
}

type Props = {
  usernames: string
  small?: boolean
  style?: Styles.StylesCrossPlatform
}
const getWaveWaitingKey = (userList: string) => `settings:waveButton:${userList}`

// A button that sends a wave emoji into a chat.
export const WaveButton = (props: Props) => {
  const [waved, setWaved] = React.useState(false)
  const waving = Container.useAnyWaiting(getWaveWaitingKey(props.usernames))
  const dispatch = Container.useDispatch()

  const onWave = () => {
    dispatch(
      Chat2Gen.createMessageSendByUsernames({
        text: new HiddenString(':wave:'),
        usernames: props.usernames,
        waitingKey: getWaveWaitingKey(props.usernames),
      })
    )
    setWaved(true)
  }

  const waveText = props.usernames.includes(',') ? 'Wave at everyone' : 'Wave'
  return waved && !waving ? (
    <Kb.Box2
      direction="horizontal"
      centerChildren={true}
      style={Styles.collapseStyles([props.style, styles.waved])}
      gap="xtiny"
    >
      <Kb.Icon type="iconfont-check" color={Styles.globalColors.black_50} sizeType="Tiny" />
      <Kb.Text type="BodySmall"> Waved</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Button onClick={onWave} small={props.small} mode="Secondary" waiting={waving} style={props.style}>
      <Kb.Text type="BodyBig" style={styles.blueText}>
        {waveText}
      </Kb.Text>
      <Kb.Emoji emojiName=":wave:" size={18} />
    </Kb.Button>
  )
}


const styles = Styles.styleSheetCreate(
  () =>
    ({
      blueText: {color: Styles.globalColors.blueDark, paddingRight: Styles.globalMargins.xtiny},
      waved: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small, Styles.globalMargins.xtiny),
        minWidth: 94,
      },
    } as const)
)


export default WaveButton
