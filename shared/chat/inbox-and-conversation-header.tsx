import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import SearchRow from './inbox/search-row'
import NewChatButton from './inbox/new-chat-button'
import {useRoute} from '@react-navigation/native'
import type {RootRouteProps} from '@/router-v2/route-params'

const Header = () => {
  const {params} = useRoute<RootRouteProps<'chatRoot'>>()
  return (
    <C.ChatProvider canBeNull={true} id={params?.conversationIDKey ?? C.Chat.noConversationIDKey}>
      <Header2 />
    </C.ChatProvider>
  )
}

const Header2 = () => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const username = C.useCurrentUserState(s => s.username)
  const infoPanelShowing = C.useChatState(s => s.infoPanelShowing)
  const participantInfo = C.useChatContext(s => s.participants)
  const {channelname, descriptionDecorated, isMuted, teamType, teamname} = C.useChatContext(
    C.useShallow(s => {
      const {channelname, descriptionDecorated, isMuted, teamType, teamname} = s.meta
      return {channelname, descriptionDecorated, isMuted, teamType, teamname}
    })
  )
  // TODO not reactive
  const canEditDesc = C.Teams.getCanPerform(C.useTeamsState.getState(), teamname).editChannelDescription
  const otherParticipants = C.Chat.getRowParticipants(participantInfo, username)
  const first: string = teamType === 'adhoc' && otherParticipants.length === 1 ? otherParticipants[0]! : ''
  const otherInfo = C.useUsersState(s => s.infoMap.get(first))
  // If it's a one-on-one chat, use the user's fullname as the description
  const desc = otherInfo?.bio?.replace(/(\r\n|\n|\r)/gm, ' ') || descriptionDecorated
  const fullName = otherInfo?.fullname

  const onOpenFolder = C.useChatContext(s => s.dispatch.openFolder)
  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const onToggleThreadSearch = React.useCallback(() => {
    toggleThreadSearch()
  }, [toggleThreadSearch])
  const mute = C.useChatContext(s => s.dispatch.mute)
  const unMuteConversation = React.useCallback(() => {
    mute(false)
  }, [mute])

  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onToggleInfoPanel = React.useCallback(() => {
    showInfoPanel(!infoPanelShowing, undefined)
  }, [showInfoPanel, infoPanelShowing])

  const channel = teamType === 'big' ? `${teamname}#${channelname}` : teamType === 'small' ? teamname : null
  const isTeam = ['small', 'big'].includes(teamType)
  const muted = isMuted
  const participants = teamType === 'adhoc' ? participantInfo.name : null
  const showActions = C.Chat.isValidConversationIDKey(conversationIDKey)

  const descStyleOverride = React.useMemo(
    () => ({
      del: styles.markdownOverride,
      em: styles.markdownOverride,
      fence: styles.markdownOverride,
      inlineCode: styles.markdownOverride,
      kbfsPath: styles.markdownOverride,
      link: styles.markdownOverride,
      mailto: styles.markdownOverride,
      paragraph: styles.markdownOverride,
      preview: styles.markdownOverride,
      strong: styles.markdownOverride,
    }),
    []
  )

  let description = !!desc && (
    <Kb.Markdown
      smallStandaloneEmoji={true}
      style={styles.desc}
      styleOverride={descStyleOverride as any}
      lineClamp={1}
      selectable={true}
    >
      {desc}
    </Kb.Markdown>
  )
  if (isTeam && !desc && canEditDesc) {
    description = (
      <Kb.Text selectable={true} type="BodySmall" lineClamp={1}>
        Set a description using the <Kb.Text type="BodySmallBold">/headline</Kb.Text> command.
      </Kb.Text>
    )
  }
  if (isTeam && desc && canEditDesc) {
    description = (
      <Kb.WithTooltip
        position="bottom left"
        tooltip="Set the description using the /headline command."
        containerStyle={styles.descriptionTooltip}
      >
        {description}
      </Kb.WithTooltip>
    )
  }
  // length ===1 means just you so show yourself
  const withoutSelf =
    participants && participants.length > 1 ? participants.filter(part => part !== username) : participants

  // if there is no description (and is not a 1-on-1), don't render the description box
  const renderDescription = description || (fullName && withoutSelf && withoutSelf.length === 1)

  // trim() call makes sure that string is not just whitespace
  if (withoutSelf && withoutSelf.length === 1 && desc.trim()) {
    description = (
      <Kb.Markdown
        smallStandaloneEmoji={true}
        style={{...styles.desc, flex: 1}}
        styleOverride={descStyleOverride as any}
        lineClamp={1}
        selectable={true}
      >
        {desc}
      </Kb.Markdown>
    )
  }

  return (
    <Kb.Box2 direction="horizontal" style={styles.container}>
      <Kb.Box2 direction="horizontal" style={styles.left}>
        {Kb.Styles.isMobile ? null : <SearchRow headerContext="chat-header" />}
        <NewChatButton />
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        style={styles.right}
        fullHeight={!renderDescription}
        gap="small"
        alignItems="flex-end"
        alignSelf="flex-end"
      >
        <Kb.Box2 direction="vertical" style={styles.headerTitle}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            {channel ? (
              <Kb.Text selectable={true} type="Header" lineClamp={1}>
                {channel}
              </Kb.Text>
            ) : fullName ? (
              <Kb.Text type="Header" lineClamp={1}>
                {fullName}
              </Kb.Text>
            ) : withoutSelf ? (
              <Kb.Box2 direction="horizontal" style={Kb.Styles.globalStyles.flexOne}>
                <Kb.Text type="Header" lineClamp={1}>
                  {withoutSelf.map((part, i) => (
                    <Kb.Text type="Header" key={part}>
                      <Kb.ConnectedUsernames
                        colorFollowing={true}
                        underline={true}
                        inline={true}
                        commaColor={Kb.Styles.globalColors.black_50}
                        type="Header"
                        usernames={part}
                        onUsernameClicked="profile"
                      />
                      {i !== withoutSelf.length - 1 && <Kb.Text type="Header">, </Kb.Text>}
                    </Kb.Text>
                  ))}
                </Kb.Text>
              </Kb.Box2>
            ) : null}
            {!!muted && (
              <Kb.Icon
                type="iconfont-shh"
                style={styles.shhIconStyle}
                color={Kb.Styles.globalColors.black_20}
                fontSize={20}
                onClick={unMuteConversation}
              />
            )}
          </Kb.Box2>
          {!!renderDescription && (
            <Kb.Box2 direction="vertical" style={styles.descriptionContainer} fullWidth={true}>
              {!!fullName && !!withoutSelf && withoutSelf.length === 1 ? (
                <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.descriptionTextContainer}>
                  <Kb.ConnectedUsernames
                    colorFollowing={true}
                    underline={true}
                    inline={true}
                    commaColor={Kb.Styles.globalColors.black_50}
                    type="BodySmallBold"
                    usernames={withoutSelf[0] ?? ''}
                    onUsernameClicked="profile"
                  />
                  {!!description && (
                    <>
                      <Kb.Text type="BodySmall" style={styles.desc}>
                        &nbsp;•&nbsp;
                      </Kb.Text>
                      {description}
                    </>
                  )}
                </Kb.Box2>
              ) : (
                description
              )}
            </Kb.Box2>
          )}
        </Kb.Box2>
        {showActions && (
          <Kb.Box2
            direction="horizontal"
            gap="small"
            alignItems="flex-end"
            alignSelf="flex-end"
            style={styles.actionIcons}
          >
            <Kb.Box2
              className="tooltip-left"
              direction="vertical"
              tooltip={`Search in this chat (${C.shortcutSymbol}F)`}
            >
              <Kb.Icon style={styles.clickable} type="iconfont-search" onClick={onToggleThreadSearch} />
            </Kb.Box2>
            <Kb.Box2 className="tooltip-left" direction="vertical" tooltip="Open folder">
              <Kb.Icon style={styles.clickable} type="iconfont-folder-private" onClick={onOpenFolder} />
            </Kb.Box2>
            <Kb.Box2 className="tooltip-left" direction="vertical" tooltip="Chat info & settings">
              <Kb.Icon
                color={infoPanelShowing ? Kb.Styles.globalColors.blue : undefined}
                style={styles.clickable}
                type="iconfont-info"
                onClick={onToggleInfoPanel}
              />
            </Kb.Box2>
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      actionIcons: {paddingBottom: Kb.Styles.globalMargins.tiny},
      clickable: Kb.Styles.platformStyles({isElectron: Kb.Styles.desktopStyles.windowDraggingClickable}),
      container: {
        flexGrow: 1,
        flexShrink: 0,
        height: 40 - 1,
        width: '100%',
      },
      desc: {
        ...Kb.Styles.platformStyles({isElectron: Kb.Styles.desktopStyles.windowDraggingClickable}),
        color: Kb.Styles.globalColors.black_50,
      },
      descriptionContainer: {
        height: 17,
        overflow: 'hidden',
      },
      descriptionTextContainer: Kb.Styles.platformStyles({
        isElectron: {alignItems: 'baseline'},
        isTablet: {alignItems: 'baseline'},
      }),
      descriptionTooltip: {alignItems: 'flex-start'},
      headerTitle: Kb.Styles.platformStyles({
        common: {
          flexGrow: 1,
          paddingBottom: Kb.Styles.globalMargins.xtiny,
        },
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
        isTablet: {flex: 1},
      }),
      left: Kb.Styles.platformStyles({
        common: {
          height: Kb.Styles.isTablet ? 36 : 32,
          width: Kb.Styles.globalStyles.mediumSubNavWidth,
        },
        isTablet: {paddingLeft: Kb.Styles.globalMargins.small},
      }),
      markdownOverride: Kb.Styles.platformStyles({
        common: {
          fontSize: 13,
          lineHeight: 17,
        },
        isElectron: {
          display: 'flex',
          fontSize: 13,
          lineHeight: 17,
          wordBreak: 'break-all',
        },
        isMobile: {
          color: Kb.Styles.globalColors.black_50,
          fontSize: 15,
          lineHeight: 19,
        },
      } as any),
      right: Kb.Styles.platformStyles({
        common: {
          flex: 1,
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
        },
        isMobile: {paddingLeft: Kb.Styles.globalMargins.tiny},
      }),
      shhIconStyle: {marginLeft: Kb.Styles.globalMargins.xtiny},
    }) as const
)

export default Header
