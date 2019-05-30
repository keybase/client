import React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/teams'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'
import {validTeamnamePart} from '../../constants/teamname'

type Props = {
  baseTeam: string
  errorText: string
  isSubteam: boolean
  joinSubteam: boolean
  name: string
  onCancel: () => void
  onJoinSubteamChange: () => void
  onNameChange: (n: string) => void
  onSetTeamCreationError: (err: string) => void
  onSubmit: (fullName: string) => void
  pending: boolean
}

class Contents extends React.Component<Props> {
  _onSubmit = () => {
    if (!validTeamnamePart(this.props.name)) {
      this.props.onSetTeamCreationError(
        'Teamnames must be between 2 and 16 characters long, can only contain letters and underscores, and cannot begin with an underscore.'
      )
      return
    }
    this.props.onSubmit(this._fullName())
  }

  _headerText = () => {
    if (this.props.isSubteam) {
      return `You are creating a subteam of ${this.props.baseTeam}. `
    }
    return "For security reasons, team names are unique and can't be changed, so choose carefully."
  }

  _fullName = () =>
    this.props.isSubteam ? this.props.baseTeam.concat(`.${this.props.name}`) : this.props.name

  render() {
    const {isSubteam, joinSubteam, name, onJoinSubteamChange, onNameChange, pending} = this.props
    const errorText = this.props.errorText
    return (
      <Kb.ScrollView>
        <Kb.Box style={globalStyles.flexBoxColumn}>
          <Kb.Box
            style={{
              ...styleContainer,
              backgroundColor: globalColors.blue,
            }}
          >
            <Kb.Text center={true} type="BodySmallSemibold" negative={true}>
              {this._headerText()}
              {this.props.isSubteam && (
                <Kb.Text
                  type="BodySmallSemiboldPrimaryLink"
                  style={{...globalStyles.fontSemibold}}
                  negative={true}
                  onClickURL="https://keybase.io/docs/teams/design"
                >
                  Learn more
                </Kb.Text>
              )}
            </Kb.Text>
          </Kb.Box>
          {!!errorText && (
            <Kb.Box
              style={{
                ...styleContainer,
                backgroundColor: globalColors.red,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              }}
            >
              <Kb.Text center={true} style={{width: '100%'}} type="BodySmallSemibold" negative={true}>
                {errorText}
              </Kb.Text>
            </Kb.Box>
          )}

          <Kb.Box
            style={{
              ...globalStyles.flexBoxColumn,
              ...stylePadding,
              alignItems: 'center',
              backgroundColor: globalColors.white,
              justifyContent: 'center',
            }}
          >
            <Kb.Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
              <Kb.Input
                autoFocus={true}
                editable={!pending}
                hintText="Name your team"
                value={name}
                onChangeText={onNameChange}
                onEnterKeyDown={this._onSubmit}
              />
            </Kb.Box>

            {isSubteam && (
              <Kb.Box
                style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium, opacity: name ? 1 : 0}}
              >
                <Kb.Text type="Body">
                  This team will be named <Kb.Text type="BodySemibold">{this._fullName()}</Kb.Text>
                </Kb.Text>
              </Kb.Box>
            )}

            {isSubteam && (
              <Kb.Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
                <Kb.Checkbox
                  checked={joinSubteam}
                  label="Join this subteam after creating it"
                  onCheck={onJoinSubteamChange}
                />
              </Kb.Box>
            )}

            <Kb.Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.large}}>
              <Kb.WaitingButton
                style={{marginLeft: globalMargins.tiny}}
                onClick={this._onSubmit}
                label="Create team"
                waitingKey={Constants.teamCreationWaitingKey}
              />
            </Kb.Box>
          </Kb.Box>
        </Kb.Box>
      </Kb.ScrollView>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexBoxCenter,
  ...(isMobile ? {} : {cursor: 'default'}),
  borderTopLeftRadius: isMobile ? 0 : 4,
  borderTopRightRadius: isMobile ? 0 : 4,
  minHeight: 40,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
}

const stylePadding = isMobile
  ? {
      paddingTop: globalMargins.xlarge,
    }
  : {
      marginBottom: 80,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 90,
    }

export default Kb.HeaderOrPopup(Contents)
