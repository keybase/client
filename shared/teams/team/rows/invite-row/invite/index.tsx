import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {typeToLabel} from '../../../../../constants/teams'
import {TeamRoleType} from '../../../../../constants/types/teams'
import flags from '../../../../../util/feature-flags'

export type Props = {
  isKeybaseUser?: boolean
  label: string
  subLabel?: string
  onCancelInvite?: () => void
  role: TeamRoleType
  firstItem: boolean
}

const TeamInviteRowOld = (props: Props) => {
  const {onCancelInvite, role, label, isKeybaseUser} = props
  return (
    <Kb.Box2 alignItems="center" direction="horizontal" fullWidth={true} style={styles.container}>
      <Kb.Avatar username={isKeybaseUser ? label : ''} size={Styles.isMobile ? 48 : 32} />
      <Kb.Box2 alignItems="flex-start" direction="vertical" style={styles.usernameRole}>
        {isKeybaseUser ? (
          <Kb.ConnectedUsernames
            lineClamp={1}
            type="BodyBold"
            colorFollowing={true}
            inline={true}
            usernames={label}
          />
        ) : (
          <Kb.Text type="BodyBold">{label}</Kb.Text>
        )}
        <Kb.Text type="BodySmall">{role && typeToLabel[role]}</Kb.Text>
      </Kb.Box2>
      <Kb.WaitingButton
        small={true}
        label={Styles.isMobile ? 'Cancel' : 'Cancel invite'}
        onClick={onCancelInvite}
        type="Dim"
        waitingKey={null}
      />
    </Kb.Box2>
  )
}

const TeamInviteRowNew = (props: Props) => {
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

const _TeamInviteMenu = (props: Kb.PropsWithOverlay<{onCancelInvite?: () => void}>) => {
  return (
    <>
      <Kb.Button
        ref={props.setAttachmentRef}
        mode="Secondary"
        type="Dim"
        small={true}
        icon="iconfont-ellipsis"
        onClick={props.toggleShowingMenu}
      />
      <Kb.FloatingMenu
        items={[
          {danger: true, icon: 'iconfont-remove', onClick: props.onCancelInvite, title: 'Cancel invite'},
        ]}
        visible={props.showingMenu}
        onHidden={props.toggleShowingMenu}
        closeOnSelect={true}
        attachTo={props.getAttachmentRef}
      />
    </>
  )
}
const TeamInviteMenu = Kb.OverlayParentHOC(_TeamInviteMenu)

export const TeamInviteRow = flags.teamsRedesign ? TeamInviteRowNew : TeamInviteRowOld

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
  },
  usernameRole: {
    flex: 1,
    marginLeft: Styles.globalMargins.small,
  },
}))
