import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as RPCGen from '../../constants/types/rpc-gen'
import {appendNewTeamBuilder, appendTeamsContactsTeamBuilder} from '../../actions/typed-routes'
import capitalize from 'lodash/capitalize'
import {FloatingRolePicker} from '../role-picker'
import {ModalTitle} from '../common'
import {pluralize} from '../../util/string'

const AddMembersConfirm = () => {
  const dispatch = Container.useDispatch()

  const {teamID, role, addingMembers} = Container.useSelector(s => s.teams.addMembersWizard)
  const teamname = Container.useSelector(s => Constants.getTeamMeta(s, teamID).teamname)
  const noun = addingMembers.length === 1 ? 'person' : 'people'

  const onLeave = () => dispatch(TeamsGen.createCancelAddMembersWizard())

  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const addMembers = Container.useRPC(RPCGen.teamsTeamAddMembersMultiRoleRpcPromise)
  const onComplete = () => {
    setWaiting(true)
    addMembers(
      [
        {
          sendChatNotification: true,
          teamID,
          users: addingMembers.map(member => ({
            assertion: member.assertion,
            role: RPCGen.TeamRole[role || 'writer'], // TODO Y2K-1560 handle individual roles
          })),
        },
      ],
      _ => {
        // TODO handle users not added?
        dispatch(TeamsGen.createFinishAddMembersWizard())
      },
      err => {
        setWaiting(false)
        setError(err.message)
      }
    )
  }

  return (
    <Kb.Modal
      onClose={onLeave}
      allowOverflow={true}
      mode="DefaultFullHeight"
      header={{
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onLeave}>
            Cancel
          </Kb.Text>
        ),
        title: <ModalTitle teamname={teamname} title={`Inviting ${addingMembers.length} ${noun}`} />,
      }}
      footer={{
        content: (
          <Kb.Button
            fullWidth={true}
            label={`Invite ${addingMembers.length} ${noun} & finish`}
            waiting={waiting}
            onClick={onComplete}
          />
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body} gap="small">
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <AddingMembers />
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.controls}>
            <AddMoreMembers />
            <RoleSelector />
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
          <Kb.Text type="BodySmallSemibold">Join channels</Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySmall">Your invitees will be added to 3 channels.</Kb.Text>
            <Kb.Text type="BodySmall">
              {/* TODO: Hook this up when default channels settings are hooked up */}
              <Kb.Text type="BodySmallBold">#general</Kb.Text>,{' '}
              <Kb.Text type="BodySmallBold">#random</Kb.Text>, and{' '}
              <Kb.Text type="BodySmallBold">#hellos</Kb.Text>.{' '}
              <Kb.Text type="BodySmallPrimaryLink">Change this</Kb.Text>
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        {!!error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
      </Kb.Box2>
    </Kb.Modal>
  )
}
AddMembersConfirm.navigationOptions = {
  gesturesEnabled: false,
}

const AddMoreMembers = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const teamID = Container.useSelector(s => s.teams.addMembersWizard.teamID)
  const onAddKeybase = () => dispatch(appendNewTeamBuilder(teamID))
  const onAddContacts = () => dispatch(appendTeamsContactsTeamBuilder(teamID))
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

const RoleSelector = () => {
  const dispatch = Container.useDispatch()
  const [showingMenu, setShowingMenu] = React.useState(false)
  const storeRole = Container.useSelector(s => s.teams.addMembersWizard.role)
  const [role, setRole] = React.useState(storeRole)
  const onSelectRole = newRole => setRole(newRole)
  const onConfirmRole = newRole => {
    setRole(newRole)
    setShowingMenu(false)
    dispatch(TeamsGen.createSetAddMembersWizardRole({role: newRole}))
  }
  return (
    <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
      <Kb.Text type="BodySmall">Invite as: </Kb.Text>
      <FloatingRolePicker
        open={showingMenu}
        selectedRole={role}
        onSelectRole={onSelectRole}
        onConfirm={onConfirmRole}
        confirmLabel={`Add as ${pluralize(role || 'reader')}`} // TODO Y2K-1560 fix when this can actually be undefined
      >
        <Kb.InlineDropdown
          type="BodySmallSemibold"
          label={capitalize(storeRole) + 's'}
          onPress={() => setShowingMenu(true)}
        />
      </FloatingRolePicker>
    </Kb.Box2>
  )
}

const AddingMembers = () => {
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
        <AddingMember key={toAdd.assertion} {...toAdd} lastMember={addingMembers.length === 1} />
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
      {expanded && belowDivider.map(toAdd => <AddingMember key={toAdd.assertion} {...toAdd} />)}
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

const AddingMember = (props: Types.AddingMember & {lastMember?: boolean}) => {
  const dispatch = Container.useDispatch()
  const onRemove = () => dispatch(TeamsGen.createAddMembersWizardRemoveMember({assertion: props.assertion}))
  return (
    <Kb.Box2 direction="horizontal" alignSelf="stretch" alignItems="center" style={styles.addingMember}>
      <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny">
        <Kb.Avatar size={16} username={props.assertion} />
        <Kb.ConnectedUsernames type="BodySemibold" usernames={[props.assertion]} />
      </Kb.Box2>
      {props.lastMember !== true && <Kb.Icon type="iconfont-remove" sizeType="Small" onClick={onRemove} />}
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
}))

export default AddMembersConfirm
