// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'

export type Props = {
  onBack: () => void,
  onDelete: () => void,
  teamname: string,
  title: string,
}

const Header = (props: Props) => (
  <>
    <Kb.Avatar teamname={props.teamname} size={64} />
    <Kb.Icon type="icon-team-leave-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
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

  componentDidUpdate() {
    if (this.state.box1 && this.state.box2 && this.state.box3) {
      this.props.onAllowDelete(true)
    } else {
      this.props.onAllowDelete(false)
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical">
        <Kb.Box direction="horizontal">
          <Kb.Checkbox
            checked={this.state.box1}
            label="Team chats will be lost"
            onCheck={() => this.setState({box1: !this.state.box1})}
          />
        </Kb.Box>
        <Kb.Box direction="horizontal">
          <Kb.Checkbox
            checked={this.state.box2}
            label="Data in the team folder will be lost"
            onCheck={() => this.setState({box2: !this.state.box2})}
          />
        </Kb.Box>
        <Kb.Box direction="horizontal">
          <Kb.Checkbox
            checked={this.state.box3}
            label="Team members will be notified"
            onCheck={() => this.setState({box3: !this.state.box3})}
          />
        </Kb.Box>
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
        confirmText={`Yes, leave ${this.props.teamname}`}
        content={<Checkboxes onAllowDelete={allowDelete => this.setState({allowDelete})} />}
        description={`You will lose access to all the ${
          this.props.teamname
        } chats and folders, and you won't be able to get back
    unless an admin invites you.`}
        header={<Header {...this.props} />}
        onCancel={this.props.onBack}
        onConfirm={this.state.allowDelete ? this.props.onDelete : null}
        prompt={`Are you sure you want to delete ${this.props.teamname}?`}
        waitingKey={Constants.deleteTeamWaitingKey(this.props.teamname)}
      />
    )
  }
}

export default Kb.HeaderOnMobile(_ReallyDeleteTeam)
