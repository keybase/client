import * as C from '@/constants'
import {isBigTeam as getIsBigTeam} from '@/constants/chat/helpers'
import * as Chat from '@/stores/chat'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {assertionToDisplay} from '@/common-adapters/usernames'
import capitalize from 'lodash/capitalize'
import {FloatingRolePicker} from '../role-picker'
import {useDefaultChannels} from '../team/settings-tab/default-channels'
import {ChannelsWidget} from '../common'
import {pluralize} from '@/util/string'
import logger from '@/logger'
import {useSafeNavigation} from '@/util/safe-navigation'
import {createNewTeamFromWizard} from '../new-team/wizard/state'
import {RPCError} from '@/util/errors'
import {useNavigation} from '@react-navigation/native'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import {useLoadedTeam} from '../team/use-loaded-team'
import {
  removeWizardMember,
  setWizardDefaultChannels,
  setWizardIndividualRole,
  setWizardRole,
  type AddMembersWizard,
} from './state'

type DisabledRoles = React.ComponentProps<typeof FloatingRolePicker>['disabledRoles']
const disabledRolesForNonKeybasePlural = {
  admin: 'Some invitees cannot be added as admins. Only Keybase users can be added as admins.',
}
const disabledRolesForPhoneEmailIndividual = {
  admin: 'Only Keybase users can be added as admins.',
}
const disabledRolesSubteam = {
  owner: 'Subteams cannot have owners.',
}

type TeamAddToTeamConfirmParamList = {
  teamAddToTeamConfirm: {wizard: AddMembersWizard}
}

const AddMembersConfirm = ({wizard: initialWizard}: Props) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<TeamAddToTeamConfirmParamList, 'teamAddToTeamConfirm'>>()
  const [wizard, setWizard] = React.useState(initialWizard)
  React.useEffect(() => {
    setWizard(initialWizard)
  }, [initialWizard])
  const {teamID, addingMembers, addToChannels, membersAlreadyInTeam} = wizard
  const fromNewTeamWizard = teamID === T.Teams.newTeamWizardTeamID
  const newTeamWizard = wizard.newTeamWizard
  const {teamMeta} = useLoadedTeam(teamID, !fromNewTeamWizard)
  const isInTeam = teamMeta.role !== 'none'
  const updateWizard = React.useCallback(
    (nextWizard: AddMembersWizard) => {
      setWizard(nextWizard)
      navigation.setParams({wizard: nextWizard})
    },
    [navigation]
  )
  const isSubteam = fromNewTeamWizard ? newTeamWizard?.teamType === 'subteam' : teamMeta.teamname.includes('.')
  const isBigTeam = Chat.useChatState(s => (fromNewTeamWizard ? false : getIsBigTeam(s.inboxLayout, teamID)))
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
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.Button
            fullWidth={true}
            label={`Invite ${addingMembers.length} ${noun} & finish`}
            waiting={waiting}
            onClick={onComplete}
            disabled={addingMembers.length === 0}
          />
      </Kb.Box2>
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
            ...(Kb.Styles.isMobile ? [{onClick: onAddContacts, title: 'From contacts'}] : []),
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
  const [role, setRole] = React.useState<RoleType>(storeRole)
  React.useEffect(() => {
    setRole(storeRole)
  }, [storeRole])
  const onConfirmRole = (newRole: RoleType) => {
    setRole(newRole)
    setShowingMenu(false)
    updateWizard(setWizardRole(wizard, newRole))
  }
  return (
    <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
      <Kb.Text type="BodySmall">Invite as: </Kb.Text>
      <FloatingRolePicker<true>
        open={showingMenu}
        presetRole={storeRole}
        onCancel={storeRole === role ? () => setShowingMenu(false) : undefined}
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

const AddingMembers = ({
  disabledRoles,
  updateWizard,
  wizard,
}: {
  disabledRoles: DisabledRoles
  updateWizard: (wizard: AddMembersWizard) => void
  wizard: AddMembersWizard
}) => {
  const {addingMembers} = wizard
  const [expanded, setExpanded] = React.useState(false)
  const showDivider = Kb.Styles.isMobile && addingMembers.length > 4
  const aboveDivider = C.isMobile ? addingMembers.slice(0, 4) : addingMembers
  const belowDivider = C.isMobile && expanded ? addingMembers.slice(4) : []
  const toggleExpanded = () => {
    if (Kb.Styles.isMobile) {
      Kb.LayoutAnimation.configureNext(Kb.LayoutAnimation.Presets.easeInEaseOut)
    }
    setExpanded(!expanded)
  }
  const content = (
    <Kb.Box2 direction="vertical" fullWidth={true} gap={Kb.Styles.isMobile ? 'tiny' : 'xtiny'}>
      {aboveDivider.map(toAdd => (
        <AddingMember
          key={toAdd.assertion}
          {...toAdd}
          lastMember={addingMembers.length === 1}
          disabledRoles={disabledRoles}
          updateWizard={updateWizard}
          wizard={wizard}
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
          <AddingMember
            key={toAdd.assertion}
            {...toAdd}
            disabledRoles={disabledRoles}
            updateWizard={updateWizard}
            wizard={wizard}
          />
        ))}
    </Kb.Box2>
  )
  if (Kb.Styles.isMobile) {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.addingMembers}>
        {content}
      </Kb.Box2>
    )
  }
  return <Kb.ScrollView style={styles.addingMembers}>{content}</Kb.ScrollView>
}

