// @flow
import * as React from 'react'
import {Box, Button, Dropdown, ProgressIndicator, Text, PopupDialog} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import capitalize from 'lodash/capitalize'
import {isMobile} from '../../constants/platform'
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
  onClose: () => void,
  onLeave: () => void,
  name: string,
}

type State = {
  selectedRole: ?string,
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
    const selectedRole: string = (node && node.key) || null
    this.setState({selectedRole})
  }

  _onSubmit = () => {
    this.props.onAddPeople(this.state.selectedRole)
  }

  render() {
    return (
      <MaybePopup onClose={this.props.onClose}>
        <Box style={{...globalStyles.flexBoxColumn}}>
          <Box style={{...globalStyles.flexBoxColumn}}>
            <UserInput
              autoFocus={true}
              searchKey={'addToTeamSearch'}
              onExitSearch={this.props.onClose}
            />
          </Box>
          {this.props.tooManyUsers &&
            <Box style={{..._styleBanner, backgroundColor: globalColors.blue}}>
              <Text
                style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
                type="BodySemibold"
                backgroundMode="Announcements"
              >
                Teams are currently limited to 20 members (19 + you) but soon, Keybase will offer bigger teams as a pay feature. Email chris@keybase.io or chat with chris to learn more.
              </Text>
            </Box>}
          <Box style={{...globalStyles.scrollable, height: 500, flex: 1}}>
            {this.props.showSearchPending
              ? <ProgressIndicator style={{width: globalMargins.large}} />
              : <SearchResultsList
                  onShowTracker={this.props.onShowTrackerInSearch}
                  searchKey={'addToTeamSearch'}
                  disableIfInTeamName={this.props.name}
                  style={{flexGrow: 1, height: 500}}
                />}
          </Box>
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              borderBottom: `1px solid ${globalColors.black_10}`,
              boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
            }}
          />
          <Box
            style={{
              ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
              margin: globalMargins.medium,
              alignItems: 'center',
            }}
          >
            <Text style={{paddingRight: globalMargins.small}} type="Body">
              Add these team members to {this.props.name} as:
            </Text>
            <Dropdown
              items={this._makeDropdownItems()}
              selected={this._makeDropdownItem(this.state.selectedRole)}
              onChanged={this._dropdownChanged}
            />

          </Box>
          <Box
            style={{
              ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
              margin: globalMargins.medium,
            }}
          >
            <Button type="Primary" onClick={this._onSubmit} label="Invite" />
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

const _styleBanner = {
  ...globalStyles.flexBoxCenter,
  ...(isMobile ? {} : {cursor: 'default'}),
  minHeight: 40,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  borderTopLeftRadius: isMobile ? 0 : 4,
  borderTopRightRadius: isMobile ? 0 : 4,
}
export default AddPeople
