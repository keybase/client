import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import HiddenString from '../../util/hidden-string'
import UnconnectedFollowButton from '../../profile/user/actions/follow-button'
import * as Tracker2Constants from '../../constants/tracker2'

type WaveProps = {
  usernames: string
  small?: boolean
  style?: Styles.StylesCrossPlatform
}
type FollowProps = {
  username: string
  small?: boolean
}
const getFollowWaitingKey = (username: string) => `settings:followButton:${username}`
const getWaveWaitingKey = (userList: string) => `settings:waveButton:${userList}`

export const WaveButton = (props: WaveProps) => {
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

export const FollowButton = (props: FollowProps) => {
  const dispatch = Container.useDispatch()
  const userDetails = Container.useSelector(state => Tracker2Constants.getDetails(state, props.username))
  const followThem = Container.useSelector(state => Tracker2Constants.followThem(state, props.username))
  const followsYou = Container.useSelector(state => Tracker2Constants.followsYou(state, props.username))

  React.useEffect(() => {
    if (!userDetails.guiID) {
      dispatch(
        Tracker2Gen.createShowUser({
          asTracker: false,
          skipNav: true,
          username: props.username,
        })
      )
    }
  }, [props.username, userDetails.guiID, dispatch])

  const onChangeFollow = (follow: boolean) =>
    dispatch(Tracker2Gen.createChangeFollow({follow, guiID: userDetails.guiID}))

  return (
    <UnconnectedFollowButton
      disabled={userDetails.username !== props.username}
      following={followThem}
      followsYou={followsYou}
      waitingKey={[getFollowWaitingKey(props.username), Tracker2Constants.profileLoadWaitingKey]}
      small={props.small}
      onFollow={() => onChangeFollow(true)}
      onUnfollow={() => onChangeFollow(false)}
    />
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
