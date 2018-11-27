// @flow
import * as React from 'react'
import * as Types from '../constants/types/people'
import {Box, ClickableBox, Icon, Text} from '../common-adapters'
import Todo from './todo/container'
import FollowNotification from './follow-notification'
import FollowSuggestions from './follow-suggestions'
import {type Props} from '.'
import {
  borderRadius,
  globalStyles,
  globalColors,
  globalMargins,
  desktopStyles,
  collapseStyles,
} from '../styles'

export const itemToComponent: (Types.PeopleScreenItem, Props) => React.Node = (item, props) => {
  switch (item.type) {
    case 'todo':
      return (
        <Todo
          badged={item.badged}
          todoType={item.todoType}
          instructions={item.instructions}
          confirmLabel={item.confirmLabel}
          dismissable={item.dismissable}
          icon={item.icon}
          key={item.todoType}
        />
      )
    case 'notification':
      return (
        <FollowNotification
          type={item.type}
          newFollows={item.newFollows}
          notificationTime={item.notificationTime}
          badged={item.badged}
          numAdditional={item.numAdditional}
          key={item.notificationTime}
          onClickUser={props.onClickUser}
        />
      )
  }
  return null
}

export const PeoplePageSearchBar = (
  props: Props & {
    styleRowContainer?: any,
    styleSearchContainer?: any,
    styleSearch?: any,
    styleSearchText?: any,
  }
) => (
  <Box style={collapseStyles([styleRowContainer, props.styleRowContainer])}>
    <ClickableBox
      onClick={props.onSearch}
      style={collapseStyles([styleSearchContainer, props.styleSearchContainer])}
    >
      <Icon
        style={collapseStyles([styleSearch, props.styleSearch])}
        type="iconfont-search"
        color={globalColors.black_20}
      />
      <Text style={collapseStyles([styleSearchText, props.styleSearchText])} type="Body">
        Search people
      </Text>
    </ClickableBox>
  </Box>
)

const styleRowContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  height: 48,
  position: 'absolute',
  top: 0,
  right: 0,
  backgroundColor: globalColors.white_90,
  zIndex: 1,
}

export const PeoplePageList = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, width: '100%', position: 'relative', marginTop: 48}}>
    {props.newItems.map(item => itemToComponent(item, props))}
    <FollowSuggestions suggestions={props.followSuggestions} />
    {props.oldItems.map(item => itemToComponent(item, props))}
  </Box>
)

const styleSearchContainer = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: globalColors.black_10,
  borderRadius,
  justifyContent: 'center',
  zIndex: 20,
}

const styleSearch = {
  padding: globalMargins.xtiny,
}

const styleSearchText = {
  ...styleSearch,
  color: globalColors.black_40,
  position: 'relative',
  top: -1,
}
