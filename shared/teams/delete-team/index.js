// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  onBack: () => void,
  onDelete: () => void,
  teamname: string,
}

const Header = (props: Props) => (
  <>
    <Kb.Avatar teamname={props.teamname} size={64} />
    <Kb.Icon type="icon-team-delete-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
    <Kb.Text style={styles.headerTeamname} type="BodySemibold">
      {props.teamname}
    </Kb.Text>
  </>
)

type CheckboxesState = {|
  box1: boolean,
  box2: boolean,
  box3: boolean,
|}
type CheckboxesProps = {|
  onAllowDelete: boolean => void,
|}

class Checkboxes extends React.Component<CheckboxesProps, CheckboxesState> {
  state = {
    box1: false,
    box2: false,
    box3: false,
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.box1 &&
      this.state.box2 &&
      this.state.box3 &&
      (!prevState.box1 || !prevState.box2 || !prevState.box3)
    ) {
      this.props.onAllowDelete(true)
    } else if (
      this.state.box1 !== prevState.box1 ||
      this.state.box2 !== prevState.box2 ||
      this.state.box3 !== prevState.box3
    ) {
      this.props.onAllowDelete(false)
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical">
        <Kb.Checkbox
          checked={this.state.box1}
          label="Team chats will be lost"
          onCheck={() => this.setState({box1: !this.state.box1})}
        />
        <Kb.Checkbox
          checked={this.state.box2}
          label="Data in the team folder will be lost"
          onCheck={() => this.setState({box2: !this.state.box2})}
        />
        <Kb.Checkbox
          checked={this.state.box3}
          label="Team members will be notified"
          onCheck={() => this.setState({box3: !this.state.box3})}
        />
      </Kb.Box2>
    )
  }
}

type State = {|
  allowDelete: boolean,
|}

class _ReallyDeleteTeam extends React.Component<Props, State> {
  state = {
    allowDelete: false,
  }

  render() {
    return (
      <Kb.ConfirmModal
        confirmText={`Delete ${this.props.teamname}`}
        content={<Checkboxes onAllowDelete={allowDelete => this.setState({allowDelete})} />}
        description="This cannot be undone. By deleting the team, you agree that:"
        header={<Header {...this.props} />}
        onCancel={this.props.onBack}
        onConfirm={this.state.allowDelete ? this.props.onDelete : null}
        prompt={`Are you sure you want to delete ${this.props.teamname}?`}
        waitingKey={Constants.deleteTeamWaitingKey(this.props.teamname)}
      />
    )
  }
}

const styles = Styles.styleSheetCreate({
  headerTeamname: {color: Styles.globalColors.red, textDecorationLine: 'line-through'},
})

export default _ReallyDeleteTeam
