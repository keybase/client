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
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Box style={{...globalStyles.flexBoxColumn}}>
        <UserInput
          autoFocus={true}
          searchKey={'addToTeamSearch'}
          onExitSearch={props.onExitSearch}
        />
      </Box>
      <Box style={{...globalStyles.scrollable, height: 500, flex: 1}}>
        {props.showSearchPending
          ? <ProgressIndicator style={{width: globalMargins.large}} />
          : <SearchResultsList
              onShowTracker={props.onShowTrackerInSearch}
              searchKey={'addToTeamSearch'}
              style={{flexGrow: 1, height: 500}}
            />}
      </Box>
      <Box style={{...globalStyles.flexBoxRow, borderBottom: `1px solid ${globalColors.black_10}`, boxShadow: `0 2px 5px 0 ${globalColors.black_20}`}} />
      <Box
        style={{
          ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
          margin: globalMargins.medium,
        }}
      >
        <Text type="Body">Add these team members as:</Text>
      </Box>
      <Box
        style={{
          ...(isMobile ? globalStyles.flexBoxColumn : globalStyles.flexBoxRow),
          margin: globalMargins.medium,
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