const AddingMember = (
  props: T.Teams.AddingMember & {
    disabledRoles: DisabledRoles
    lastMember?: boolean
    updateWizard: (wizard: AddMembersWizard) => void
    wizard: AddMembersWizard
  }
) => {
  const {wizard, updateWizard} = props
  const role = wizard.role
  const individualRole =
    wizard.addingMembers.find(member => member.assertion === props.assertion)?.role ??
    (role === 'setIndividually' ? 'writer' : role)
  const onRemove = () => {
    const nextWizard = removeWizardMember(wizard, props.assertion)
    if (props.lastMember) {
      C.Router2.navUpToScreen({name: 'teamAddToTeamFromWhere', params: {wizard: nextWizard}}, true)
      return
    }
    updateWizard(nextWizard)
  }
  const isPhoneEmail = props.assertion.endsWith('@phone') || props.assertion.endsWith('@email')
  const showDropdown = role === 'setIndividually'
  const [showingMenu, setShowingMenu] = React.useState(false)
  const [rolePickerRole, setRole] = React.useState(individualRole)
  const onOpenRolePicker = () => {
    setRole(individualRole)
    setShowingMenu(true)
  }

  const onConfirmRole = (newRole: typeof rolePickerRole) => {
    setRole(newRole)
    setShowingMenu(false)
    updateWizard(setWizardIndividualRole(wizard, props.assertion, newRole))
  }
  return (
    <Kb.Box2 direction="horizontal" alignSelf="stretch" alignItems="center" style={styles.addingMember} justifyContent="space-between">
      <Kb.Box2 direction="horizontal" alignItems="center" gap="tiny" flex={1} style={styles.memberPill}>
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

const DefaultChannels = ({
  teamID,
  updateWizard,
  wizard,
}: {
  teamID: T.Teams.TeamID
  updateWizard: (wizard: AddMembersWizard) => void
  wizard: AddMembersWizard
}) => {
  const {defaultChannels, defaultChannelsWaiting} = useDefaultChannels(teamID)
  const addToChannels = wizard.addToChannels
  const allKeybaseUsers = !wizard.addingMembers.some(member => member.assertion.includes('@'))
  const onChangeFromDefault = () => updateWizard(setWizardDefaultChannels(wizard, []))
  const onAdd = (toAdd: ReadonlyArray<T.Teams.ChannelNameID>) => {
      updateWizard(setWizardDefaultChannels(wizard, toAdd))
    }
  const onRemove = (toRemove: T.Teams.ChannelNameID) => {
      updateWizard(setWizardDefaultChannels(wizard, undefined, toRemove))
    }
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  addingMember: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: Kb.Styles.borderRadius,
    },
    isElectron: {
      height: 32,
      paddingLeft: Kb.Styles.globalMargins.tiny,
      paddingRight: Kb.Styles.globalMargins.tiny,
    },
    isMobile: {
      height: 40,
      paddingLeft: Kb.Styles.globalMargins.tiny,
      paddingRight: Kb.Styles.globalMargins.xsmall,
    },
  }),
  addingMemberDivider: {
    backgroundColor: Kb.Styles.globalColors.black_20,
    borderRadius: Kb.Styles.borderRadius,
    height: 40,
  },
  addingMembers: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.blueGreyDark,
      borderRadius: Kb.Styles.borderRadius,
    },
    isElectron: {
      ...Kb.Styles.padding(
        Kb.Styles.globalMargins.tiny,
        Kb.Styles.globalMargins.small,
        Kb.Styles.globalMargins.tiny,
        Kb.Styles.globalMargins.tiny
      ),
      maxHeight: 168,
    },
    isMobile: {padding: Kb.Styles.globalMargins.tiny},
  }),
  body: {
    flex: 1,
    padding: Kb.Styles.globalMargins.small,
  },
  flexDefinitelyShrink: {flexShrink: 100},
  flexShrink: {flexShrink: 1},
  memberPill: {width: 0},
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
}))

type Props = {
  wizard: AddMembersWizard
}

export default AddMembersConfirm
