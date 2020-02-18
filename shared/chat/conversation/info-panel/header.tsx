import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as TeamConstants from '../../../constants/teams'
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import InfoPanelMenu from './menu/container'
import TeamMenu from './menu/container'
import * as ChatTypes from '../../../constants/types/chat2'
import AddPeople from './add-people'
import {pluralize} from '../../../util/string'

type SmallProps = {conversationIDKey: ChatTypes.ConversationIDKey}

const gearIconSize = Styles.isMobile ? 24 : 16

const TeamHeader = (props: SmallProps) => {
  const {conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {teamname, teamID, channelname, descriptionDecorated: description, membershipType, teamType} = meta
  const yourOperations = Container.useSelector(state =>
    teamname ? TeamConstants.getCanPerformByID(state, teamID) : undefined
  )
  const admin = yourOperations?.manageMembers ?? false
  const isPreview = membershipType === 'youArePreviewing'
  const isSmallTeam = !!teamname && !!channelname && teamType !== 'big'
  const onJoinChannel = () => dispatch(Chat2Gen.createJoinConversation({conversationIDKey}))
  const participantCount = Container.useSelector(
    state => Constants.getParticipantInfo(state, conversationIDKey)?.all?.length ?? 0
  )
  const isGeneralChannel = !!(channelname && channelname === 'general')

  const {
    showingPopup: showingTeamMenuPopup,
    setShowingPopup: setShowingTeamMenuPopup,
    popup: teamMenuPopup,
    popupAnchor: teamMenuPopupRef,
  } = Kb.usePopup(attachTo => (
    <TeamMenu
      attachTo={attachTo}
      visible={showingTeamMenuPopup}
      onHidden={() => setShowingTeamMenuPopup(false)}
      conversationIDKey={conversationIDKey}
      teamID={teamID}
      isSmallTeam={false}
      isOnRight={true}
    />
  ))

  const {
    showingPopup: showingChannelMenuPopup,
    setShowingPopup: setShowingChannelMenuPopup,
    popup: channelMenuPopup,
    popupAnchor: channelMenuPopupRef,
  } = Kb.usePopup(attachTo => (
    <InfoPanelMenu
      attachTo={attachTo}
      onHidden={() => setShowingChannelMenuPopup(false)}
      isSmallTeam={isSmallTeam}
      conversationIDKey={conversationIDKey}
      visible={showingChannelMenuPopup}
      isOnRight={true}
    />
  ))

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Kb.Box2 direction="horizontal" style={styles.smallContainer} fullWidth={true}>
        <Kb.ConnectedNameWithIcon
          containerStyle={styles.flexOne}
          horizontal={true}
          teamname={teamname}
          onClick="profile"
          title={
            isSmallTeam ? (
              teamname
            ) : (
              <Kb.Box
                className="hover_background_color_green"
                onClick={() => setShowingTeamMenuPopup(!showingTeamMenuPopup)}
                ref={teamMenuPopupRef}
                style={{
                  ...Styles.globalStyles.flexBoxRow,
                  borderRadius: Styles.borderRadius,
                  width: '100%',
                }}
              >
                {teamMenuPopup}
                <Kb.Box2 alignSelf="flex-start" direction="horizontal" style={styles.flexOne}>
                  <Kb.Text lineClamp={1} type="BodySemibold">
                    {teamname}
                  </Kb.Text>
                </Kb.Box2>
                <Kb.Box2 alignItems="center" alignSelf="flex-end" direction="horizontal">
                  <Kb.Text lineClamp={1} type="BodySmall">
                    {`${participantCount} ${pluralize('member', participantCount)}`}
                  </Kb.Text>
                  <Kb.Icon type="iconfont-gear" style={styles.gear} fontSize={gearIconSize} />
                </Kb.Box2>
              </Kb.Box>
            )
          }
          metaOne={
            participantCount ? (
              <Kb.Box
                className="hover_background_color_red"
                onClick={() => setShowingChannelMenuPopup(!showingChannelMenuPopup)}
                ref={channelMenuPopupRef}
                style={{
                  ...Styles.globalStyles.flexBoxRow,
                  borderRadius: Styles.borderRadius,
                  width: '100%',
                }}
              >
                {channelMenuPopup}
                <Kb.Box2 alignSelf="flex-start" direction="horizontal" style={styles.flexOne}>
                  <Kb.Text lineClamp={1} type="BodySmall">
                    # <Kb.Text type="BodySmall">{channelname}</Kb.Text>
                  </Kb.Text>
                </Kb.Box2>
                <Kb.Box2 alignItems="center" alignSelf="flex-end" direction="horizontal">
                  <Kb.Text lineClamp={1} type="BodySmall">
                    {`${participantCount} ${pluralize('member', participantCount)}`}
                  </Kb.Text>
                  <Kb.Icon type="iconfont-gear" style={styles.gear} fontSize={gearIconSize} />
                </Kb.Box2>
              </Kb.Box>
            ) : (
              'Loading...'
            )
          }
          metaStyle={{
            flex: 1,
          }}
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
        <AddPeople
          isAdmin={admin}
          isGeneralChannel={isGeneralChannel}
          conversationIDKey={conversationIDKey}
        />
      )}
    </Kb.Box2>
  )
}

type AdhocHeaderProps = {conversationIDKey: ChatTypes.ConversationIDKey}

export const AdhocHeader = (props: AdhocHeaderProps) => {
  const {conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const onShowNewTeamDialog = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey},
            selected: 'chatShowNewTeamDialog',
          },
        ],
      })
    )
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addMembers: {
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
      },
      adhocPartContainer: {padding: Styles.globalMargins.tiny},
      adhocScrollContainer: Styles.platformStyles({
        isElectron: {maxHeight: 230},
        isMobile: {maxHeight: 220},
      }),
      channelnameContainer: {
        alignSelf: 'center',
        marginBottom: 2,
        marginTop: Styles.globalMargins.medium,
        position: 'relative',
      },
      description: {
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      editBox: {
        ...Styles.globalStyles.flexBoxRow,
        position: 'absolute',
        right: -50,
        top: Styles.isMobile ? 2 : 1,
      },
      editIcon: {marginRight: Styles.globalMargins.xtiny},
      flexOne: {flex: 1},
      gear: Styles.platformStyles({
        common: {
          height: gearIconSize,
          paddingLeft: Styles.globalMargins.tiny,
          // paddingRight: 16,
          width: gearIconSize,
        },
        isMobile: {width: gearIconSize + 32},
      }),
      smallContainer: {
        alignItems: 'center',
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
    } as const)
)

export {TeamHeader}
