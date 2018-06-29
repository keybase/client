// @flow
import React from 'react'
import {Box, Button, Checkbox, HeaderOrPopup, Input, Text, ScrollView} from '../../common-adapters/index'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'
import {validTeamnamePart} from '../../constants/teamname'

type Props = {
  baseTeam: string,
  errorText: string,
  isSubteam: boolean,
  joinSubteam: boolean,
  name: string,
  onCancel: () => void,
  onJoinSubteamChange: () => void,
  onNameChange: (n: string) => void,
  onSetTeamCreationError: (err: string) => void,
  onSubmit: (fullName: string) => void,
  pending: boolean,
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
      <ScrollView>
        <Box style={globalStyles.flexBoxColumn}>
          <Box
            style={{
              ...styleContainer,
              backgroundColor: globalColors.blue,
            }}
          >
            <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{textAlign: 'center'}}>
              {this._headerText()}
              {this.props.isSubteam && (
                <Text
                  type="BodySmallSemiboldPrimaryLink"
                  style={{...globalStyles.fontSemibold}}
                  backgroundMode="Announcements"
                  onClickURL="https://keybase.io/docs/teams/design"
                >
                  Learn more
                </Text>
              )}
            </Text>
          </Box>
          {!!errorText && (
            <Box
              style={{
                ...styleContainer,
                backgroundColor: globalColors.red,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              }}
            >
              <Text
                style={{textAlign: 'center', width: '100%'}}
                type="BodySmallSemibold"
                backgroundMode="HighRisk"
              >
                {errorText}
              </Text>
            </Box>
          )}

          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              ...stylePadding,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: globalColors.white,
            }}
          >
            <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
              <Input
                autoFocus={true}
                hintText="Name your team"
                value={name}
                onChangeText={onNameChange}
                onEnterKeyDown={this._onSubmit}
                disabled={pending}
              />
            </Box>

            {isSubteam && (
              <Box
                style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium, opacity: name ? 1 : 0}}
              >
                <Text type="Body">
                  This team will be named <Text type="BodySemibold">{this._fullName()}</Text>
                </Text>
              </Box>
            )}

            {isSubteam && (
              <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
                <Checkbox
                  checked={joinSubteam}
                  label="Join this subteam after creating it"
                  onCheck={onJoinSubteamChange}
                />
              </Box>
            )}

            <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.large}}>
              <Button
                type="Primary"
                style={{marginLeft: globalMargins.tiny}}
                onClick={this._onSubmit}
                label="Create team"
                disabled={pending}
              />
            </Box>
          </Box>
        </Box>
      </ScrollView>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexBoxCenter,
  ...(isMobile ? {} : {cursor: 'default'}),
  minHeight: 40,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  borderTopLeftRadius: isMobile ? 0 : 4,
  borderTopRightRadius: isMobile ? 0 : 4,
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

export default HeaderOrPopup(Contents)
