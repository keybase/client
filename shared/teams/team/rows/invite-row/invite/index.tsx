import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {typeToLabel} from '../../../../../constants/teams'
import {TeamRoleType} from '../../../../../constants/types/teams'

export type Props = {
  label: string
  onCancelInvite?: () => void
  role: TeamRoleType
}

export const TeamInviteRow = (props: Props) => {
  const {onCancelInvite, role, label} = props
  return (
    <Kb.Box2 alignItems="center" direction="horizontal" fullWidth={true} style={styles.container}>
      <Kb.Avatar username={label} size={Styles.isMobile ? 48 : 32} />
      <Kb.Box2 alignItems="flex-start" direction="vertical" style={styles.usernameRole}>
        <Kb.ConnectedUsernames
          lineClamp={1}
          type="BodySemibold"
          colorFollowing={true}
          inline={true}
          usernames={[label]}
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

const styles = Styles.styleSheetCreate(() => ({
  container: {
    padding: Styles.globalMargins.tiny,
  },
  usernameRole: {
    flex: 1,
    marginLeft: Styles.globalMargins.small,
  },
}))
