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
import UserInput from '../../search/user-input/container'
import SearchResultsList from '../../search/results-list/container'

import {teamRoleTypes, type TeamRoleType} from '../../constants/teams'

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
  isEmpty: boolean,
  onAddPeople: () => void,
  onClose: () => void,
  onLeave: () => void,
  onOpenRolePicker: (currentSelectedRole: TeamRoleType, selectedRoleCallback: (TeamRoleType) => void) => void,
  onRoleChange: (role: TeamRoleType) => void,
  name: string,
  role: TeamRoleType,
}

const _makeDropdownItem = (item: string) => (
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

const _makeDropdownItems = () => teamRoleTypes.map(item => _makeDropdownItem(item))

const AddPeople = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Box
        style={{
          ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
          alignItems: 'center',
          margin: globalMargins.small,
        }}
      >
        <Text style={{margin: globalMargins.tiny}} type="Body">
          Add these team members to {props.name} as:
        </Text>
        <ClickableBox
          onClick={() =>
            props.onOpenRolePicker(props.role, (selectedRole: TeamRoleType) =>
              props.onRoleChange(selectedRole)
            )}
        >
          <Dropdown
            items={_makeDropdownItems()}
            selected={_makeDropdownItem(props.role)}
            onChanged={(node: React.Node) => {
              // $FlowIssue doesn't understand key will be string
              const selectedRole: TeamRoleType = (node && node.key) || null
              props.onRoleChange(selectedRole)
            }}
          />
        </ClickableBox>
        <Button
          label="Invite"
          onClick={props.isEmpty ? undefined : props.onAddPeople}
          disabled={props.isEmpty}
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
          onExitSearch={props.onClose}
          placeholder="Add people"
          searchKey={'addToTeamSearch'}
        />
      </Box>
      <Box style={{...globalStyles.scrollable, flex: 1, height: 500}}>
        {props.showSearchPending
          ? <ProgressIndicator style={{width: globalMargins.large}} />
          : <SearchResultsList
              searchKey={'addToTeamSearch'}
              disableIfInTeamName={props.name}
              style={{flexGrow: 1, height: 500}}
            />}
      </Box>
    </Box>
  </MaybePopup>
)

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: globalColors.black_75,
  justifyContent: 'stretch',
}

const _styleContainer = {
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
