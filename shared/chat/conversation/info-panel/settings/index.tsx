import * as React from 'react'
import * as TeamConstants from '../../../../constants/teams'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import RetentionPicker from '../../../../teams/team/settings-tab/retention/container'
import MinWriterRole from './min-writer-role/container'
import Notifications from './notifications'
import {CaptionedDangerIcon} from './channel-utils'

type EntityType = 'adhoc' | 'small team' | 'channel'
type SettingsPanelProps = {conversationIDKey: Types.ConversationIDKey}

const SettingsPanel = (props: SettingsPanelProps) => {
  const {conversationIDKey} = props
  const dispatch = Container.useDispatch()
  const username = Container.useSelector(state => state.config.username)
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {status, teamname, teamType, channelname, teamID} = meta
  const yourOperations = Container.useSelector(state =>
    teamname ? TeamConstants.getCanPerformByID(state, teamID) : undefined
  )
  const ignored = status === RPCChatTypes.ConversationStatus.ignored
  const smallTeam = teamType !== 'big'

  const spinnerForHide = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.waitingKeyConvStatusChange(conversationIDKey))
  )

  const canDeleteHistory =
    teamname && yourOperations ? yourOperations.deleteChatHistory && !meta.cannotWrite : true

  let entityType: EntityType
  if (teamname && channelname) {
    entityType = smallTeam ? 'small team' : 'channel'
  } else {
    entityType = 'adhoc'
  }

  const teamMembers = Container.useSelector(state => state.teams.teamIDToMembers.get(teamID))
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )
  const membersForBlock = (teamMembers?.size ? [...teamMembers.keys()] : participantInfo.all).filter(
    u => u !== username && !Constants.isAssertion(u)
  )

  const onShowClearConversationDialog = () => {
    dispatch(Chat2Gen.createNavigateToThread())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey}, selected: 'chatDeleteHistoryWarning'}],
      })
    )
  }

  const onHideConv = () => dispatch(Chat2Gen.createHideConversation({conversationIDKey}))
  const onUnhideConv = () => dispatch(Chat2Gen.createUnhideConversation({conversationIDKey}))
  const onShowBlockConversationDialog = membersForBlock.length
    ? () => {
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              {
                props: {
                  blockUserByDefault: true,
                  convID: conversationIDKey,
                  others: membersForBlock,
                  team: teamname,
                },
                selected: 'chatBlockingModal',
              },
            ],
          })
        )
      }
    : onHideConv

  const onLeaveConversation = () => dispatch(Chat2Gen.createLeaveConversation({conversationIDKey}))

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.settingsContainer}>
      <Kb.ScrollView>
        <Notifications conversationIDKey={conversationIDKey} />
        <Kb.Divider style={styles.divider} />
        <RetentionPicker
          containerStyle={styles.retentionContainerStyle}
          conversationIDKey={['adhoc', 'channel'].includes(entityType) ? conversationIDKey : undefined}
          dropdownStyle={styles.retentionDropdownStyle}
          entityType={entityType}
          showSaveIndicator={true}
          teamID={teamID}
          type="auto"
        />
        {(entityType === 'channel' || entityType === 'small team') && (
          <>
            <Kb.Divider style={styles.divider} />
            <MinWriterRole conversationIDKey={conversationIDKey} isSmallTeam={entityType === 'small team'} />
          </>
        )}
        <Kb.Divider style={styles.divider} />
        {canDeleteHistory && (
          <CaptionedDangerIcon
            caption="Clear entire conversation"
            onClick={onShowClearConversationDialog}
            icon="iconfont-fire"
          />
        )}
        {entityType === 'adhoc' && (
          <CaptionedDangerIcon
            caption="Block"
            onClick={onShowBlockConversationDialog}
            icon="iconfont-remove"
          />
        )}
        {entityType !== 'channel' &&
          (ignored ? (
            <CaptionedDangerIcon
              caption="Unhide this conversation"
              icon="iconfont-unhide"
              onClick={onUnhideConv}
              noDanger={true}
              spinner={spinnerForHide}
            />
          ) : (
            <CaptionedDangerIcon
              caption="Hide this conversation"
              onClick={onHideConv}
              noDanger={true}
              icon="iconfont-hide"
              spinner={spinnerForHide}
            />
          ))}
        {entityType === 'channel' && channelname !== 'general' && (
          <CaptionedDangerIcon onClick={onLeaveConversation} caption="Leave channel" icon="iconfont-leave" />
        )}
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      divider: {
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
      membersContainer: {
        flex: 1,
        paddingTop: Styles.globalMargins.tiny,
      },
      retentionContainerStyle: Styles.platformStyles({
        common: {
          paddingLeft: 16,
          paddingRight: 16,
        },
        isMobile: {marginRight: 16},
      }),
      retentionDropdownStyle: Styles.platformStyles({
        isElectron: {
          marginRight: 45 - 16,
          width: 'auto',
        },
        isMobile: {width: '100%'},
      }),
      settingsContainer: {
        flex: 1,
        height: '100%',
        paddingTop: Styles.globalMargins.small,
      },
    } as const)
)

export default SettingsPanel
