import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import HiddenString from '../../util/hidden-string'
import UnconnectedFollowButton from '../../profile/user/actions/follow-button'
import * as Tracker2Constants from '../../constants/tracker2'

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
    dispatch(
      Chat2Gen.createMessageSendByUsername({
        text: new HiddenString(':wave:'),
        username: props.username,
        waitingKey: getWaveWaitingKey(props.username),
      })
    )
    setWaved(true)
  }

  // TODO a box around the waved version, perhaps
  return waved && !waving ? (
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.waved} gap="xtiny">
      <Kb.Icon type="iconfont-check" color={Styles.globalColors.black_50} sizeType="Tiny" />
      <Kb.Text type="BodySmall"> Waved</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Button onClick={onWave} small={props.small} mode="Secondary" waiting={waving}>
      <Kb.Text type="BodyBig" style={styles.blueText}>
        Wave{' '}
      </Kb.Text>
      <Kb.Emoji emojiName=":wave:" size={16} />
    </Kb.Button>
  )
}

export const FollowButton = (props: Props) => {
  const userDetails = Container.useSelector(state => Tracker2Constants.getDetails(state, props.username))
  const followThem = Container.useSelector(state => Tracker2Constants.followThem(state, props.username))
  const followsYou = Container.useSelector(state => Tracker2Constants.followsYou(state, props.username))

  const dispatch = Container.useDispatch()
  const onChangeFollow = (follow: boolean) =>
    dispatch(Tracker2Gen.createChangeFollow({follow, guiID: userDetails.guiID}))

  // TODO: followsYou
  return (
    <UnconnectedFollowButton
      following={followThem}
      followsYou={followsYou}
      waitingKey={getFollowWaitingKey(props.username)}
      small={props.small}
      onFollow={() => onChangeFollow(true)}
      onUnfollow={() => onChangeFollow(false)}
    />
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      blueText: {color: Styles.globalColors.blueDark},
      waved: {
        ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.small),
        minWidth: 94,
      },
    } as const)
)
