// @flow
import * as React from 'react'
import * as Types from '../constants/types/people'
import {Box, ClickableBox, Icon, Text} from '../common-adapters'
import Todo from './task'
import FollowNotification from './follow-notification'
import FollowSuggestions from './follow-suggestions'
import {type Props} from '.'
import {globalStyles, globalColors} from '../styles'

export const itemToComponent: (
  Types._PeopleScreenItem,
  {[key: Types.TodoType]: {onConfirm: () => void, onDismiss: () => void}}
) => React.Node = (item, actions) => {
  switch (item.type) {
    case 'todo':
      return (
        <Todo
          {...item}
          onConfirm={actions[item.todoType].onConfirm}
          onDismiss={actions[item.todoType].onDismiss}
          key={item.todoType}
        />
      )
    case 'notification':
      return <FollowNotification {...item} key={item.notificationTime} />
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
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: globalColors.white_90,
      zIndex: 1,
      ...props.styleRowContainer,
    }}
  >
    <ClickableBox onClick={props.onSearch} style={{...styleSearchContainer, ...props.styleSearchContainer}}>
      <Icon style={{...styleSearch, ...props.styleSearch}} type="iconfont-search" />
      <Text style={{...styleSearchText, ...props.styleSearchText}} type="Body">
        Search people
      </Text>
    </ClickableBox>
  </Box>
)

export const PeoplePageList = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, width: '100%', position: 'relative', marginTop: 48}}>
    {props.newItems.map(item => itemToComponent(item, props.todoDispatch))}
    <FollowSuggestions suggestions={props.followSuggestions} onClickUser={props.onClickUser} />
    {props.oldItems.map(item => itemToComponent(item, props.todoDispatch))}
  </Box>
)

const styleSearchContainer = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: globalColors.white,
  borderRadius: 100,
  justifyContent: 'center',
  zIndex: 20,
}

const styleSearch = {
  color: globalColors.black_20,
  fontSize: 15,
  padding: 3,
}

const styleSearchText = {
  ...styleSearch,
  position: 'relative',
  top: -1,
}
