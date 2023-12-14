import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import * as T from '@/constants/types'
import {useTeamDetailsSubscribe} from '@/teams/subscriber'
import {ModalTitle} from '@/teams/common'
import {FloatingRolePicker} from '@/teams/role-picker'
import {InlineDropdown} from '@/common-adapters/dropdown'
import {pluralize} from '@/util/string'
import {InviteItem} from './invite-item'

type Props = {teamID: T.Teams.TeamID}

type RolePickerProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: T.Teams.TeamRoleType) => void
  onOpenRolePicker: () => void
  teamRole: T.Teams.TeamRoleType
  disabledReasonsForRolePicker: {[K in T.Teams.TeamRoleType]?: string | undefined}
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
  const teamID = props.teamID
  const [validity, setValidity] = React.useState(validityOneYear)
  const [isRolePickerOpen, setRolePickerOpen] = React.useState(false)
  const [teamRole, setTeamRole] = React.useState<T.Teams.TeamRoleType>('reader')
  const [inviteLinkURL, setInviteLinkURL] = React.useState('')
  const nav = Container.useSafeNavigation()
  const teamname = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID).teamname)
  useTeamDetailsSubscribe(teamID)
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID))
  const inviteLinks = teamDetails?.inviteLinks
  const inviteLink = [...(inviteLinks || [])].find(i => i.url === inviteLinkURL)

  const onBack = () => nav.safeNavigateUp()
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => clearModals()

  const makePopup = React.useCallback((p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const menuItems = [
      {onClick: () => setValidity(validityOneUse), title: validityOneUse},
      {onClick: () => setValidity(validityOneYear), title: validityOneYear},
      {onClick: () => setValidity(validityForever), title: validityForever},
    ]
    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        closeOnSelect={true}
        items={menuItems}
        onHidden={hidePopup}
        visible={true}
      />
    )
  }, [])

  const {showPopup, popupAnchor, popup} = Kb.usePopup2(makePopup)

  const generateLinkRPC = C.useRPC(T.RPCGen.teamsTeamCreateSeitanInvitelinkWithDurationRpcPromise)
  const onGenerate = () => {
    const expireAfter = validityValuesMap[validity as keyof typeof validityValuesMap] ?? ''
    const maxUses = !expireAfter ? 1 : -1

    generateLinkRPC(
      [
        {
          expireAfter,
          maxUses,
          role: T.RPCGen.TeamRole[teamRole],
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
      owner: undefined, //don't even show
    },
    isRolePickerOpen: isRolePickerOpen,
    onCancelRolePicker: () => setRolePickerOpen(false),
    onConfirmRolePicker: (role: T.Teams.TeamRoleType) => {
      setRolePickerOpen(false)
      setTeamRole(role)
    },
    onOpenRolePicker: () => setRolePickerOpen(true),
    teamRole: teamRole,
  }

  if (inviteLink !== undefined) {
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
          gap={Kb.Styles.isMobile ? 'xsmall' : 'tiny'}
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
        gap={Kb.Styles.isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="Body" style={styles.infoText}>
          Invite people to {teamname} by sharing a link:
        </Kb.Text>

        <Kb.Box2Measure
          direction={Kb.Styles.isMobile ? 'vertical' : 'horizontal'}
          fullWidth={true}
          ref={popupAnchor}
        >
          <Kb.Text type="BodySmall" style={styles.rowTitle}>
            Validity
          </Kb.Text>
          {popup}
          <InlineDropdown
            label={validity}
            onPress={showPopup}
            textWrapperType="BodySemibold"
            containerStyle={styles.dropdownStyle}
            style={styles.dropdownStyle}
            selectedStyle={styles.inlineSelectedStyle}
          />
        </Kb.Box2Measure>

        <Kb.Box2 direction={Kb.Styles.isMobile ? 'vertical' : 'horizontal'} fullWidth={true}>
          <Kb.Text type="BodySmall" style={styles.rowTitle}>
            Invite as
          </Kb.Text>
          <InviteRolePicker {...rolePickerProps} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  banner: Kb.Styles.platformStyles({
    common: {backgroundColor: Kb.Styles.globalColors.blue, height: 96},
    isElectron: {overflowX: 'hidden'},
  }),
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  dropdownButton: {
    alignSelf: 'center',
    paddingLeft: Kb.Styles.globalMargins.xsmall,
    width: '100%',
  },
  dropdownStyle: {
    flexGrow: 1,
    paddingRight: 0,
  },
  infoText: {
    marginBottom: Kb.Styles.globalMargins.xsmall,
  },
  inlineSelectedStyle: {
    paddingLeft: Kb.Styles.globalMargins.xsmall,
    paddingRight: 0,
    width: '100%',
  },
  input: {...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall)},
  rowTitle: {
    marginBottom: Kb.Styles.globalMargins.xtiny,
    marginTop: Kb.Styles.globalMargins.tiny,
    width: 62,
  },
}))

export default GenerateLinkModal
