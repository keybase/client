import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {formatPhoneNumber} from '@/util/phone-numbers'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'

export type Props = {
  isKeybaseUser?: boolean
  label: string
  subLabel?: string
  onCancelInvite?: () => void
  role: T.Teams.TeamRoleType
  firstItem: boolean
}

export const TeamInviteRow = (props: Props) => {
  const {onCancelInvite, role, label, firstItem, subLabel, isKeybaseUser} = props
  const text2 = subLabel ? `${subLabel} · ${Teams.typeToLabel[role]}` : Teams.typeToLabel[role]
  return (
    <Kb.ListItem2
      type="Small"
      icon={<Kb.Avatar username={isKeybaseUser ? label : '+'} size={32} />}
      body={
        <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center">
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodySemibold" lineClamp={1}>
              {label}
            </Kb.Text>
            {!!text2 && <Kb.Text type="BodySmall">{text2}</Kb.Text>}
          </Kb.Box2>
        </Kb.Box2>
      }
      action={<TeamInviteMenu onCancelInvite={onCancelInvite} />}
      onlyShowActionOnHover="fade"
      firstItem={firstItem}
    />
  )
}

const TeamInviteMenu = (props: {onCancelInvite?: () => void}) => {
  const {onCancelInvite} = props
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          items={[{danger: true, icon: 'iconfont-remove', onClick: onCancelInvite, title: 'Cancel invite'}]}
          visible={true}
          onHidden={hidePopup}
          closeOnSelect={true}
          attachTo={attachTo}
        />
      )
    },
    [onCancelInvite]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.Button
        ref={popupAnchor}
        mode="Secondary"
        type="Dim"
        small={true}
        icon="iconfont-ellipsis"
        onClick={showPopup}
      />
      {popup}
    </>
  )
}

type OwnProps = {
  id: string
  teamID: T.Teams.TeamID
  firstItem: boolean
}

/**
 * labelledInviteRegex matches a string like "Jakob (+1 (216) 555-3434)" or "Max (max@keybase.io)"
 * The ? in the first group is so that it doesn't treat "216) 555-3434" as the parenthesized bit in the first case above.
 */
const labelledInviteRegex = /^(.+?) \((.+)\)$/

// TODO: when removing flags.teamsRedesign, move this into the component itself
const Container = (ownProps: OwnProps) => {
  const {teamID} = ownProps
  const teamDetails = useTeamsState(s => s.teamDetails.get(teamID))
  const _invites = teamDetails?.invites

  const removePendingInvite = useTeamsState(s => s.dispatch.removePendingInvite)
  const _onCancelInvite = (inviteID: string) => {
    removePendingInvite(teamID, inviteID)
  }

  const user = [...(_invites ?? [])].find(invite => invite.id === ownProps.id) || Teams.emptyInviteInfo

  let label: string = ''
  let subLabel: undefined | string
  let role: T.Teams.TeamRoleType = 'reader'
  let isKeybaseUser = false

  const onCancelInvite = () => _onCancelInvite(ownProps.id)
  label = user.username || user.name || user.email || user.phone
  subLabel = user.name ? user.phone || user.email : undefined
  role = user.role
  isKeybaseUser = !!user.username
  if (!subLabel && labelledInviteRegex.test(label)) {
    const match = labelledInviteRegex.exec(label)!
    label = match[1] ?? ''
    subLabel = match[2]
  }
  try {
    label = label === user.phone ? formatPhoneNumber('+' + label) : label
    subLabel = subLabel === user.phone ? formatPhoneNumber('+' + subLabel) : subLabel
  } catch {}
  const props = {
    firstItem: ownProps.firstItem,
    isKeybaseUser,
    label,
    onCancelInvite,
    role,
    subLabel,
  }
  return <TeamInviteRow {...props} />
}

export default Container
