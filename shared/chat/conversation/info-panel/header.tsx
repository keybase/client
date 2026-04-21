import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import InfoPanelMenu from './menu'
import * as InfoPanelCommon from './common'
import AddPeople from './add-people'
import {ChatTeamProvider, useChatTeam} from '../team-hooks'

const gearIconSize = Kb.Styles.isMobile ? 24 : 16

const TeamHeader = () => {
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const meta = ConvoState.useChatContext(s => s.meta)
  const {teamname, teamID, channelname, descriptionDecorated: description, membershipType, teamType} = meta
  const participants = ConvoState.useChatContext(s => s.participants)
  const onJoinChannel = ConvoState.useChatContext(s => s.dispatch.joinConversation)
  const {channelHumans, teamHumanCount} = InfoPanelCommon.useHumans(participants, meta)

  const {yourOperations} = useChatTeam(teamID, teamname)
  const admin = yourOperations?.manageMembers ?? false
  const isPreview = membershipType === 'youArePreviewing'
  const isSmallTeam = !!teamname && !!channelname && teamType !== 'big'
  let title = teamname
  if (channelname && !isSmallTeam) {
    title += '#' + channelname
  }
  const isGeneralChannel = !!(channelname && channelname === 'general')

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <ConvoState.ChatProvider id={conversationIDKey}>
        <ChatTeamProvider>
          <InfoPanelMenu
            attachTo={attachTo}
            floatingMenuContainerStyle={styles.floatingMenuContainerStyle}
            onHidden={hidePopup}
            hasHeader={false}
            isSmallTeam={isSmallTeam}
            visible={true}
          />
        </ChatTeamProvider>
      </ConvoState.ChatProvider>
    )
  }
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
          <Kb.Box2 direction="vertical" gap="xxtiny" flex={1}>
            <Kb.Box2
              alignSelf="flex-start"
              direction="horizontal"
              fullWidth={true}
              flex={1}
              justifyContent="space-between"
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
              flex={1}
              justifyContent="space-between"
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
        <Kb.Box2 direction="vertical" ref={popupAnchor} style={styles.gear}>
          <Kb.Icon
            type="iconfont-gear"
            onClick={showPopup}
            fontSize={gearIconSize}
          />
        </Kb.Box2>
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
  const navigateAppend = ConvoState.useChatNavigateAppend()
  const onShowNewTeamDialog = () => {
    navigateAppend(conversationIDKey => ({
      name: 'chatShowNewTeamDialog',
      params: {conversationIDKey},
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
      channelName: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-all'},
      }),
      description: {
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
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
        },
        isMobile: {width: gearIconSize + 32},
      }),
      meta: {alignSelf: 'center'},
      smallContainer: {
        alignItems: 'center',
        paddingLeft: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export {TeamHeader}
