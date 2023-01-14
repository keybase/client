import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Constants from '../constants/chat2'
import * as TeamConstants from '../constants/teams'
import * as Platforms from '../constants/platform'
import * as Chat2Gen from '../actions/chat2-gen'
import * as Styles from '../styles'
import * as Container from '../util/container'
import ChatInboxHeader from './inbox/header/container'
import shallowEqual from 'shallowequal'

type Props = Container.RouteProps<'chatRoot'>

const Header = (props: Props) => {
  const conversationIDKey = props.route.params?.conversationIDKey ?? Constants.noConversationIDKey
  const data = Container.useSelector(state => {
    const meta = Constants.getMeta(state, conversationIDKey)
    const {channelname, descriptionDecorated, isMuted, teamType, teamname} = meta
    const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const username = state.config.username
    const infoPanelShowing = state.chat2.infoPanelShowing
    const canEditDesc = TeamConstants.getCanPerform(state, teamname).editChannelDescription
    return {
      canEditDesc,
      channelname,
      descriptionDecorated,
      infoPanelShowing,
      isMuted,
      participantInfo,
      teamType,
      teamname,
      username,
    }
  }, shallowEqual)

  const {canEditDesc, channelname, descriptionDecorated, infoPanelShowing, isMuted} = data
  const {participantInfo, teamType, teamname, username} = data
  const otherParticipants = Constants.getRowParticipants(participantInfo, username)
  const first: string = teamType === 'adhoc' && otherParticipants.length === 1 ? otherParticipants[0] : ''
  const otherInfo = Container.useSelector(state => state.users.infoMap.get(first))
  // If it's a one-on-one chat, use the user's fullname as the description
  const desc = (otherInfo?.bio && otherInfo.bio.replace(/(\r\n|\n|\r)/gm, ' ')) || descriptionDecorated
  const fullName = otherInfo?.fullname

  const dispatch = Container.useDispatch()
  const onOpenFolder = React.useCallback(() => {
    dispatch(Chat2Gen.createOpenFolder({conversationIDKey}))
  }, [dispatch, conversationIDKey])
  const onToggleThreadSearch = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey}))
  }, [dispatch, conversationIDKey])
  const unMuteConversation = React.useCallback(() => {
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false}))
  }, [dispatch, conversationIDKey])
  const onToggleInfoPanel = React.useCallback(() => {
    dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: !infoPanelShowing}))
  }, [dispatch, conversationIDKey, infoPanelShowing])

  const channel = teamType === 'big' ? `${teamname}#${channelname}` : teamType === 'small' ? teamname : null
  const isTeam = ['small', 'big'].includes(teamType)
  const muted = isMuted
  const participants = teamType === 'adhoc' ? participantInfo.name : null
  const showActions = Constants.isValidConversationIDKey(conversationIDKey)

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
      <Kb.WithTooltip position="bottom left" tooltip="Set the description using the /headline command.">
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
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="vertical" style={styles.left}>
        <ChatInboxHeader headerContext="chat-header" />
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
                color={Styles.globalColors.black_20}
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
                    commaColor={Styles.globalColors.black_50}
                    type="BodySmallBold"
                    usernames={withoutSelf[0]}
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
            <Kb.WithTooltip tooltip={`Search in this chat (${Platforms.shortcutSymbol}F)`}>
              <Kb.Icon style={styles.clickable} type="iconfont-search" onClick={onToggleThreadSearch} />
            </Kb.WithTooltip>
            <Kb.WithTooltip tooltip="Open folder">
              <Kb.Icon style={styles.clickable} type="iconfont-folder-private" onClick={onOpenFolder} />
            </Kb.WithTooltip>
            <Kb.WithTooltip tooltip="Chat info & settings">
              <Kb.Icon
                color={infoPanelShowing ? Styles.globalColors.blue : undefined}
                style={styles.clickable}
                type="iconfont-info"
                onClick={onToggleInfoPanel}
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
      descriptionTextContainer: Styles.platformStyles({
        isElectron: {
          alignItems: 'baseline',
        },
        isTablet: {
          alignItems: 'baseline',
        },
      }),
      headerTitle: Styles.platformStyles({
        common: {
          flexGrow: 1,
          paddingBottom: Styles.globalMargins.xtiny,
        },
        isElectron: Styles.desktopStyles.windowDraggingClickable,
        isTablet: {
          flex: 1,
        },
      }),
      left: Styles.platformStyles({
        common: {width: Styles.globalStyles.mediumSubNavWidth},
        isTablet: {
          paddingLeft: Styles.globalMargins.small,
        },
      }),
      markdownOverride: Styles.platformStyles({
        common: {
          fontSize: 13,
          lineHeight: 17,
        },
        isElectron: {
          fontSize: 13,
          lineHeight: 17,
          wordBreak: 'break-all',
        },
        isMobile: {
          color: Styles.globalColors.black_50 as any,
          fontSize: 15,
          lineHeight: 19,
        },
      } as any),
      right: Styles.platformStyles({
        common: {
          flex: 1,
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.tiny,
        },
      }),
      shhIconStyle: {
        marginLeft: Styles.globalMargins.xtiny,
      },
    } as const)
)

export default Header
