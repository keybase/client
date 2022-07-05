import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as RPCGen from '../../../constants/types/rpc-gen'
import * as Styles from '../../../styles'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {useTeamDetailsSubscribe} from '../../subscriber'
import {ModalTitle} from '../../common'
import {FloatingRolePicker} from '../../role-picker'
import {InlineDropdown} from '../../../common-adapters/dropdown'
import {pluralize} from '../../../util/string'
import {InviteItem} from './invite-item'

type Props = Container.RouteProps<{teamID: Types.TeamID}>

type RolePickerProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onOpenRolePicker: () => void
  teamRole: Types.TeamRoleType
  disabledReasonsForRolePicker: {[K in Types.TeamRoleType]?: string | null}
}

const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const InviteRolePicker = (props: RolePickerProps) => {
  return (
    <FloatingRolePicker
      presetRole={props.teamRole}
      onConfirm={props.onConfirmRolePicker}
      onCancel={props.onCancelRolePicker}
      position="bottom center"
      open={props.isRolePickerOpen}
      disabledRoles={props.disabledReasonsForRolePicker}
      plural={true}
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

const waitingKey = 'generateInviteLink'

const validityOneUse = 'Expires after one use'
const validityOneYear = 'Expires after one year'
const validityForever = 'Expires after 10,000 years'

const validityValuesMap = {
  [validityForever]: '10000 Y',
  [validityOneUse]: undefined,
  [validityOneYear]: '1 Y',
}

const GenerateLinkModal = (props: Props) => {
  const [validity, setValidity] = React.useState(validityOneYear)
  const [isRolePickerOpen, setRolePickerOpen] = React.useState(false)
  const [teamRole, setTeamRole] = React.useState<Types.TeamRoleType>('reader')
  const [inviteLinkURL, setInviteLinkURL] = React.useState('')

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const teamname = Container.useSelector(state => Constants.getTeamMeta(state, teamID).teamname)
  useTeamDetailsSubscribe(teamID)
  const teamDetails = Container.useSelector(s => s.teams.teamDetails.get(teamID))
  const inviteLinks = teamDetails?.inviteLinks
  const inviteLink = [...(inviteLinks || [])].find(i => i.url == inviteLinkURL)

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onClose = () => dispatch(RouteTreeGen.createClearModals())

  const menuItems = [
    {onClick: () => setValidity(validityOneUse), title: validityOneUse},
    {onClick: () => setValidity(validityOneYear), title: validityOneYear},
    {onClick: () => setValidity(validityForever), title: validityForever},
  ]

  const {showingPopup, toggleShowingPopup, popupAnchor, popup} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={menuItems}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
    />
  ))

  const generateLinkRPC = Container.useRPC(RPCGen.teamsTeamCreateSeitanInvitelinkWithDurationRpcPromise)
  const onGenerate = () => {
    const expireAfter = validityValuesMap[validity]
    const maxUses = expireAfter == null ? 1 : -1

    generateLinkRPC(
      [
        {
          expireAfter,
          maxUses,
          role: RPCGen.TeamRole[teamRole],
          teamname,
        },
        waitingKey,
      ],
      r => setInviteLinkURL(r.url),
      () => {}
    )
  }

  const rolePickerProps = {
    disabledReasonsForRolePicker: {
      admin: `You can't invite admins via invte link.`,
      owner: null, //don't even show
    },
    isRolePickerOpen: isRolePickerOpen,
    onCancelRolePicker: () => setRolePickerOpen(false),
    onConfirmRolePicker: role => {
      setRolePickerOpen(false)
      setTeamRole(role)
    },
    onOpenRolePicker: () => setRolePickerOpen(true),
    teamRole: teamRole,
  }

  if (inviteLink != null || inviteLink != undefined) {
    return (
      <Kb.Modal
        onClose={onClose}
        header={{
          leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
          title: <ModalTitle teamID={teamID} title="Share an invite link" />,
        }}
        footer={{
          content: <Kb.Button fullWidth={true} label={'Close'} onClick={onClose} type="Dim" />,
          hideBorder: true,
        }}
        allowOverflow={true}
        mode="DefaultFullHeight"
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
          {inviteLink.isValid ? (
            <Kb.Icon type="icon-illustration-teams-invite-links-grey-460-96" />
          ) : (
            <Kb.Icon type="icon-illustration-teams-invite-links-green-460-96" />
          )}
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

          <InviteItem inviteLink={inviteLink} teamID={teamID} showDetails={false} showExpireAction={true} />

          {!inviteLink.isValid && (
            <Kb.Text type="BodySmallSemiboldPrimaryLink" onClick={() => setInviteLinkURL('')}>
              Generate a new link
            </Kb.Text>
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
        content: (
          <Kb.WaitingButton
            fullWidth={true}
            label="Generate invite link"
            onClick={onGenerate}
            waitingKey={waitingKey}
          />
        ),
        hideBorder: true,
      }}
      allowOverflow={true}
      mode="DefaultFullHeight"
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

        <Kb.Box2
          direction={Styles.isMobile ? 'vertical' : 'horizontal'}
          fullWidth={true}
          ref={popupAnchor as any}
        >
          <Kb.Text type="BodySmall" style={styles.rowTitle}>
            Validity
          </Kb.Text>
          {popup}
          <InlineDropdown
            label={validity}
            onPress={toggleShowingPopup}
            textWrapperType="BodySemibold"
            containerStyle={styles.dropdownStyle}
            style={styles.dropdownStyle}
            selectedStyle={styles.inlineSelectedStyle}
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
  banner: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blue, height: 96},
    isElectron: {overflowX: 'hidden'},
  }),
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
    },
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
