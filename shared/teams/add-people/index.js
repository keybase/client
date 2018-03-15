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
import {globalStyles, globalMargins, globalColors, isMobile, desktopStyles} from '../../styles'
import capitalize from 'lodash/capitalize'
import UserInput from '../../search/user-input/container'
import SearchResultsList from '../../search/results-list/container'

import {teamRoleTypes} from '../../constants/teams'
import {type TeamRoleType} from '../../constants/types/teams'

const MaybePopup = isMobile
  ? (props: {onClose: () => void, children: React.Node}) => (
      <Box style={{flexGrow: 1, width: '100%'}} children={props.children} />
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
  onOpenRolePicker: () => void,
  onRoleChange: (role: TeamRoleType) => void,
  name: string,
  role: TeamRoleType,
  sendNotification: boolean,
  setSendNotification: (sendNotification: boolean) => void,
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
    <Box style={{...globalStyles.flexBoxColumn, flexGrow: 1}}>
      <Box
        style={{
          ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
          alignItems: 'center',
          margin: isMobile ? 0 : globalMargins.small,
        }}
      >
        <Text type="Body">Add these members to {props.name} as:</Text>
        <ClickableBox onClick={() => props.onOpenRolePicker()} underlayColor="rgba(0, 0, 0, 0)">
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
          label="Add"
          onClick={props.isEmpty ? undefined : props.onAddPeople}
          disabled={props.isEmpty}
          style={{margin: globalMargins.tiny}}
          type="Primary"
        />
      </Box>

      {!isMobile && (
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            borderBottom: `1px solid ${globalColors.black_10}`,
            boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
          }}
        />
      )}

      <Box style={{...globalStyles.flexBoxColumn}}>
        <UserInput
          autoFocus={true}
          onExitSearch={props.onClose}
          placeholder="Add people"
          searchKey={'addToTeamSearch'}
        />
      </Box>
      <Box style={{...desktopStyles.scrollable, flex: 1}}>
        {props.showSearchPending ? (
          <ProgressIndicator style={{width: 24}} />
        ) : (
          <SearchResultsList
            searchKey={'addToTeamSearch'}
            disableIfInTeamName={props.name}
            style={isMobile ? {position: 'absolute', top: 0, bottom: 0, right: 0, left: 0} : {height: 500}}
            keyboardDismissMode="on-drag"
          />
        )}
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
