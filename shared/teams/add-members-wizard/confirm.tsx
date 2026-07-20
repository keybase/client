import * as C from '@/constants'
import {useIsBigTeam} from '../common/use-loaded-team-channels'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {assertionToDisplay} from '@/common-adapters/usernames'
import capitalize from 'lodash/capitalize'
import {FloatingRolePicker} from '../role-picker'
import {pluralize} from '@/util/string'
import logger from '@/logger'
import {useSafeNavigation} from '@/util/safe-navigation'
import {createNewTeamFromWizard} from '../new-team/wizard/state'
import {invalidateLoadedTeams} from '../use-teams-list'
import {RPCError} from '@/util/errors'
import {useNavigation} from '@react-navigation/native'
import {useLoadedTeam} from '../team/use-loaded-team'
import AddingMembers, {type DisabledRoles} from './adding-members'
import DefaultChannels from './default-channels'
import {setWizardRole, type AddMembersWizard} from './state'

const disabledRolesForNonKeybasePlural = {
  admin: 'Some invitees cannot be added as admins. Only Keybase users can be added as admins.',
}
const disabledRolesSubteam = {
  owner: 'Subteams cannot have owners.',
}

const AddMembersConfirm = ({wizard: initialWizard}: Props) => {
  const navigation = useNavigation('teamAddToTeamConfirm')
  const [wizardState, setWizardState] = React.useState(() => ({
    initialWizard,
    wizard: initialWizard,
  }))
  let wizard = wizardState.wizard
  if (wizardState.initialWizard !== initialWizard) {
    wizard = initialWizard
    setWizardState({initialWizard, wizard: initialWizard})
  }
  const {teamID, addingMembers, addToChannels, membersAlreadyInTeam} = wizard
  const fromNewTeamWizard = teamID === T.Teams.newTeamWizardTeamID
  const newTeamWizard = wizard.newTeamWizard
  const {teamMeta} = useLoadedTeam(teamID, !fromNewTeamWizard)
  const isInTeam = teamMeta.role !== 'none'
  const updateWizard = React.useCallback(
    (nextWizard: AddMembersWizard) => {
      setWizardState({initialWizard, wizard: nextWizard})
      navigation.setParams({wizard: nextWizard})
    },
    [initialWizard, navigation]
  )
  const isSubteam = fromNewTeamWizard ? newTeamWizard?.teamType === 'subteam' : teamMeta.teamname.includes('.')
  const channelsAreBig = useIsBigTeam(teamID)
  const isBigTeam = fromNewTeamWizard ? false : channelsAreBig
  const noun = addingMembers.length === 1 ? 'person' : 'people'

  // TODO: consider useMemoing these
  const anyNonKeybase = addingMembers.some(m => m.assertion.includes('@'))
  const someKeybaseUsers = addingMembers.some(member => !member.assertion.includes('@'))
  const onlyEmails =
    addingMembers.length > 0 && addingMembers.every(member => member.assertion.endsWith('@email'))

  const disabledRoles = isSubteam ? disabledRolesSubteam : undefined

  const [emailMessage, setEmailMessage] = React.useState('')
  const [isEditingEmailMessage, setIsEditingEmailMessage] = React.useState(false)

  const [_waiting, setWaiting] = React.useState(false)
  const [_error, setError] = React.useState('')
  const error = _error || newTeamWizard?.error
  const newTeamWaiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsCreation)
  const waiting = _waiting || newTeamWaiting

  const addMembers = C.useRPC(T.RPCGen.teamsTeamAddMembersMultiRoleRpcPromise)

  const onComplete = fromNewTeamWizard
    ? () => {
        if (!newTeamWizard) {
          return
        }
        updateWizard({
          ...wizard,
          newTeamWizard: {...newTeamWizard, error: undefined},
        })
        setWaiting(true)
        const f = async () => {
          try {
            const teamID = await createNewTeamFromWizard({...newTeamWizard, error: undefined}, addingMembers)
            invalidateLoadedTeams()
            C.Router2.navigateAppend({name: 'team', params: {justFinishedAddWizard: true, teamID}})
            C.Router2.clearModals()
          } catch (err) {
            setWaiting(false)
            const errorMessage = err instanceof RPCError ? err.desc : String(err)
            updateWizard({
              ...wizard,
              newTeamWizard: {...newTeamWizard, error: errorMessage},
            })
          }
        }
        C.ignorePromise(f())
      }
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
                role: T.RPCGen.TeamRole[member.role],
              })),
            },
          ],
          _ => {
            // TODO handle users not added?
            C.Router2.navUpToScreen({name: 'team', params: {justFinishedAddWizard: true, teamID}}, true)
            C.Router2.clearModals()
          },
          err => {
            setWaiting(false)
            logger.error(err.message)
            setError(err.message)
          }
        )
      }

  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body} gap="small">
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <AddingMembers
            disabledRoles={disabledRoles}
            updateWizard={updateWizard}
            wizard={wizard}
          />
          <Kb.Box2 direction="horizontal" fullWidth={true} justifyContent="space-between">
            <AddMoreMembers wizard={wizard} />
            <RoleSelector
              memberCount={addingMembers.length}
              disabledRoles={anyNonKeybase ? disabledRolesForNonKeybasePlural : disabledRoles}
              updateWizard={updateWizard}
              wizard={wizard}
            />
          </Kb.Box2>
        </Kb.Box2>
        {isBigTeam && someKeybaseUsers && isInTeam && (
          <DefaultChannels teamID={teamID} updateWizard={updateWizard} wizard={wizard} />
        )}
        {onlyEmails && (
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
            <Kb.Text type="BodySmallSemibold">Custom note</Kb.Text>
            {!isEditingEmailMessage ? (
              <Kb.Text type="BodySmallPrimaryLink" onClick={() => setIsEditingEmailMessage(true)}>
                Include a note in your email
              </Kb.Text>
            ) : (
              <Kb.Input3
                textType="BodySemibold"
                autoFocus={true}
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
      <Kb.ModalFooter>
        <Kb.Button
          fullWidth={true}
          label={`Invite ${addingMembers.length} ${noun} & finish`}
          waiting={waiting}
          onClick={onComplete}
          disabled={addingMembers.length === 0}
        />
      </Kb.ModalFooter>
    </>
  )
}

// Show no more than 20 assertions in "already in team" section.
const alreadyInTeamLimit = 20

const AlreadyInTeam = ({assertions}: {assertions: ReadonlyArray<string>}) => {
  const invitedStr = (() => {
    if (assertions.length > alreadyInTeamLimit) {
      const left = assertions.length - alreadyInTeamLimit
      const spliced = assertions.slice(0, alreadyInTeamLimit)
      return spliced.map(x => assertionToDisplay(x)).join(', ') + `... (and ${left} more)`
    }
    return assertions.map(x => assertionToDisplay(x)).join(', ')
  })()
  const noun = (() => {
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
        default:
      }
    }
    return 'people'
  })()
  return (
    <Kb.Text type="BodySmallSuccess" selectable={true}>
      Some {noun} were already invited to the team and are not shown here: {invitedStr}
    </Kb.Text>
  )
}

