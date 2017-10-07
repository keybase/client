// @flow
import * as React from 'react'
import {Box, Button, ProgressIndicator, Text, PopupDialog} from '../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../styles'
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

const AddPeople = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, padding: globalMargins.large}}>
      <UserInput
        autoFocus={true}
        searchKey={'addToTeamSearch'}
        placeholder="Search Keybase"
        onExitSearch={props.onExitSearch}
      />
      {props.showSearchPending
        ? <ProgressIndicator style={{width: globalMargins.large}} />
        : <SearchResultsList
            onShowTracker={props.onShowTrackerInSearch}
            searchKey={'addToTeamSearch'}
            style={{flex: 1}}
          />}
      <Box
        style={{
          ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
          flex: 1,
        }}
      >
        <Button type="Primary" onClick={props.onInvite} label="Invite" />
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
  height: '100%',
}
export default AddPeople
