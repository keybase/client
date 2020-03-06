import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import capitalize from 'lodash/capitalize'
import {FloatingRolePicker} from '../role-picker'
import {ModalTitle} from '../common'

const AddMembersConfirm = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const {teamID, addingMembers} = Container.useSelector(s => s.teams.addMembersWizard)
  const teamname = Container.useSelector(s => Constants.getTeamMeta(s, teamID).teamname)
  const noun = addingMembers.length === 1 ? 'person' : 'people'

  const onClose = () => dispatch(RouteTreeGen.createClearModals())
  const onBack = () => dispatch(nav.safeNavigateUpPayload())

  return (
    <Kb.Modal
      onClose={onClose}
      allowOverflow={true}
      mode="DefaultFullHeight"
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamname={teamname} title={`Inviting ${addingMembers.length} ${noun}`} />,
      }}
      footer={{
        content: <Kb.Button fullWidth={true} label={`Invite ${addingMembers.length} ${noun} & finish`} />,
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
      </Kb.Box2>
    </Kb.Modal>
  )
}

const AddMoreMembers = () => {
  const {showingPopup, toggleShowingPopup, popup, popupAnchor} = Kb.usePopup(getAttachmentRef => (
    <Kb.FloatingMenu
      attachTo={getAttachmentRef}
      closeOnSelect={true}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
      items={[{title: 'From Keybase'}, {title: 'By email address'}, {title: 'By phone number'}]}
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
  const content = (
    <Kb.Box2 direction="vertical" gap="xtiny">
      {addingMembers.map(toAdd => (
        <AddingMember key={toAdd.assertion} {...toAdd} />
      ))}
    </Kb.Box2>
  )
  if (Styles.isMobile) {
    return (
      <Kb.Box2 direction="vertical" style={styles.addingMembers}>
        {content}
      </Kb.Box2>
    )
  }
  return <Kb.ScrollView style={styles.addingMembers}>{content}</Kb.ScrollView>
}

const AddingMember = (props: Types.AddingMember) => {
  const {role, teamID} = Container.useSelector(s => s.teams.addMembersWizard)
  const showDropdown = role === undefined
  return (
    <Kb.Box2 direction="horizontal" alignSelf="stretch" alignItems="center" style={styles.addingMember}>
      <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny">
        <Kb.Avatar size={16} username={props.assertion} />
        <Kb.ConnectedUsernames type="BodySemibold" usernames={[props.assertion]} />
      </Kb.Box2>
      <Kb.Icon type="iconfont-remove" sizeType="Small" />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addingMember: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: Styles.borderRadius,
    justifyContent: 'space-between',
    padding: Styles.globalMargins.tiny,
  },
  addingMembers: Styles.platformStyles({
    common: {
      ...Styles.padding(
        Styles.globalMargins.tiny,
        Styles.globalMargins.small,
        Styles.globalMargins.tiny,
        Styles.globalMargins.tiny
      ),
      backgroundColor: Styles.globalColors.blueGreyDark,
      borderRadius: Styles.borderRadius,
    },
    isElectron: {maxHeight: 168},
  }),
  body: {
    padding: Styles.globalMargins.small,
  },
  controls: {
    justifyContent: 'space-between',
  },
}))

export default AddMembersConfirm
