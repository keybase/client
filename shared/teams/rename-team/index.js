// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const splitTeamname = teamname => teamname.split('.')

type Props = {|
  error?: string,
  onCancel: () => void,
  onRename: (newName: string) => void,
  teamname: string,
  title: string,
|}

class RenameTeam extends React.Component<Props, {|newName: string|}> {
  state = {newName: ''}
  _prefix = ''
  _originalName = ''

  constructor(props: Props) {
    super(props)
    const teamNameParts = splitTeamname(this.props.teamname)
    const newName = teamNameParts.pop()
    this._prefix = teamNameParts.join('')
    this._originalName = newName
  }

  _onChangeText = newName => this.setState({newName})
  _onRename = () => {
    if (this.props.teamname === [this._prefix, this.state.newName].join('.')) {
      // same name
      this.props.onCancel()
      return
    }
    this.props.onRename(this.state.newName)
  }

  render() {
    return (
      <Kb.Box2 alignItems="center" direction="vertical" style={styles.container} fullWidth={true}>
        <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} gap="medium" gapStart={true}>
          <Kb.Avatar teamname={this.props.teamname} size={Styles.isMobile ? 64 : 48} />
          {!Styles.isMobile && (
            <Kb.Text type="Header" center={true}>
              Rename {this.props.teamname}
            </Kb.Text>
          )}
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
              onChangeText={this._onChangeText}
              textType="BodySemibold"
              style={styles.input}
              maxLength={16}
              placeholder={this._originalName}
            />
          </Kb.Box2>
          {this.props.error && (
            <Kb.Text type="BodySmall" style={styles.error}>
              {this.props.error}
            </Kb.Text>
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
            disabled={this.state.newName.length < 2}
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
    color: Styles.globalColors.red,
  },
  input: Styles.platformStyles({isMobile: {flexGrow: 0, width: 200}}),
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
})

export default Kb.HeaderOrPopupWithHeader(RenameTeam)
