// @flow
import * as React from 'react'
import * as Types from '../constants/types/people'
import * as I from 'immutable'
import {Box, ClickableBox, Icon, Text} from '../common-adapters'
import Todo from './task'
import FollowNotification from './follow-notification'
import FollowSuggestions from './follow-suggestions'
import {type Props} from '.'
import {globalStyles, globalColors} from '../styles'

export const itemToComponent: (
  Types.PeopleScreenItem,
  {[key: Types.TodoType]: {onConfirm: () => void, onDismiss: () => void}}
) => React.Node = (item, actions) => {
  switch (item.type) {
    case 'todo':
      return (
        <Todo
          {...item.toObject()}
          onConfirm={actions[item.todoType].onConfirm}
          onDismiss={actions[item.todoType].onDismiss}
          key={item.todoType}
        />
      )
    case 'notification':
      return <FollowNotification {...item.toObject()} key={item.notificationTime} />
  }
}

const divider = (light: boolean, key: any) => (
  <Box
    style={{
      width: '100%',
      height: 1,
      backgroundColor: light ? globalColors.white : globalColors.black_05,
    }}
    key={key}
  />
)

const intersperse = (list: I.List<any>, light: boolean) => {
  let newList = list
  for (let i = list.size - 1; i > 0; i--) {
    newList = newList.insert(i, divider(light, i))
  }
  return newList
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
    {intersperse(props.newItems.map(item => itemToComponent(item, props.todoDispatch)), true)}
    <FollowSuggestions suggestions={props.followSuggestions} onClickUser={props.onClickUser} />
    {intersperse(props.oldItems.map(item => itemToComponent(item, props.todoDispatch)), false)}
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
