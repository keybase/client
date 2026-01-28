import * as Chat from '@/stores/chat2'
import * as React from 'react'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import {getAddedUsernames} from '../system-users-added-to-conv/container'
import {formatTimeForChat} from '@/util/timestamp'

type OwnProps = {message: T.Chat.MessageSystemJoined}

const JoinedContainer = React.memo(function JoinedContainer(p: OwnProps) {
  const {message} = p
  const {joiners, author, leavers, timestamp} = message
  const meta = Chat.useChatContext(s => s.meta)
  const {channelname, teamType, teamname} = meta
  const joiners2 = React.useMemo(() => {
    return !joiners?.length && !leavers?.length ? [author] : joiners
  }, [joiners, leavers, author])
  const isBigTeam = teamType === 'big'
  const multiProps = {channelname, isBigTeam, teamname, timestamp}
  return (
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} alignSelf="flex-start">
      {joiners2?.length ? <MultiUserJoinedNotice {...multiProps} who={joiners2} join={true} /> : null}
      {leavers?.length ? <MultiUserJoinedNotice {...multiProps} who={leavers} join={false} /> : null}
    </Kb.Box2>
  )
})

const MultiUserJoinedNotice = (p: {
  who: ReadonlyArray<string>
  join: boolean
  isBigTeam: boolean
  channelname: string
  teamname: string
  timestamp: number
}) => {
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

export default JoinedContainer
