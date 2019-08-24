import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  onBack: () => void
  onDelete: () => void
  teamname: string
}

const Header = (props: Props) => (
  <>
    <Kb.Avatar teamname={props.teamname} size={64} />
    <Kb.Icon type="icon-team-delete-28" style={{marginRight: -60, marginTop: -20}} />
    <Kb.Text style={styles.headerTeamname} type="BodySemibold">
      {props.teamname}
    </Kb.Text>
  </>
)

export type CheckboxesProps = {
  box1: boolean
  box2: boolean
  box3: boolean
  onSetBox1: (checked: boolean) => void
  onSetBox2: (checked: boolean) => void
  onSetBox3: (checked: boolean) => void
}

const Checkboxes = (props: CheckboxesProps) => (
  <Kb.Box2 direction="vertical">
    <Kb.Checkbox
      checked={props.box1}
      label="Team chats will be lost"
      onCheck={checked => props.onSetBox1(checked)}
    />
    <Kb.Checkbox
      checked={props.box2}
      label="Data in the team folder will be lost"
      onCheck={checked => props.onSetBox2(checked)}
    />
    <Kb.Checkbox
      checked={props.box3}
      label="Team members will be notified"
      onCheck={checked => props.onSetBox3(checked)}
    />
  </Kb.Box2>
)

type State = {
  box1: boolean
  box2: boolean
  box3: boolean
}

class _ReallyDeleteTeam extends React.Component<Props, State> {
  state = {
    box1: false,
    box2: false,
    box3: false,
  }

  render() {
    return (
      <Kb.ConfirmModal
        confirmText="Delete team"
        content={
          <Checkboxes
            box1={this.state.box1}
            box2={this.state.box2}
            box3={this.state.box3}
            onSetBox1={box1 => this.setState({box1})}
            onSetBox2={box2 => this.setState({box2})}
            onSetBox3={box3 => this.setState({box3})}
          />
        }
        description="This cannot be undone. By deleting the team, you agree that:"
        header={<Header {...this.props} />}
        onCancel={this.props.onBack}
        onConfirm={this.state.box1 && this.state.box2 && this.state.box3 ? this.props.onDelete : undefined}
        prompt={`Are you sure you want to delete ${this.props.teamname}?`}
        waitingKey={Constants.deleteTeamWaitingKey(this.props.teamname)}
      />
    )
  }
}

const styles = Styles.styleSheetCreate({
  headerTeamname: {color: Styles.globalColors.redDark, textDecorationLine: 'line-through'},
})

export default _ReallyDeleteTeam
