import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import {getAddedUsernames} from '../system-users-added-to-conv'
import {formatTimeForChat} from '@/util/timestamp'
type Props = {
  author: string
  authorIsYou: boolean
  channelname: string
  isAdHoc: boolean
  isBigTeam: boolean
  joiners: Array<string>
  leavers: Array<string>
  onAuthorClick: (username: string) => void
  onManageChannels: () => void
  onManageNotifications: () => void
  teamname: string
  timestamp: number
}

const Joined = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} alignSelf="flex-start">
    {props.joiners.length ? <MultiUserJoinedNotice {...props} joiners={props.joiners} leavers={[]} /> : null}
    {props.leavers.length ? <MultiUserJoinedNotice {...props} joiners={[]} leavers={props.leavers} /> : null}
  </Kb.Box2>
)

const MultiUserJoinedNotice = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} alignSelf="flex-start">
    <UserNotice>
      <Kb.Text type="BodySmall" style={{paddingBottom: Kb.Styles.globalMargins.xxtiny}} lineClamp={2}>
        {props.joiners.length > 0 ? getAddedUsernames(props.joiners) : getAddedUsernames(props.leavers)}
        {` ${props.leavers.length > props.joiners.length ? 'left' : 'joined'} ${
          props.isBigTeam ? `#${props.channelname}.` : `${props.teamname}.`
        }`}
        {props.timestamp ? (
          <Kb.Text type="BodyTiny" style={styles.timestamp}>
            {' ' + formatTimeForChat(props.timestamp)}
          </Kb.Text>
        ) : null}
      </Kb.Text>
      <Kb.Box2 direction="horizontal" alignSelf="flex-start" style={styles.avatarLine}>
        <Kb.AvatarLine
          usernames={props.joiners.length > 0 ? props.joiners : props.leavers}
          maxShown={3}
          size={32}
          layout="horizontal"
          alignSelf="flex-start"
        />
      </Kb.Box2>
    </UserNotice>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      avatarLine: Kb.Styles.platformStyles({
        isElectron: {marginLeft: -2},
        isMobile: {marginLeft: -Kb.Styles.globalMargins.xsmall},
      }),
      container: {marginLeft: -40, paddingBottom: 4},
      timestamp: Kb.Styles.platformStyles({isElectron: {lineHeight: 19}}),
    }) as const
)

export default Joined
