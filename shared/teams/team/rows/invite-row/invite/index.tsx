import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {typeToLabel} from '../../../../../constants/teams'
import {TeamRoleType} from '../../../../../constants/types/teams'
import flags from '../../../../../util/feature-flags'

export type Props = {
  label: string
  onCancelInvite?: () => void
  role: TeamRoleType
}

const TeamInviteRowOld = (props: Props) => {
  const {onCancelInvite, role, label} = props
  return (
    <Kb.Box2 alignItems="center" direction="horizontal" fullWidth={true} style={styles.container}>
      <Kb.Avatar username={label} size={Styles.isMobile ? 48 : 32} />
      <Kb.Box2 alignItems="flex-start" direction="vertical" style={styles.usernameRole}>
        <Kb.ConnectedUsernames
          lineClamp={1}
          type="BodyBold"
          colorFollowing={true}
          inline={true}
          usernames={label}
        />
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
  const {onCancelInvite, role, label} = props
  return (
    <Kb.ListItem2
      type="Small"
      icon={<Kb.Avatar username={label} size={32} />}
      body={
        <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center">
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodySemibold" lineClamp={1}>
              {label}
            </Kb.Text>
            {!!role && <Kb.Text type="BodySmall">{typeToLabel[role]}</Kb.Text>}
          </Kb.Box2>
        </Kb.Box2>
      }
      action={<TeamInviteMenu onCancelInvite={onCancelInvite} />}
      onlyShowActionOnHover="fade"
      firstItem={true /* TODO */}
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
