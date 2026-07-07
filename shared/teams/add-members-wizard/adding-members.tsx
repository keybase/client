import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {assertionToDisplay} from '@/common-adapters/usernames'
import capitalize from 'lodash/capitalize'
import {FloatingRolePicker} from '../role-picker'
import {removeWizardMember, setWizardIndividualRole, type AddMembersWizard} from './state'

export type DisabledRoles = React.ComponentProps<typeof FloatingRolePicker>['disabledRoles']

const disabledRolesForPhoneEmailIndividual = {
  admin: 'Only Keybase users can be added as admins.',
}

// the collapsible pill list of everyone about to be added
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
  const showDivider = isMobile && addingMembers.length > 4
  const aboveDivider = isMobile ? addingMembers.slice(0, 4) : addingMembers
  const belowDivider = isMobile && expanded ? addingMembers.slice(4) : []
  const toggleExpanded = () => {
    if (isMobile) {
      Kb.LayoutAnimation.configureNext(Kb.LayoutAnimation.Presets.easeInEaseOut)
    }
    setExpanded(!expanded)
  }
  const content = (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      gap={isMobile ? 'tiny' : 'xtiny'}
      style={isMobile ? styles.addingMembers : undefined}
    >
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
        <Kb.ClickableBox onClick={toggleExpanded} direction="horizontal" alignSelf="stretch" style={styles.addingMemberDivider} centerChildren={true}>
          <Kb.Text type="BodySemibold" negative={true}>
            {expanded ? 'Show less' : `+${addingMembers.length - 4} more`}
          </Kb.Text>
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
  if (isMobile) {
    return content
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  addingMember: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: Kb.Styles.borderRadius,
    },
    isElectron: {
      height: 32,
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.tiny),
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
  flexDefinitelyShrink: {flexShrink: 100},
  flexShrink: {flexShrink: 1},
  memberPill: {width: 0},
}))

export default AddingMembers
