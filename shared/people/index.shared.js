// @flow
import * as React from 'react'
import * as Types from '../constants/types/people'
import {Box, ClickableBox, Icon, Text} from '../common-adapters'
import Todo from './task/container'
import FollowNotification from './follow-notification'
import FollowSuggestions from './follow-suggestions'
import {type Props} from '.'
import {globalStyles, globalColors, globalMargins, desktopStyles} from '../styles'

export const itemToComponent: (Types._PeopleScreenItem, Props) => React.Node = (item, props) => {
  switch (item.type) {
    case 'todo':
      return <Todo {...item} key={item.todoType} />
    case 'notification':
      return <FollowNotification {...item} key={item.notificationTime} onClickUser={props.onClickUser} />
  }
}

export const PeoplePageSearchBar = (
  props: Props & {
    styleRowContainer?: any,
    styleSearchContainer?: any,
    styleSearch?: any,
    styleSearchText?: any,
  }
) => (
  <Box style={{...styleRowContainer, ...props.styleRowContainer}}>
    <ClickableBox onClick={props.onSearch} style={{...styleSearchContainer, ...props.styleSearchContainer}}>
      <Icon style={{...styleSearch, ...props.styleSearch}} type="iconfont-search" />
      <Text style={{...styleSearchText, ...props.styleSearchText}} type="Body">
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
    <FollowSuggestions suggestions={props.followSuggestions} onClickUser={props.onClickUser} />
    {props.oldItems.map(item => itemToComponent(item, props))}
  </Box>
)

const styleSearchContainer = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: globalColors.black_05,
  borderRadius: 100,
  justifyContent: 'center',
  zIndex: 20,
}

const styleSearch = {
  color: globalColors.black_20,
  padding: globalMargins.xtiny,
}

const styleSearchText = {
  ...styleSearch,
  color: globalColors.black_40,
  position: 'relative',
  top: -1,
}
