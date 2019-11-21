import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  onBack: () => void
  onLeave: () => void
  name: string
}

const ReallyLeaveTeam = (props: Props) => (
  <Kb.Modal
    header={{hideBorder: true}}
    footer={{
      content: (
        <Kb.ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
          <Kb.Button onClick={props.onBack} label="Got it" />
        </Kb.ButtonBar>
      ),
      hideBorder: true,
    }}
  >
    <Kb.Box2 direction="vertical" alignItems="center" gap="medium" gapEnd={true}>
      <Kb.Box2 direction="vertical">
        <Kb.Avatar teamname={props.name} size={64} />
        <Kb.Icon type="icon-team-leave-28" style={styles.leaveIcon} />
      </Kb.Box2>
      <Kb.Text type="Header" center={true} style={styles.headerText}>
        You can't leave the {props.name} team because you're the only owner.
      </Kb.Text>
      <Kb.Text type="Body" center={true} style={styles.bodyText}>
        You'll have to add another user as an owner before you can leave {props.name}.
      </Kb.Text>
    </Kb.Box2>
  </Kb.Modal>
)

const styles = Styles.styleSheetCreate(() => ({
  bodyText: {maxWidth: 430},
  buttonBar: {minHeight: undefined},
  headerText: {maxWidth: 380},
  leaveIcon: {height: 28, marginRight: -60, marginTop: -20, width: 28, zIndex: 1},
}))

export default ReallyLeaveTeam
