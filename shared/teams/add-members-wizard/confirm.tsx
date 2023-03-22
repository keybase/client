import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as RPCGen from '../../constants/types/rpc-gen'
import {appendNewTeamBuilder} from '../../actions/typed-routes'
import {assertionToDisplay} from '../../common-adapters/usernames'
import capitalize from 'lodash/capitalize'
import {FloatingRolePicker} from '../role-picker'
import {useDefaultChannels} from '../team/settings-tab/default-channels'
import {ModalTitle, ChannelsWidget} from '../common'
import {pluralize} from '../../util/string'
import logger from '../../logger'

type DisabledRoles = React.ComponentProps<typeof FloatingRolePicker>['disabledRoles']
const disabledRolesForNonKeybasePlural = {
  admin: 'Some invitees cannot be added as admins. Only Keybase users can be added as admins.',
  owner: null,
}
const disabledRolesForPhoneEmailIndividual = {
  admin: 'Only Keybase users can be added as admins.',
  owner: null,
}
const disabledRolesSubteam = {
  owner: 'Subteams cannot have owners.',
}

const AddMembersConfirm = () => {
  const dispatch = Container.useDispatch()

  const {teamID, addingMembers, addToChannels, membersAlreadyInTeam} = Container.useSelector(
    s => s.teams.addMembersWizard
  )
  const isSubteam = Container.useSelector(s => Constants.getTeamMeta(s, teamID)?.teamname.includes('.'))
  const fromNewTeamWizard = teamID === Types.newTeamWizardTeamID
  const isBigTeam = Container.useSelector(s => (fromNewTeamWizard ? false : Constants.isBigTeam(s, teamID)))
  const noun = addingMembers.length === 1 ? 'person' : 'people'
  const isInTeam = Container.useSelector(s => Constants.getRole(s, teamID) !== 'none')

  // TODO: consider useMemoing these
  const anyNonKeybase = addingMembers.some(m => m.assertion.includes('@'))
  const someKeybaseUsers = addingMembers.some(member => !member.assertion.includes('@'))
  const onlyEmails =
    addingMembers.length > 0 && addingMembers.every(member => member.assertion.endsWith('@email'))

  const disabledRoles = isSubteam ? disabledRolesSubteam : undefined

  const [emailMessage, setEmailMessage] = React.useState<string | null>(null)

  const onLeave = () => dispatch(TeamsGen.createCancelAddMembersWizard())
  const onBack = () => dispatch(RouteTreeGen.createNavUpToScreen({name: 'teamAddToTeamFromWhere'}))

  const [_waiting, setWaiting] = React.useState(false)
  const [_error, setError] = React.useState('')
  const newTeamWizErr = Container.useSelector(s =>
    fromNewTeamWizard ? s.teams.newTeamWizard.error : undefined
  )
  const error = _error || newTeamWizErr
  const newTeamWaiting = Container.useAnyWaiting(Constants.teamCreationWaitingKey)
  const waiting = _waiting || newTeamWaiting

  const addMembers = Container.useRPC(RPCGen.teamsTeamAddMembersMultiRoleRpcPromise)
  const onComplete = fromNewTeamWizard
    ? () => dispatch(TeamsGen.createFinishNewTeamWizard())
    : () => {
        setWaiting(true)
        addMembers(
          [
            {
              addToChannels: addToChannels
                ?.filter(c => c.channelname !== 'general')
                .map(c => c.conversationIDKey),
              emailInviteMessage: emailMessage || undefined,
              sendChatNotification: true,
              teamID,
              users: addingMembers.map(member => ({
                assertion: member.assertion,
                role: RPCGen.TeamRole[member.role],
              })),
            },
          ],
          _ => {
            // TODO handle users not added?
            dispatch(TeamsGen.createFinishedAddMembersWizard())
          },
          err => {
            setWaiting(false)
            logger.error(err.message)
            setError(err.message)
          }
        )
      }

  return (
    <Kb.Modal
      allowOverflow={true}
      mode="DefaultFullHeight"
      header={{
        leftButton: fromNewTeamWizard ? (
          <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />
        ) : (
          <Kb.Text type="BodyBigLink" onClick={onLeave}>
            Cancel
          </Kb.Text>
        ),
        title: <ModalTitle teamID={teamID} title={`Inviting ${addingMembers.length} ${noun}`} />,
      }}
      footer={{
        content: (
          <Kb.Button
            fullWidth={true}
            label={`Invite ${addingMembers.length} ${noun} & finish`}
            waiting={waiting}
            onClick={onComplete}
            disabled={addingMembers.length === 0}
          />
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body} gap="small">
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <AddingMembers disabledRoles={disabledRoles} />
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.controls}>
            <AddMoreMembers />
            <RoleSelector
              memberCount={addingMembers.length}
              disabledRoles={anyNonKeybase ? disabledRolesForNonKeybasePlural : disabledRoles}
            />
          </Kb.Box2>
        </Kb.Box2>
        {isBigTeam && someKeybaseUsers && isInTeam && <DefaultChannels teamID={teamID} />}
        {onlyEmails && (
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
            <Kb.Text type="BodySmallSemibold">Custom note</Kb.Text>
            {emailMessage === null ? (
              <Kb.Text type="BodySmallPrimaryLink" onClick={() => setEmailMessage('')}>
                Include a note in your email
              </Kb.Text>
            ) : (
              <Kb.LabeledInput
                autoFocus={true}
                hoverPlaceholder="Ex: Hey folks, here is my team on Keybase. Can't wait to chat securely!"
                maxLength={250}
                multiline={true}
                onChangeText={text => setEmailMessage(text)}
                placeholder="Include a note in your email"
                rowsMax={8}
                rowsMin={3}
                value={emailMessage}
              />
            )}
          </Kb.Box2>
        )}
        {membersAlreadyInTeam.length > 0 && <AlreadyInTeam assertions={membersAlreadyInTeam} />}
        {!!error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
      </Kb.Box2>
    </Kb.Modal>
  )
}
AddMembersConfirm.navigationOptions = {
  gesturesEnabled: false,
}

// Show no more than 20 assertions in "already in team" section.
const alreadyInTeamLimit = 20

const AlreadyInTeam = ({assertions}: {assertions: string[]}) => {
  const invitedStr = React.useMemo(() => {
    if (assertions.length > alreadyInTeamLimit) {
      const left = assertions.length - alreadyInTeamLimit
      const spliced = assertions.slice(0, alreadyInTeamLimit)
      return spliced.map(x => assertionToDisplay(x)).join(', ') + `... (and ${left} more)`
    }
    return assertions.map(x => assertionToDisplay(x)).join(', ')
  }, [assertions])
  const noun = React.useMemo(() => {
    // If all assertions are emails or phone numbers, use "emails" or "phone
    // numbers" noun. Otherwise, use "people".
    const types = new Set<string>()
    for (const assertion of assertions) {
      if (assertion.includes('@email')) {
        types.add('email')
      } else if (assertion.includes('@phone')) {
        types.add('phone')
      } else {
        types.add('other')
      }
    }
    if (types.size === 1) {
      switch (Array.from(types)[0]) {
        case 'email':
          return 'emails'
        case 'phone':
          return 'phone numbers'
      }
    }
    return 'people'
  }, [assertions])
  return (
    <Kb.Text type="BodySmallSuccess" selectable={true}>
      Some {noun} were already invited to the team and are not shown here: {invitedStr}
    </Kb.Text>
  )
}

const AddMoreMembers = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const teamID = Container.useSelector(s => s.teams.addMembersWizard.teamID)
  const onAddKeybase = () => dispatch(appendNewTeamBuilder(teamID))
  const onAddContacts = () => dispatch(nav.safeNavigateAppendPayload({path: ['teamAddToTeamContacts']}))
  const onAddPhone = () => dispatch(nav.safeNavigateAppendPayload({path: ['teamAddToTeamPhone']}))
  const onAddEmail = () => dispatch(nav.safeNavigateAppendPayload({path: ['teamAddToTeamEmail']}))
  const {showingPopup, toggleShowingPopup, popup, popupAnchor} = Kb.usePopup(getAttachmentRef => (
    <Kb.FloatingMenu
      attachTo={getAttachmentRef}
      closeOnSelect={true}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
      items={[
        {onClick: onAddKeybase, title: 'From Keybase'},
        ...(Styles.isMobile ? [{onClick: onAddContacts, title: 'From contacts'}] : []),
        {onClick: onAddEmail, title: 'By email address'},
        {onClick: onAddPhone, title: 'By phone number'},
      ]}
    />
  ))
  return (
    <>
      <Kb.Button
        mode="Secondary"
        small={true}
        label="Add people"
        onClick={toggleShowingPopup}
        ref={popupAnchor}
      />
      {popup}
    </>
  )
}
type RoleType = Types.AddingMemberTeamRoleType | 'setIndividually'

type RoleSelectorProps = {
  disabledRoles: DisabledRoles
  memberCount: number
}
const RoleSelector = ({disabledRoles, memberCount}: RoleSelectorProps) => {
  const dispatch = Container.useDispatch()
  const [showingMenu, setShowingMenu] = React.useState(false)
  const storeRole = Container.useSelector(s => s.teams.addMembersWizard.role)
  const [role, setRole] = React.useState<RoleType>(storeRole)
  const onConfirmRole = (newRole: RoleType) => {
    setRole(newRole)
    setShowingMenu(false)
    dispatch(TeamsGen.createSetAddMembersWizardRole({role: newRole}))
  }
  return (
    <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
      <Kb.Text type="BodySmall">Invite as: </Kb.Text>
      <FloatingRolePicker<true>
        open={showingMenu}
        presetRole={storeRole}
        onCancel={storeRole === role ? () => setShowingMenu(false) : undefined}
        onConfirm={onConfirmRole}
        includeSetIndividually={!Styles.isPhone && (memberCount > 1 || storeRole === 'setIndividually')}
        disabledRoles={disabledRoles}
        plural={memberCount !== 1}
      >
        <Kb.InlineDropdown
          textWrapperType="BodySmallSemibold"
          label={
            storeRole === 'setIndividually'
              ? 'Set individually'
              : pluralize(capitalize(storeRole), memberCount)
          }
          onPress={() => setShowingMenu(true)}
        />
      </FloatingRolePicker>
    </Kb.Box2>
  )
}

const AddingMembers = ({disabledRoles}: {disabledRoles: DisabledRoles}) => {
  const addingMembers = Container.useSelector(s => s.teams.addMembersWizard.addingMembers)
  const [expanded, setExpanded] = React.useState(false)
  const showDivider = Styles.isMobile && addingMembers.length > 4
  const aboveDivider = Container.isMobile ? addingMembers.slice(0, 4) : addingMembers
  const belowDivider = Container.isMobile && expanded ? addingMembers.slice(4) : []
  const toggleExpanded = () => {
    Kb.LayoutAnimation.configureNext(Kb.LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(!expanded)
  }
  const content = (
    <Kb.Box2 direction="vertical" fullWidth={true} gap={Styles.isMobile ? 'tiny' : 'xtiny'}>
      {aboveDivider.map(toAdd => (
        <AddingMember
          key={toAdd.assertion}
          {...toAdd}
          lastMember={addingMembers.length === 1}
          disabledRoles={disabledRoles}
        />
      ))}
      {showDivider && (
        <Kb.ClickableBox onClick={toggleExpanded}>
          <Kb.Box2
            direction="horizontal"
            alignSelf="stretch"
            style={styles.addingMemberDivider}
            centerChildren={true}
          >
            <Kb.Text type="BodySemibold" negative={true}>
              {expanded ? 'Show less' : `+${addingMembers.length - 4} more`}
            </Kb.Text>
          </Kb.Box2>
        </Kb.ClickableBox>
      )}
      {expanded &&
        belowDivider.map(toAdd => (
          <AddingMember key={toAdd.assertion} {...toAdd} disabledRoles={disabledRoles} />
        ))}
    </Kb.Box2>
  )
  if (Styles.isMobile) {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.addingMembers}>
        {content}
      </Kb.Box2>
    )
  }
  return <Kb.ScrollView style={styles.addingMembers}>{content}</Kb.ScrollView>
}

