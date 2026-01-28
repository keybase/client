import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as T from '@/constants/types'
import {useTeamsState} from '@/stores/teams'
import * as React from 'react'
import Text, {type StylesTextCrossPlatform} from '@/common-adapters/text'
import {Box2} from '@/common-adapters/box'
import * as Styles from '@/styles'
import TeamInfo from '@/profile/user/teams/teaminfo'
import type {MeasureRef} from 'common-adapters/measure-ref'

const Kb = {Box2, Styles, Text}

type OwnProps = {
  allowFontScaling?: boolean
  channel: string
  name: string
  style?: StylesTextCrossPlatform
}

const noAdmins: Array<string> = []

const TeamMention = (ownProps: OwnProps) => {
  const {allowFontScaling, name, channel, style} = ownProps
  const maybeMentionInfo = Chat.useChatState(s =>
    s.maybeMentionMap.get(Chat.getTeamMentionName(name, channel))
  )
  const mentionInfo =
    maybeMentionInfo?.status === T.RPCChat.UIMaybeMentionStatus.team ? maybeMentionInfo.team : null
  const _convID = mentionInfo ? mentionInfo.convID : undefined
  const description = mentionInfo?.description || ''
  const inTeam = !!mentionInfo && mentionInfo.inTeam
  const isOpen = !!mentionInfo && mentionInfo.open
  const numMembers = mentionInfo?.numMembers || 0
  const publicAdmins = mentionInfo?.publicAdmins || noAdmins
  const resolved = !!mentionInfo

  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const showTeamByName = useTeamsState(s => s.dispatch.showTeamByName)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const _onViewTeam = (teamname: string) => {
    clearModals()
    showTeamByName(teamname)
  }
  const joinTeam = useTeamsState(s => s.dispatch.joinTeam)
  const onJoinTeam = joinTeam

  const convID = _convID ? T.Chat.stringToConversationIDKey(_convID) : undefined
  const onChat = convID
    ? () => {
        previewConversation({conversationIDKey: convID, reason: 'teamMention'})
      }
    : undefined
  const onViewTeam = () => _onViewTeam(name)

  const [showPopup, setShowPopup] = React.useState(false)
  const mentionRef = React.useRef<MeasureRef | null>(null)

  const handleClick = () => {
    if (onChat) {
      onChat()
    } else {
      setShowPopup(true)
    }
  }

  const handleMouseOver = () => setShowPopup(true)
  const handleMouseLeave = () => setShowPopup(false)

  let text = `@${name}`
  if (channel.length > 0) {
    text += `#${channel}`
  }

  const content = (
    <Kb.Text
      textRef={mentionRef}
      type="BodyBold"
      className={Kb.Styles.classNames({'hover-underline': !Styles.isMobile})}
      style={Kb.Styles.collapseStyles([style, styles.text])}
      allowFontScaling={allowFontScaling}
      onClick={handleClick}
    >
      <Kb.Text
        type="BodyBold"
        style={Kb.Styles.collapseStyles([style, styles.resolved, styles.text])}
        allowFontScaling={allowFontScaling}
      >
        {text}
      </Kb.Text>
    </Kb.Text>
  )

  const popups = (
    <TeamInfo
      attachTo={mentionRef}
      description={description}
      inTeam={inTeam}
      isOpen={isOpen}
      name={name}
      membersCount={numMembers}
      onChat={onChat}
      onHidden={handleMouseLeave}
      onJoinTeam={onJoinTeam}
      onViewTeam={onViewTeam}
      publicAdmins={publicAdmins}
      visible={showPopup}
    />
  )

  return resolved ? (
    Kb.Styles.isMobile ? (
      <>
        {content}
        {popups}
      </>
    ) : (
      <Kb.Box2
        direction="horizontal"
        style={styles.container}
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
      >
        {content}
        {popups}
      </Kb.Box2>
    )
  ) : (
    <Kb.Text type="BodySemibold" style={style} allowFontScaling={allowFontScaling}>
      {text}
    </Kb.Text>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
        },
      }),
      resolved: {
        backgroundColor: Kb.Styles.globalColors.blue,
        borderRadius: 2,
        color: Kb.Styles.globalColors.white,
      },
      text: Kb.Styles.platformStyles({
        common: {
          letterSpacing: 0.3,
          paddingLeft: 2,
          paddingRight: 2,
        },
        isElectron: {
          display: 'inline-block',
        },
      }),
    }) as const
)

export default TeamMention
