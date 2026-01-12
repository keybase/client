import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import InfoPanelMenu from './menu'
import * as InfoPanelCommon from './common'
import AddPeople from './add-people'

const gearIconSize = Kb.Styles.isMobile ? 24 : 16

const TeamHeader = () => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const meta = Chat.useChatContext(s => s.meta)
  const {teamname, teamID, channelname, descriptionDecorated: description, membershipType, teamType} = meta
  const participants = Chat.useChatContext(s => s.participants)
  const onJoinChannel = Chat.useChatContext(s => s.dispatch.joinConversation)
  const {channelHumans, teamHumanCount} = InfoPanelCommon.useHumans(participants, meta)

  const yourOperations = Teams.useTeamsState(s => (teamname ? Teams.getCanPerformByID(s, teamID) : undefined))
  const admin = yourOperations?.manageMembers ?? false
  const isPreview = membershipType === 'youArePreviewing'
  const isSmallTeam = !!teamname && !!channelname && teamType !== 'big'
  let title = teamname
  if (channelname && !isSmallTeam) {
    title += '#' + channelname
  }
  const isGeneralChannel = !!(channelname && channelname === 'general')

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Chat.ChatProvider id={conversationIDKey}>
          <InfoPanelMenu
            attachTo={attachTo}
            floatingMenuContainerStyle={styles.floatingMenuContainerStyle}
            onHidden={hidePopup}
            hasHeader={false}
            isSmallTeam={isSmallTeam}
            visible={true}
          />
        </Chat.ChatProvider>
      )
    },
    [conversationIDKey, isSmallTeam]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Kb.Box2 direction="horizontal" style={styles.smallContainer} fullWidth={true}>
        {popup}
        {isSmallTeam ? (
          <>
            <Kb.ConnectedNameWithIcon
              containerStyle={styles.flexOne}
              horizontal={true}
              teamname={teamname}
              onClick="profile"
              title={title}
            />
            <Kb.Meta
              backgroundColor={Kb.Styles.globalColors.blueGrey}
              color={Kb.Styles.globalColors.black_50}
              icon="iconfont-people-solid"
              iconColor={Kb.Styles.globalColors.black_20}
              style={styles.meta}
              title={channelHumans.length}
            />
          </>
        ) : (
          <Kb.Box2 direction="vertical" gap="xxtiny" style={styles.channelnameContainer}>
            <Kb.Box2
              alignSelf="flex-start"
              direction="horizontal"
              fullWidth={true}
              style={styles.textWrapper}
            >
              <Kb.Text lineClamp={1} type="Body" style={styles.channelName}>
                # <Kb.Text type="BodyBold">{channelname}</Kb.Text>
              </Kb.Text>
              {!isGeneralChannel && (
                <Kb.Meta
                  backgroundColor={Kb.Styles.globalColors.blueGrey}
                  color={Kb.Styles.globalColors.black_50}
                  icon="iconfont-people-solid"
                  iconColor={Kb.Styles.globalColors.black_20}
                  title={channelHumans.length}
                />
              )}
            </Kb.Box2>
            <Kb.Box2
              alignSelf="flex-start"
              direction="horizontal"
              fullWidth={true}
              style={styles.textWrapper}
            >
              <Kb.Box2 direction="horizontal" gap="xtiny">
                <Kb.Avatar teamname={teamname} size={16} />
                <Kb.Text type="BodySmallSemibold">{teamname}</Kb.Text>
              </Kb.Box2>
              <Kb.Meta
                backgroundColor={Kb.Styles.globalColors.blueGrey}
                color={Kb.Styles.globalColors.black_50}
                icon="iconfont-people-solid"
                iconColor={Kb.Styles.globalColors.black_20}
                title={teamHumanCount}
              />
            </Kb.Box2>
          </Kb.Box2>
        )}
        <Kb.Icon
          type="iconfont-gear"
          onClick={showPopup}
          ref={popupAnchor}
          style={styles.gear}
          fontSize={gearIconSize}
        />
      </Kb.Box2>
      {!!description && (
        <Kb.Box2 direction="horizontal" style={styles.description}>
          <Kb.Markdown smallStandaloneEmoji={true} selectable={true}>
            {description}
          </Kb.Markdown>
        </Kb.Box2>
      )}
      {isPreview && (
        <Kb.Button
          mode="Primary"
          type="Default"
          label="Join channel"
          style={styles.addMembers}
          onClick={onJoinChannel}
        />
      )}
      {!isPreview && (admin || !isGeneralChannel) && (
        <AddPeople isAdmin={admin} isGeneralChannel={isGeneralChannel} />
      )}
    </Kb.Box2>
  )
}

export const AdhocHeader = () => {
  const navigateAppend = Chat.useChatNavigateAppend()
  const onShowNewTeamDialog = () => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey},
      selected: 'chatShowNewTeamDialog',
    }))
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
      <Kb.Button
        mode="Primary"
        type="Default"
        label="Turn into a team"
        style={styles.addMembers}
        onClick={onShowNewTeamDialog}
      />
      <Kb.Text type="BodyTiny" center={true}>
        Add and delete members as you wish.
      </Kb.Text>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addMembers: {
        alignSelf: undefined,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
      },
      adhocPartContainer: {padding: Kb.Styles.globalMargins.tiny},
      adhocScrollContainer: Kb.Styles.platformStyles({
        isElectron: {maxHeight: 230},
        isMobile: {maxHeight: 220},
      }),
      channelName: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-all'},
      }),
      channelnameContainer: {flex: 1},
      description: {
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
      editBox: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        position: 'absolute',
        right: -50,
        top: Kb.Styles.isMobile ? 2 : 1,
      },
      editIcon: {marginRight: Kb.Styles.globalMargins.xtiny},
      flexOne: {flex: 1},
      floatingMenuContainerStyle: Kb.Styles.platformStyles({
        isElectron: {
          marginRight: Kb.Styles.globalMargins.small,
        },
      }),
      gear: Kb.Styles.platformStyles({
        common: {
          height: gearIconSize,
          paddingLeft: 16,
          paddingRight: 16,
          width: gearIconSize,
        },
        isMobile: {width: gearIconSize + 32},
      }),
      meta: {alignSelf: 'center'},
      smallContainer: {
        alignItems: 'center',
        paddingLeft: Kb.Styles.globalMargins.small,
      },
      textWrapper: {
        flex: 1,
        justifyContent: 'space-between',
      },
    }) as const
)

export {TeamHeader}
