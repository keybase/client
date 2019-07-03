import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const splitTeamname = teamname => teamname.split('.')

type Props = {
  error?: string
  onCancel: () => void
  onRename: (newName: string) => void
  onSuccess: (newName: string) => void
  teamname: string
  title: string
  waiting: boolean
}

const invalidChars = /[^a-zA-Z0-9_]/

class RenameTeam extends React.Component<
  Props,
  {
    error: string
    newName: string
  }
> {
  state = {error: '', newName: ''}
  _prefix = ''
  _originalName = ''

  constructor(props: Props) {
    super(props)
    const teamNameParts = splitTeamname(this.props.teamname)
    const newName = teamNameParts.pop()
    this._prefix = teamNameParts.join('.')
    this._originalName = newName
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.props.waiting && prevProps.waiting && !this.props.error) {
      // finished, go back
      this.props.onSuccess(this._newFullName())
    }
  }

  _newFullName = () => [this._prefix, this.state.newName].join('.')
  _onChangeText = newName => this.setState({newName})
  _disabled = () => this.state.newName.length < 2
  _validateTeamname = () => {
    const {newName} = this.state
    if (newName.startsWith('_') || newName.includes('__')) {
      this.setState({
        error: "Teamnames can't start with underscores or use double underscores to avoid confusion.",
      })
      return false
    }
    if (invalidChars.test(newName)) {
      this.setState({error: 'Teamnames can only use letters (a-z), numbers, and underscores.'})
      return false
    }
    return true
  }
  _onRename = () => {
    if (this.props.waiting || this._disabled()) {
      return
    }
    if (this.props.teamname === this._newFullName()) {
      // same name
      this.props.onCancel()
      return
    }
    this.setState(s => (s.error ? {error: ''} : null))
    if (this._validateTeamname()) {
      this.props.onRename(this._newFullName())
    }
  }

  render() {
    return (
      <Kb.Box2 alignItems="center" direction="vertical" style={styles.container} fullWidth={true}>
        <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} gap="medium" gapStart={true}>
          <Kb.Avatar teamname={this.props.teamname} size={Styles.isMobile ? 64 : 48} />
          <Kb.Box2 alignItems="center" direction="vertical" gap="tiny" style={styles.teamnameHeader}>
            {!Styles.isMobile && (
              <Kb.Text type="Header" center={true}>
                Rename {this.props.teamname}
              </Kb.Text>
            )}
            <Kb.Text type="BodySmall" center={true}>
              Subteam of {this._prefix}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          gap="tiny"
          alignItems="flex-start"
          fullWidth={true}
          style={styles.body}
        >
          <Kb.Box2
            direction="horizontal"
            style={Styles.collapseStyles([
              styles.inputContainer,
              this.props.error && styles.inputContainerError,
            ])}
            fullWidth={true}
          >
            <Kb.PlainInput
              autoFocus={true}
              disabled={this.props.waiting}
              onChangeText={this._onChangeText}
              onEnterKeyDown={this._onRename}
              textType="BodySemibold"
              flexable={true}
              maxLength={16}
              placeholder={this._originalName}
            />
          </Kb.Box2>
          {(!!this.state.error || !!this.props.error) && (
            <Kb.Text type="BodySmall" style={styles.error}>
              {this.state.error || this.props.error}
            </Kb.Text>
          )}
          {this.state.newName ? (
            <Kb.Text type="BodySmall">
              This team will be named{' '}
              <Kb.Text type="BodySmallSemibold">
                {this._prefix}.{this.state.newName.toLowerCase()}
              </Kb.Text>
            </Kb.Text>
          ) : (
            <Kb.Text type="BodySmall">Write a name to see a preview.</Kb.Text>
          )}
        </Kb.Box2>
        <Kb.ButtonBar direction="row" style={styles.buttonBar}>
          {!Styles.isMobile && (
            <Kb.Button type="Dim" label="Cancel" onClick={this.props.onCancel} style={styles.button} />
          )}
          <Kb.Button
            label="Rename"
            onClick={this._onRename}
            style={styles.button}
            disabled={this._disabled()}
            waiting={this.props.waiting}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  body: Styles.platformStyles({
    common: {flex: 1},
    isElectron: {paddingLeft: Styles.globalMargins.large, paddingRight: Styles.globalMargins.large},
    isMobile: {paddingLeft: Styles.globalMargins.small, paddingRight: Styles.globalMargins.small},
  }),
  button: {
    flex: 1,
  },
  buttonBar: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  container: Styles.platformStyles({
    isElectron: {
      height: 480,
      width: 560,
    },
    isMobile: {
      height: '100%',
    },
  }),
  error: {
    color: Styles.globalColors.redDark,
  },
  inputContainer: {
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.tiny,
  },
  inputContainerError: {
    borderColor: Styles.globalColors.red,
  },
  prefix: Styles.platformStyles({
    isMobile: {
      position: 'relative',
      top: 1,
    },
  }),
  teamnameHeader: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-word',
    },
  }),
})

export default Kb.HeaderOrPopupWithHeader(RenameTeam)
