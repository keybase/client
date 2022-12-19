import * as Kb from '../../../../../common-adapters'
import {typeToLabel} from '../../../../../constants/teams'
import type {TeamRoleType} from '../../../../../constants/types/teams'

export type Props = {
  isKeybaseUser?: boolean
  label: string
  subLabel?: string
  onCancelInvite?: () => void
  role: TeamRoleType
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
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      items={[{danger: true, icon: 'iconfont-remove', onClick: props.onCancelInvite, title: 'Cancel invite'}]}
      visible={showingPopup}
      onHidden={toggleShowingPopup}
      closeOnSelect={true}
      attachTo={attachTo}
    />
  ))
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
