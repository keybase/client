import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import {typeToLabel} from '../../../../../constants/teams'
import type * as T from '../../../../../constants/types'

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
  const text2 = subLabel ? (role ? `${subLabel} · ${typeToLabel[role]}` : subLabel) : typeToLabel[role]
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
      const {attachTo, toggleShowingPopup} = p
      return (
        <Kb.FloatingMenu
          items={[{danger: true, icon: 'iconfont-remove', onClick: onCancelInvite, title: 'Cancel invite'}]}
          visible={true}
          onHidden={toggleShowingPopup}
          closeOnSelect={true}
          attachTo={attachTo}
        />
      )
    },
    [onCancelInvite]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.Button
        ref={popupAnchor}
        mode="Secondary"
        type="Dim"
        small={true}
        icon="iconfont-ellipsis"
        onClick={toggleShowingPopup}
      />
      {popup}
    </>
  )
}
