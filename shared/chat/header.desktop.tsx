import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Constants from '../constants/chat2'
import * as TeamConstants from '../constants/teams'
import * as Platforms from '../constants/platform'
import * as Chat2Gen from '../actions/chat2-gen'
import {appendNewChatBuilder} from '../actions/typed-routes'
import * as Styles from '../styles'
import * as Container from '../util/container'
import ChatInboxHeader from './inbox/row/chat-inbox-header/container'

type OwnProps = {}

type Props = {
  canEditDesc: boolean
  channel: string | null
  desc: string
  infoPanelOpen: boolean
  isTeam: boolean
  muted: boolean
  onOpenFolder: () => void
  onNewChat: () => void
  onToggleInfoPanel: () => void
  onToggleThreadSearch: () => void
  participants: Array<string> | null
  showActions: boolean
  unMuteConversation: () => void
  username: string
  fullName?: string
}

const descStyle = {fontSize: 13, lineHeight: '16px', wordBreak: 'break-all'} as const // approximates BodySmall since markdown does not support text type
const descStyleOverride = {
  del: descStyle,
  em: descStyle,
  fence: descStyle,
  inlineCode: descStyle,
  kbfsPath: descStyle,
  link: descStyle,
  mailto: descStyle,
  paragraph: descStyle,
  preview: descStyle,
  strong: descStyle,
} as any

