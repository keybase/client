import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  error?: Error
  teamname?: string
  name: string
  onDelete: (notifyTeam: boolean) => void
  onClose: () => void
  waitingKey: string
}

type State = {
  name: string
  notifyTeam: boolean
}

class DeleteRepo extends React.Component<Props, State> {
  state = {
    name: '',
    notifyTeam: true,
  }

  _matchesName = () => {
    if (this.state.name === this.props.name) {
      return true
    }

    if (this.props.teamname && this.state.name === `${this.props.teamname}/${this.props.name}`) {
      return true
    }

    return false
  }

  _onSubmit = () => {
    if (this._matchesName()) {
      this.props.onDelete(this.state.notifyTeam)
    }
  }

  render() {
    return (
      <Kb.PopupWrapper onCancel={this.props.onClose} title="Delete repo?">
        <Kb.ScrollView>
          <Kb.Box style={styles.container}>
            {!!this.props.error && (
              <Kb.Box style={styles.error}>
                <Kb.Text type="Body" negative={true}>
                  {this.props.error.message}
                </Kb.Text>
              </Kb.Box>
            )}
            <Kb.Text center={true} type="Header" style={{marginBottom: 27}}>
              Are you sure you want to delete this {this.props.teamname ? 'team ' : ''}
              repository?
            </Kb.Text>
            <Kb.Icon
              type={this.props.teamname ? 'icon-repo-team-delete-48' : 'icon-repo-personal-delete-48'}
            />
            <Kb.Box style={styles.avatarBox}>
              {!!this.props.teamname && (
                <Kb.Avatar
                  isTeam={true}
                  teamname={this.props.teamname}
                  size={16}
                  style={{marginRight: Styles.globalMargins.xtiny}}
                />
              )}
              <Kb.Text
                type="BodySemibold"
                style={{color: Styles.globalColors.redDark, textDecorationLine: 'line-through'}}
              >
                {this.props.teamname ? `${this.props.teamname}/${this.props.name}` : this.props.name}
              </Kb.Text>
            </Kb.Box>
            <Kb.Text center={true} type="Body" style={{marginBottom: Styles.globalMargins.medium}}>
              {this.props.teamname
                ? 'This will permanently delete your remote files and history, and all members of the team will be notified.  This action cannot be undone.'
                : 'This will permanently delete your remote files and history. This action cannot be undone.'}
            </Kb.Text>
            <Kb.Text style={styles.confirm} type="BodySemibold">
              Enter the name of the repository to&nbsp;confirm:
            </Kb.Text>
            <Kb.LabeledInput
              autoFocus={true}
              value={this.state.name}
              onChangeText={name => this.setState({name})}
              onEnterKeyDown={this._onSubmit}
              placeholder="Name of the repository"
            />
            {!!this.props.teamname && (
              <Kb.Checkbox
                label="Notify the team"
                checked={this.state.notifyTeam}
                onCheck={notifyTeam => this.setState({notifyTeam})}
                style={styles.checkbox}
              />
            )}
            <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
              <Kb.WaitingButton
                type="Dim"
                onClick={this.props.onClose}
                label="Cancel"
                style={{marginRight: Styles.globalMargins.tiny}}
                waitingKey={this.props.waitingKey}
                onlyDisable={true}
              />
              <Kb.WaitingButton
                type="Danger"
                onClick={this._onSubmit}
                label={Styles.isMobile ? 'Delete' : 'Delete this repository'}
                disabled={!this._matchesName()}
                waitingKey={this.props.waitingKey}
              />
            </Kb.ButtonBar>
          </Kb.Box>
        </Kb.ScrollView>
      </Kb.PopupWrapper>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  avatarBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    marginBottom: Styles.globalMargins.medium,
  },
  buttonBar: {alignItems: 'center'},
  checkbox: {
    alignSelf: 'flex-start',
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
  confirm: {
    alignSelf: 'flex-start',
    marginBottom: Styles.globalMargins.tiny,
  },
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      flex: 1,
      height: '100%',
    },
    isElectron: {
      maxHeight: 560,
      padding: Styles.globalMargins.large,
      paddingBottom: Styles.globalMargins.small,
      width: 400,
    },
    isMobile: {
      padding: Styles.globalMargins.small,
    },
  }),
  error: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.red,
    marginBottom: Styles.globalMargins.small,
    padding: Styles.globalMargins.tiny,
  },
}))

export default DeleteRepo