const AddMoreMembers = ({wizard}: {wizard: AddMembersWizard}) => {
  const nav = useSafeNavigation()
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const onAddKeybase = () =>
      nav.safeNavigateAppend({
        name: 'teamsTeamBuilder',
        params: {
          addMembersWizard: wizard,
          filterServices: ['keybase', 'twitter', 'facebook', 'github', 'reddit', 'hackernews'],
          goButtonLabel: 'Add',
          namespace: 'teams',
          teamID: wizard.teamID,
          title: '',
        },
      })
    const onAddContacts = () => nav.safeNavigateAppend({name: 'teamAddToTeamContacts', params: {wizard}})
    const onAddPhone = () => nav.safeNavigateAppend({name: 'teamAddToTeamPhone', params: {wizard}})
    const onAddEmail = () => nav.safeNavigateAppend({name: 'teamAddToTeamEmail', params: {wizard}})
    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        closeOnSelect={true}
        onHidden={hidePopup}
        visible={true}
        items={[
          {onClick: onAddKeybase, title: 'From Keybase'},
          ...(isMobile ? [{onClick: onAddContacts, title: 'From contacts'}] : []),
          {onClick: onAddEmail, title: 'By email address'},
          {onClick: onAddPhone, title: 'By phone number'},
        ]}
      />
    )
  }

  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.Button mode="Secondary" small={true} label="Add people" onClick={showPopup} ref={popupAnchor} />
      {popup}
    </>
  )
}
type RoleType = T.Teams.AddingMemberTeamRoleType | 'setIndividually'

type RoleSelectorProps = {
  disabledRoles: DisabledRoles
  memberCount: number
  updateWizard: (wizard: AddMembersWizard) => void
  wizard: AddMembersWizard
}
const RoleSelector = ({disabledRoles, memberCount, updateWizard, wizard}: RoleSelectorProps) => {
  const [showingMenu, setShowingMenu] = React.useState(false)
  const storeRole = wizard.role
  const onConfirmRole = (newRole: RoleType) => {
    setShowingMenu(false)
    updateWizard(setWizardRole(wizard, newRole))
  }
  return (
    <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
      <Kb.Text type="BodySmall">Invite as: </Kb.Text>
      <FloatingRolePicker<true>
        open={showingMenu}
        presetRole={storeRole}
        onCancel={() => setShowingMenu(false)}
        onConfirm={onConfirmRole}
        includeSetIndividually={!Kb.Styles.isPhone && (memberCount > 1 || storeRole === 'setIndividually')}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  body: {
    flex: 1,
    padding: Kb.Styles.globalMargins.small,
  },
}))

type Props = {
  wizard: AddMembersWizard
}

export default AddMembersConfirm