const Header = (p: Props) => {
  let description = !!p.desc && (
    <Kb.Markdown
      smallStandaloneEmoji={true}
      style={styles.desc}
      styleOverride={descStyleOverride}
      lineClamp={1}
      selectable={true}
    >
      {p.desc}
    </Kb.Markdown>
  )
  if (p.isTeam && !p.desc && p.canEditDesc) {
    description = (
      <Kb.Text selectable={true} type="BodySmall" lineClamp={1}>
        Set a description using the <Kb.Text type="BodySmallBold">/headline</Kb.Text> command.
      </Kb.Text>
    )
  }
  if (p.isTeam && p.desc && p.canEditDesc) {
    description = (
      <Kb.WithTooltip position="bottom left" tooltip="Set the description using the /headline command.">
        {description}
      </Kb.WithTooltip>
    )
  }
  // length ===1 means just you so show yourself
  const withoutSelf =
    p.participants && p.participants.length > 1
      ? p.participants.filter(part => part !== p.username)
      : p.participants

  // if there is no description (and is not a 1-on-1), don't render the description box
  const renderDescription = description || (withoutSelf && withoutSelf.length === 1)

  // trim() call makes sure that string is not just whitespace
  if (withoutSelf && withoutSelf.length === 1 && p.desc.trim()) {
    description = (
      <>
        <Kb.Text type="BodySmall" style={styles.desc}>
          &nbsp;•&nbsp;
        </Kb.Text>
        <Kb.Markdown
          smallStandaloneEmoji={true}
          style={{...styles.desc, flex: 1}}
          styleOverride={descStyleOverride}
          lineClamp={1}
          selectable={true}
        >
          {p.desc}
        </Kb.Markdown>
      </>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="vertical" style={styles.left}>
        <ChatInboxHeader />
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        style={styles.right}
        gap="small"
        alignItems="flex-end"
        alignSelf="flex-end"
      >
        <Kb.Box2
          direction="vertical"
          style={renderDescription ? styles.headerTitle : styles.headerTitleNoDesc}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            {p.channel ? (
              <Kb.Text selectable={true} type="Header" lineClamp={1}>
                {p.channel}
              </Kb.Text>
            ) : withoutSelf && withoutSelf.length === 1 ? (
              <Kb.Text type="Header" lineClamp={1}>
                {p.fullName || withoutSelf[0]}
              </Kb.Text>
            ) : withoutSelf ? (
              <Kb.Box2 direction="horizontal" style={Styles.globalStyles.flexOne}>
                <Kb.Text type="Header" lineClamp={1}>
                  {withoutSelf.map((part, i) => (
                    <Kb.Text type="Header" key={part}>
                      <Kb.ConnectedUsernames
                        colorFollowing={true}
                        underline={true}
                        inline={true}
                        commaColor={Styles.globalColors.black_50}
                        type="Header"
                        usernames={[part]}
                        onUsernameClicked="profile"
                      />
                      {i !== withoutSelf.length - 1 && <Kb.Text type="Header">, </Kb.Text>}
                    </Kb.Text>
                  ))}
                </Kb.Text>
              </Kb.Box2>
            ) : null}
            {p.muted && (
              <Kb.Icon
                type="iconfont-shh"
                style={styles.shhIconStyle}
                color={Styles.globalColors.black_20}
                fontSize={20}
                onClick={p.unMuteConversation}
              />
            )}
          </Kb.Box2>
          {renderDescription && (
            <Kb.Box2 direction="vertical" style={styles.descriptionContainer} fullWidth={true}>
              {withoutSelf && withoutSelf.length === 1 ? (
                <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
                  <Kb.ConnectedUsernames
                    colorFollowing={true}
                    underline={true}
                    inline={true}
                    commaColor={Styles.globalColors.black_50}
                    type="BodySmallSemibold"
                    usernames={[withoutSelf[0]]}
                    onUsernameClicked="profile"
                  />
                  {description}
                </Kb.Box2>
              ) : (
                description
              )}
            </Kb.Box2>
          )}
        </Kb.Box2>
        {p.showActions && (
          <Kb.Box2
            direction="horizontal"
            gap="small"
            alignItems="flex-end"
            alignSelf="flex-end"
            style={styles.actionIcons}
          >
            <Kb.WithTooltip tooltip={`Search in this chat (${Platforms.shortcutSymbol}F)`}>
              <Kb.Icon style={styles.clickable} type="iconfont-search" onClick={p.onToggleThreadSearch} />
            </Kb.WithTooltip>
            <Kb.WithTooltip tooltip="Open folder">
              <Kb.Icon style={styles.clickable} type="iconfont-folder-private" onClick={p.onOpenFolder} />
            </Kb.WithTooltip>
            <Kb.WithTooltip tooltip="Chat info & settings">
              <Kb.Icon
                style={styles.clickable}
                type="iconfont-info"
                onClick={p.onToggleInfoPanel}
                color={p.infoPanelOpen ? Styles.globalColors.blue : undefined}
              />
            </Kb.WithTooltip>
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionIcons: {
        paddingBottom: Styles.globalMargins.tiny,
      },
      clickable: Styles.platformStyles({isElectron: Styles.desktopStyles.windowDraggingClickable}),
      container: {
        flexGrow: 1,
        height: 40 - 1,
      },
      desc: {
        ...Styles.platformStyles({isElectron: Styles.desktopStyles.windowDraggingClickable}),
        color: Styles.globalColors.black_50,
      },
      descriptionContainer: {
        height: 17,
        overflow: 'hidden',
      },
      headerTitle: Styles.platformStyles({
        common: {flexGrow: 1, paddingBottom: Styles.globalMargins.xtiny},
        isElectron: Styles.desktopStyles.windowDraggingClickable,
      }),
      headerTitleNoDesc: Styles.platformStyles({
        common: {flexGrow: 1, paddingBottom: Styles.globalMargins.tiny},
        isElectron: Styles.desktopStyles.windowDraggingClickable,
      }),
      left: {minWidth: 260},
      right: {
        flexGrow: 1,
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.xsmall,
      },
      shhIconStyle: {
        marginLeft: Styles.globalMargins.xtiny,
      },
    } as const)
)

const Connected = Container.connect(
  state => {
    const _conversationIDKey = Constants.getSelectedConversation(state)
    const userInfo = state.users.infoMap
    const _meta = Constants.getMeta(state, _conversationIDKey)

    const otherParticipants = Constants.getRowParticipants(_meta, state.config.username)
    const first: string =
      _meta.teamType === 'adhoc' && otherParticipants.length === 1 ? otherParticipants[0] : ''
    const otherInfo = userInfo.get(first)
    // If it's a one-on-one chat, use the user's fullname as the description
    const desc = (otherInfo && otherInfo.bio.replace(/(\r\n|\n|\r)/gm, ' ')) || _meta.descriptionDecorated
    const fullName = otherInfo && otherInfo.fullname

    return {
      _conversationIDKey,
      _meta,
      canEditDesc: TeamConstants.getCanPerform(state, _meta.teamname).editChannelDescription,
      desc,
      fullName,
      infoPanelOpen: Constants.isInfoPanelOpen(),
      username: state.config.username,
    }
  },
  dispatch => ({
    _onOpenFolder: conversationIDKey => dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
    onNewChat: () => dispatch(appendNewChatBuilder()),
    onToggleInfoPanel: () => dispatch(Chat2Gen.createToggleInfoPanel()),
    onToggleThreadSearch: conversationIDKey =>
      dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
    onUnMuteConversation: conversationIDKey =>
      dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const meta = stateProps._meta

    return {
      canEditDesc: stateProps.canEditDesc,
      channel:
        meta.teamType === 'big'
          ? `${meta.teamname}#${meta.channelname}`
          : meta.teamType === 'small'
          ? meta.teamname
          : null,
      desc: stateProps.desc,
      fullName: stateProps.fullName,
      infoPanelOpen: stateProps.infoPanelOpen,
      isTeam: ['small', 'big'].includes(meta.teamType),
      muted: meta.isMuted,
      onNewChat: dispatchProps.onNewChat,
      onOpenFolder: () => dispatchProps._onOpenFolder(stateProps._conversationIDKey),
      onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
      onToggleThreadSearch: () => dispatchProps.onToggleThreadSearch(stateProps._conversationIDKey),
      participants: meta.teamType === 'adhoc' ? meta.nameParticipants : null,
      showActions: Constants.isValidConversationIDKey(stateProps._conversationIDKey),
      unMuteConversation: () => dispatchProps.onUnMuteConversation(stateProps._conversationIDKey),
      username: stateProps.username,
    }
  }
)(Header)

export default Connected
