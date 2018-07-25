// @flow
import * as React from 'react'
import {
  Box,
  Button,
  HeaderHocHeader,
  ProgressIndicator,
  Text,
  PopupDialog,
} from '../../common-adapters'
import {
  collapseStyles,
  globalStyles,
  globalMargins,
  globalColors,
  isMobile,
  desktopStyles,
} from '../../styles'
import UserInput from '../../search/user-input/container'
import SearchResultsList from '../../search/results-list/container'
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
  errorText: string,
  numberOfUsersSelected: number,
  loading: boolean,
  onAddPeople: () => void,
  onClearSearch: () => void,
  onClose: () => void,
  onLeave: () => void,
  onOpenRolePicker: () => void,
  onRoleChange: (role: TeamRoleType) => void,
  name: string,
  role: TeamRoleType,
  showSearchPending: boolean,
  sendNotification: boolean,
  setSendNotification: (sendNotification: boolean) => void,
  title: string,
}

const AddPeople = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Box style={{...globalStyles.flexBoxColumn, flexGrow: 1}}>
      <HeaderHocHeader hideBackLabel={true} onBack={props.onClose} title={props.title} />
      {!!props.errorText && (
        <Box style={collapseStyles([globalStyles.flexBoxColumn, {backgroundColor: globalColors.red}])}>
          {props.errorText.split('\n').map(line => (
            <Box key={line} style={globalStyles.flexBoxRow}>
              <Text
                style={{margin: globalMargins.tiny, textAlign: 'center', width: '100%'}}
                type="BodySemibold"
                backgroundMode="HighRisk"
              >
                {line}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      <Box style={globalStyles.flexBoxColumn}>
        <UserInput
          autoFocus={true}
          hideAddButton={true}
          onExitSearch={props.onClearSearch}
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
            style={isMobile ? {position: 'absolute', top: 0, bottom: 0, right: 0, left: 0} : {height: 400}}
            keyboardDismissMode="on-drag"
          />
        )}
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, padding: globalMargins.medium}}>
        <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
          <Button disabled={!props.numberOfUsersSelected} onClick={props.onOpenRolePicker} label={props.numberOfUsersSelected > 0 ? `Add (${props.numberOfUsersSelected})` : 'Add'} type="Primary" />
        </Box>
      </Box>
    </Box>
  </MaybePopup>
)

const _styleCover = {
  backgroundColor: globalColors.black_75,
}

const _styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignSelf: 'center',
  backgroundColor: globalColors.white,
  borderRadius: 5,
  boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
  maxHeight: 620,
  minWidth: 800,
}

export default AddPeople