const AddingMember = (props: Types.AddingMember & {disabledRoles: DisabledRoles; lastMember?: boolean}) => {
  const dispatch = Container.useDispatch()
  const onRemove = () => {
    dispatch(TeamsGen.createAddMembersWizardRemoveMember({assertion: props.assertion}))
    if (props.lastMember) {
      dispatch(RouteTreeGen.createNavUpToScreen({name: 'teamAddToTeamFromWhere'}))
    }
  }
  const role = Container.useSelector(s => s.teams.addMembersWizard.role)
  const individualRole: Types.MaybeTeamRoleType = Container.useSelector(
    s =>
      s.teams.addMembersWizard.addingMembers.find(m => m.assertion === props.assertion)?.role ??
      (role === 'setIndividually' ? 'writer' : role)
  )
  const isPhoneEmail = props.assertion.endsWith('@phone') || props.assertion.endsWith('@email')
  const showDropdown = role === 'setIndividually'
  const [showingMenu, setShowingMenu] = React.useState(false)
  const [rolePickerRole, setRole] = React.useState(individualRole)
  const onOpenRolePicker = () => {
    setRole(individualRole)
    setShowingMenu(true)
  }
  const onConfirmRole = newRole => {
    setRole(newRole)
    setShowingMenu(false)
    dispatch(TeamsGen.createSetAddMembersWizardIndividualRole({assertion: props.assertion, role: newRole}))
  }
  return (
    <Kb.Box2 direction="horizontal" alignSelf="stretch" alignItems="center" style={styles.addingMember}>
      <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny" style={styles.memberPill}>
        <Kb.Avatar size={16} username={props.assertion} />
        <Kb.ConnectedUsernames
          type="BodyBold"
          inline={true}
          lineClamp={1}
          usernames={[props.assertion]}
          colorFollowing={true}
          containerStyle={styles.flexShrink}
          style={styles.flexShrink}
        />
        {props.resolvedFrom && (
          <Kb.Text lineClamp={1} type="BodySemibold" style={styles.flexDefinitelyShrink}>
            ({assertionToDisplay(props.resolvedFrom)})
          </Kb.Text>
        )}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny">
        {showDropdown && (
          <FloatingRolePicker
            open={showingMenu}
            presetRole={individualRole}
            onCancel={individualRole === rolePickerRole ? () => setShowingMenu(false) : undefined}
            onConfirm={onConfirmRole}
            disabledRoles={isPhoneEmail ? disabledRolesForPhoneEmailIndividual : props.disabledRoles}
          >
            <Kb.InlineDropdown
              textWrapperType="BodySmallSemibold"
              onPress={onOpenRolePicker}
              label={capitalize(individualRole)}
            />
          </FloatingRolePicker>
        )}
        <Kb.Icon type="iconfont-remove" sizeType="Small" onClick={onRemove} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const DefaultChannels = ({teamID}: {teamID: Types.TeamID}) => {
  const dispatch = Container.useDispatch()
  const {defaultChannels, defaultChannelsWaiting} = useDefaultChannels(teamID)
  const addToChannels = Container.useSelector(s => s.teams.addMembersWizard.addToChannels)
  const allKeybaseUsers = Container.useSelector(
    s => !s.teams.addMembersWizard.addingMembers.some(member => member.assertion.includes('@'))
  )
  const onChangeFromDefault = () => dispatch(TeamsGen.createAddMembersWizardSetDefaultChannels({toAdd: []}))
  const onAdd = React.useCallback(
    (toAdd: Array<Types.ChannelNameID>) => {
      dispatch(TeamsGen.createAddMembersWizardSetDefaultChannels({toAdd}))
    },
    [dispatch]
  )
  const onRemove = React.useCallback(
    (toRemove: Types.ChannelNameID) => {
      dispatch(TeamsGen.createAddMembersWizardSetDefaultChannels({toRemove}))
    },
    [dispatch]
  )
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
      <Kb.Text type="BodySmallSemibold">Join channels</Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {defaultChannelsWaiting ? (
          <Kb.ProgressIndicator />
        ) : (
          <>
            <Kb.Text type="BodySmall">
              {allKeybaseUsers ? 'Your invitees' : 'Invitees that are Keybase users'} will be added to{' '}
              {defaultChannels.length} {pluralize('channel', defaultChannels.length)}.
            </Kb.Text>
            <Kb.Text type="BodySmall">
              {defaultChannels.map((channel, index) => (
                <Kb.Text key={channel.conversationIDKey} type="BodySmallSemibold">
                  #{channel.channelname}
                  {defaultChannels.length > 2 && index < defaultChannels.length - 1 && ', '}
                  {index === defaultChannels.length - 2 && <Kb.Text type="BodySmall"> and </Kb.Text>}
                </Kb.Text>
              ))}
              .{' '}
              {!addToChannels && (
                <Kb.Text type="BodySmallPrimaryLink" onClick={onChangeFromDefault}>
                  Add channels
                </Kb.Text>
              )}
            </Kb.Text>
          </>
        )}
      </Kb.Box2>
      {addToChannels && (
        <ChannelsWidget
          disableGeneral={true}
          teamID={teamID}
          channels={addToChannels}
          disabledChannels={defaultChannels}
          onAddChannel={onAdd}
          onRemoveChannel={onRemove}
        />
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addingMember: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderRadius: Styles.borderRadius,
      justifyContent: 'space-between',
    },
    isElectron: {height: 32, paddingLeft: Styles.globalMargins.tiny, paddingRight: Styles.globalMargins.tiny},
    isMobile: {height: 40, paddingLeft: Styles.globalMargins.tiny, paddingRight: Styles.globalMargins.xsmall},
  }),
  addingMemberDivider: {
    backgroundColor: Styles.globalColors.black_20,
    borderRadius: Styles.borderRadius,
    height: 40,
    justifyContent: 'center',
  },
  addingMembers: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueGreyDark,
      borderRadius: Styles.borderRadius,
    },
    isElectron: {
      ...Styles.padding(
        Styles.globalMargins.tiny,
        Styles.globalMargins.small,
        Styles.globalMargins.tiny,
        Styles.globalMargins.tiny
      ),
      maxHeight: 168,
    },
    isMobile: {padding: Styles.globalMargins.tiny},
  }),
  body: {
    padding: Styles.globalMargins.small,
  },
  controls: {
    justifyContent: 'space-between',
  },
  flexDefinitelyShrink: {flexShrink: 100},
  flexShrink: {flexShrink: 1},
  memberPill: {flex: 1, width: 0},
}))

export default AddMembersConfirm
