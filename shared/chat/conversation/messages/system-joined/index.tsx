import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import {getAddedUsernames} from '../system-users-added-to-conv'
import {formatTimeForChat} from '@/util/timestamp'
type Props = {
  channelname: string
  isBigTeam: boolean
  joiners?: ReadonlyArray<string>
  leavers?: ReadonlyArray<string>
  teamname: string
  timestamp: number
}

const none = new Array<string>()

const Joined = (props: Props) => {
  const {joiners = none, leavers = none} = props
  return (
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} alignSelf="flex-start">
      {joiners.length ? <MultiUserJoinedNotice {...props} who={joiners} join={true} /> : null}
      {leavers.length ? <MultiUserJoinedNotice {...props} who={leavers} join={false} /> : null}
    </Kb.Box2>
  )
}

const MultiUserJoinedNotice = (
  p: {who: ReadonlyArray<string>; join: boolean} & Omit<Props, 'leavers' | 'joiners'>
) => {
  const {who, join, isBigTeam, channelname, teamname, timestamp} = p

  const shorten = Kb.Styles.isMobile && who.length > 1
  const joinStr = ` ${join ? 'joined' : 'left'}${shorten ? '' : isBigTeam ? ` #${channelname}` : ` ${teamname}`}`

  const ts = timestamp ? (
    <Kb.Text type="BodyTiny" style={styles.timestamp}>
      {' ' + formatTimeForChat(timestamp)}
    </Kb.Text>
  ) : null

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} alignSelf="flex-start" style={{position: 'relative'}}>
      <UserNotice>
        <Kb.Box2
          direction="horizontal"
          gap="xtiny"
          fullWidth={true}
          alignSelf="flex-start"
          style={{position: 'relative'}}
        >
          <Kb.Text type="Body">•</Kb.Text>
          <Kb.Text type="BodySmall" lineClamp={2} title={who.join(', ')}>
            {getAddedUsernames(who)}
            {joinStr}
            {shorten ? null : ts}
          </Kb.Text>
          <Kb.AvatarLine usernames={who} maxShown={3} size={16} layout="horizontal" alignSelf="flex-start" />
        </Kb.Box2>
      </UserNotice>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      avatarLine: Kb.Styles.platformStyles({
        isElectron: {marginLeft: -2 + 48},
        isMobile: {marginLeft: -Kb.Styles.globalMargins.xsmall},
      }),
      container: {marginLeft: -40, paddingBottom: 4},
      timestamp: Kb.Styles.platformStyles({isElectron: {lineHeight: 19}}),
    }) as const
)

export default Joined
