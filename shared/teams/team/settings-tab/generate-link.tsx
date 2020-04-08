import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/teams'
import * as Styles from '../../../styles'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {ModalTitle} from '../../common'
import {FloatingRolePicker} from '../../role-picker'
import {InlineDropdown} from '../../../common-adapters/dropdown'
import {pluralize} from '../../../util/string'

type LinkStatus = 'none' | 'active' | 'expired'

type RolePickerProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onOpenRolePicker: () => void
  onSelectRole: (role: Types.TeamRoleType) => void
  teamRole: Types.TeamRoleType
  disabledReasonsForRolePicker: {[K in Types.TeamRoleType]?: string}
}

const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const InviteRolePicker = (props: RolePickerProps) => {
  return (
    <FloatingRolePicker
      confirmLabel={`Let in as ${pluralize(props.teamRole)}`}
      selectedRole={props.teamRole}
      onSelectRole={props.onSelectRole}
      floatingContainerStyle={styles.floatingRolePicker}
      onConfirm={props.onConfirmRolePicker}
      onCancel={props.onCancelRolePicker}
      position="bottom center"
      open={props.isRolePickerOpen}
      disabledRoles={props.disabledReasonsForRolePicker}
    >
      <InlineDropdown
        label={capitalize(pluralize(props.teamRole))}
        onPress={props.onOpenRolePicker}
        textWrapperType="BodySemibold"
        containerStyle={styles.dropdownStyle}
        style={styles.dropdownStyle}
        selectedStyle={styles.inlineSelectedStyle}
      />
    </FloatingRolePicker>
  )
}

const GenerateLinkModal = () => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const linkStatus = 'active'
  const teamID = Types.newTeamWizardTeamID
  const teamname = Container.useSelector(s => s.teams.newTeamWizard.name)

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onClose = () => dispatch(RouteTreeGen.createClearModals())

  const onGenerate = () => undefined

  const validityItemOneUse = (
    <Kb.Text type="BodySemibold" style={styles.dropdownButton}>
      Expires after one use
    </Kb.Text>
  )
  const validityItemYear = (
    <Kb.Text type="BodySemibold" style={styles.dropdownButton}>
      Expires after one year
    </Kb.Text>
  )
  const validityItemForever = (
    <Kb.Text type="BodySemibold" style={styles.dropdownButton}>
      Expires after 10,000 years
    </Kb.Text>
  )
  const [validity, setValidity] = React.useState(validityItemYear)

  const [isRolePickerOpen, setRolePickerOpen] = React.useState(false)
  const [teamRole, setTeamRole] = React.useState('reader' as Types.TeamRoleType)

  const rolePickerProps = {
    disabledReasonsForRolePicker: {
      admin: `Users can't join open teams as admins.`,
      owner: `Users can't join open teams as owners.`,
      reader: '',
      writer: '',
    },
    isRolePickerOpen: isRolePickerOpen,
    onCancelRolePicker: () => setRolePickerOpen(false),
    onConfirmRolePicker: () => {
      setRolePickerOpen(false)
    },
    onOpenRolePicker: () => setRolePickerOpen(true),
    onSelectRole: (role: Types.TeamRoleType) => setTeamRole(role),
    teamRole: teamRole,
  }

  if (linkStatus != 'none') {
    return (
      <Kb.Modal
        onClose={onClose}
        header={{
          leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
          title: <ModalTitle teamID={teamID} title="Share an invite link" />,
        }}
        footer={{
          content: <Kb.Button fullWidth={true} label="Close" onClick={onGenerate} type="Dim" />,
          hideBorder: true,
        }}
        allowOverflow={true}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
          {linkStatus == 'active' && <Kb.Icon type="icon-illustration-teams-invite-links-green-460-96" />}
          {linkStatus == 'expired' && <Kb.Icon type="icon-illustration-teams-invite-links-grey-460-96" />}
        </Kb.Box2>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={styles.body}
          gap={Styles.isMobile ? 'xsmall' : 'tiny'}
        >
          <Kb.Text type="Body" style={styles.infoText}>
            Here is your link. Share it cautiously as anyone who has it can join the team.
          </Kb.Text>

          {linkStatus == 'expired' && (
            <Kb.Text type="BodySmallSemiboldPrimaryLink">Generate a new link</Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Modal>
    )
  }

  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamID={teamID} title="Share an invite link" />,
      }}
      footer={{
        content: <Kb.Button fullWidth={true} label="Generate invite link" onClick={onGenerate} />,
        hideBorder: true,
      }}
      allowOverflow={true}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
        <Kb.Icon type="icon-illustration-teams-invite-links-blue-460-96" />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Styles.isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="Body" style={styles.infoText}>
          Invite people to {teamname} by sharing a link:
        </Kb.Text>

        <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} fullWidth={true}>
          <Kb.Text type="BodySmall" style={styles.rowTitle}>
            Validity
          </Kb.Text>
          <Kb.Dropdown
            items={[validityItemOneUse, validityItemYear, validityItemForever]}
            selected={validity}
            onChanged={setValidity}
            style={styles.dropdownStyle}
          />
        </Kb.Box2>

        <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} fullWidth={true}>
          <Kb.Text type="BodySmall" style={styles.rowTitle}>
            Invite as
          </Kb.Text>
          <InviteRolePicker {...rolePickerProps} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addButton: Styles.platformStyles({
    isElectron: {width: 42},
    isMobile: {width: 47},
  }),
  banner: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blue, height: 96},
    isElectron: {overflowX: 'hidden'},
  }),
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
    },
    isElectron: {minHeight: 326},
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  dropdownButton: {
    alignSelf: 'center',
    paddingLeft: Styles.globalMargins.xsmall,
    width: '100%',
  },
  dropdownStyle: {
    flexGrow: 1,
    paddingRight: 0,
  },
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -20,
    },
  }),
  infoText: {
    marginBottom: Styles.globalMargins.xsmall,
  },
  inlineSelectedStyle: {
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: 0,
    width: '100%',
  },
  input: {...Styles.padding(Styles.globalMargins.xsmall)},
  rowTitle: {
    marginBottom: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.tiny,
    width: 62,
  },
}))

export default GenerateLinkModal
