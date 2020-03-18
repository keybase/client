import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  onBack: () => void
  onDeleteTeam: () => void
  name: string
  stillLoadingTeam: boolean
}

// TODO update this to the new design
const ReallyLeaveTeam = (props: Props) => (
  <Kb.Modal
    mode="Wide"
    onClose={props.onBack}
    header={{hideBorder: true}}
    footer={{
      content: (
        <Kb.ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
          <Kb.Button
            onClick={props.onBack}
            label="Got it"
            fullWidth={true}
            disabled={props.stillLoadingTeam}
          />
        </Kb.ButtonBar>
      ),
      hideBorder: true,
    }}
  >
    {props.stillLoadingTeam ? (
      <Kb.ProgressIndicator type="Huge" />
    ) : (
      <Kb.Box2 direction="vertical" alignItems="center" gap="medium" style={styles.container}>
        <Kb.Box2 direction="vertical" style={Styles.globalStyles.positionRelative}>
          <Kb.Avatar teamname={props.name} size={64} />
          <Kb.Icon type="icon-team-leave-28" style={styles.leaveIcon} />
        </Kb.Box2>
        <Kb.Text type="Header" center={true} style={styles.headerText}>
          You can't leave the {props.name} team because you're the only owner.
        </Kb.Text>
        <Kb.Text type="Body" center={true} style={styles.bodyText}>
          You'll have to add another user as an owner before you can leave {props.name}, or{' '}
          <Kb.Text type="BodyPrimaryLink" onClick={props.onDeleteTeam}>
            delete the&nbsp;team
          </Kb.Text>
          .
        </Kb.Text>
      </Kb.Box2>
    )}
  </Kb.Modal>
)

const styles = Styles.styleSheetCreate(() => ({
  bodyText: Styles.platformStyles({isElectron: {maxWidth: 430}}),
  buttonBar: {minHeight: undefined},
  container: Styles.platformStyles({isMobile: {...Styles.padding(0, Styles.globalMargins.small)}}),
  headerText: {maxWidth: 380},
  leaveIcon: {bottom: -10, position: 'absolute', right: -10},
}))

export default ReallyLeaveTeam
