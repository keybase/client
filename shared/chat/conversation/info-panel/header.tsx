import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as TeamConstants from '../../../constants/teams'
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import InfoPanelMenu from './menu/container'
import * as ChatTypes from '../../../constants/types/chat2'
import AddPeople from './add-people'
import {pluralize} from '../../../util/string'

type SmallProps = {conversationIDKey: ChatTypes.ConversationIDKey} & Kb.OverlayParentProps

const gearIconSize = Styles.isMobile ? 24 : 16

const _TeamHeader = (props: SmallProps) => {
  const {conversationIDKey, toggleShowingMenu, getAttachmentRef, showingMenu, setAttachmentRef} = props
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
  let title = teamname
  if (channelname && !isSmallTeam) {
    title += '#' + channelname
  }
  const isGeneralChannel = !!(channelname && channelname === 'general')
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <Kb.Box2 direction="horizontal" style={styles.smallContainer} fullWidth={true}>
        <InfoPanelMenu
          attachTo={getAttachmentRef}
          onHidden={toggleShowingMenu}
          isSmallTeam={isSmallTeam}
          conversationIDKey={conversationIDKey}
          visible={showingMenu}
        />
        <Kb.ConnectedNameWithIcon
          containerStyle={styles.flexOne}
          horizontal={true}
          teamname={teamname}
          onClick="profile"
          title={title}
          metaOne={
            participantCount ? `${participantCount} ${pluralize('member', participantCount)}` : 'Loading...'
          }
        />
        <Kb.Icon
          type="iconfont-gear"
          onClick={toggleShowingMenu}
          ref={setAttachmentRef}
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
        <AddPeople
          isAdmin={admin}
          isGeneralChannel={isGeneralChannel}
          conversationIDKey={conversationIDKey}
        />
      )}
    </Kb.Box2>
  )
}
const TeamHeader = Kb.OverlayParentHOC(_TeamHeader)

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
          paddingLeft: 16,
          paddingRight: 16,
          width: gearIconSize,
        },
        isMobile: {width: gearIconSize + 32},
      }),
      smallContainer: {
        alignItems: 'center',
        paddingLeft: Styles.globalMargins.small,
      },
    } as const)
)

export {TeamHeader}
