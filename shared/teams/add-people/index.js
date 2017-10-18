// @flow
import * as React from 'react'
import {
  Box,
  Button,
  ClickableBox,
  Dropdown,
  ProgressIndicator,
  Text,
  PopupDialog,
} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import capitalize from 'lodash/capitalize'
import {isMobile} from '../../constants/platform'
import {type TeamRoleType} from '../../constants/teams'
import UserInput from '../../search/user-input/container'
import SearchResultsList from '../../search/results-list/container'

const MaybePopup = isMobile
  ? (props: {onClose: () => void, children: React.Node}) => (
      <Box style={{height: '100%', width: '100%'}} children={props.children} />
    )
  : (props: {onClose: () => void, children: React.Node}) => (
      <PopupDialog
        onClose={props.onClose}
        styleCover={_styleCover}
        styleContainer={_styleContainer}
        children={props.children}
      />
    )

type Props = {
  onAddPeople: (role: TeamRoleType) => void,
  onClose: () => void,
  onLeave: () => void,
  onOpenRolePicker: (currentSelectedRole: TeamRoleType, selectedRoleCallback: (TeamRoleType) => void) => void,
  name: string,
}

type State = {
  selectedRole: TeamRoleType,
}

class AddPeople extends React.Component<Props, State> {
  state: State = {
    selectedRole: 'writer',
  }

  _makeDropdownItem = (item: string) => {
    return (
      <Box
        key={item}
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          paddingLeft: globalMargins.small,
          paddingRight: globalMargins.small,
        }}
      >
        <Text type="Body">{capitalize(item)}</Text>
      </Box>
    )
  }

  _makeDropdownItems = () => ['admin', 'owner', 'reader', 'writer'].map(item => this._makeDropdownItem(item))

  _dropdownChanged = (node: React.Node) => {
    // $FlowIssue doesn't understand key will be string
    const selectedRole: TeamRoleType = (node && node.key) || null
    this.setState({selectedRole})
  }

  _onSubmit = () => {
    this.props.onAddPeople(this.state.selectedRole)
  }

  _openRolePicker = () => {
    this.props.onOpenRolePicker(this.state.selectedRole, (selectedRole: TeamRoleType) =>
      this.setState({selectedRole})
    )
  }

  render() {
    return (
      <MaybePopup onClose={this.props.onClose}>
        <Box style={{...globalStyles.flexBoxColumn}}>
          <Box
            style={{
              ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
              margin: globalMargins.small,
              alignItems: 'center',
            }}
          >
            <Text style={{margin: globalMargins.tiny}} type="Body">
              Add these team members to {this.props.name} as:
            </Text>
            <ClickableBox onClick={this._openRolePicker}>
              <Dropdown
                items={this._makeDropdownItems()}
                selected={this._makeDropdownItem(this.state.selectedRole)}
                onChanged={this._dropdownChanged}
              />
            </ClickableBox>
            <Button
              label="Invite"
              onClick={this._onSubmit}
              style={{margin: globalMargins.tiny}}
              type="Primary"
            />
          </Box>

          {!isMobile &&
            <Box
              style={{
                ...globalStyles.flexBoxRow,
                borderBottom: `1px solid ${globalColors.black_10}`,
                boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
              }}
            />}

          <Box style={{...globalStyles.flexBoxColumn}}>
            <UserInput
              autoFocus={true}
              onExitSearch={this.props.onClose}
              placeholder="Add people"
              searchKey={'addToTeamSearch'}
            />
          </Box>
          <Box style={{...globalStyles.scrollable, height: 500, flex: 1}}>
            {this.props.showSearchPending
              ? <ProgressIndicator style={{width: globalMargins.large}} />
              : <SearchResultsList
                  searchKey={'addToTeamSearch'}
                  disableIfInTeamName={this.props.name}
                  style={{flexGrow: 1, height: 500}}
                />}
          </Box>
        </Box>
      </MaybePopup>
    )
  }
}

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: globalColors.black_75,
  justifyContent: 'stretch',
}

const _styleContainer = {
  height: '100%',
  ...globalStyles.flexBoxColumn,
  alignSelf: 'center',
  backgroundColor: globalColors.white,
  borderRadius: 5,
  boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
  minWidth: 800,
  position: 'relative',
  top: 10,
}

export default AddPeople
