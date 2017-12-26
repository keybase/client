// @flow
import * as React from 'react'
import * as Types from '../constants/types/people'
import * as I from 'immutable'
import {Box, ClickableBox, Icon, ScrollView, Text} from '../common-adapters'
import Todo from './task'
import FollowNotification from './follow-notification'
import {type Props} from '.'
import {globalStyles, globalColors} from '../styles'
import {isMobile} from '../constants/platform'

const onConfirm = () => {}
const onDismiss = () => {}
export const itemToComponent: Types.PeopleScreenItem => React.Node = item => {
  switch (item.type) {
    case 'todo':
      return <Todo {...item} onConfirm={onConfirm} onDismiss={onDismiss} key={item.todoType} />
    case 'notification':
      return <FollowNotification {...item} key={item.notificationTime} />
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

export const PeoplePageContent = (props: Props) => (
  <Box style={{...globalStyles.fullHeight}}>
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        width: '100%',
      }}
    >
      <ClickableBox onClick={props.onSearch} style={{...styleSearchContainer}}>
        <Icon style={styleSearch} type="iconfont-search" />
        <Text style={styleSearchText} type="Body">
          Search people
        </Text>
      </ClickableBox>
    </Box>
    <ScrollView style={{...globalStyles.flexBoxColumn, width: '100%'}}>
      {intersperse(props.newItems.map(itemToComponent), true)}
      {intersperse(props.oldItems.map(itemToComponent), false)}
    </ScrollView>
  </Box>
)

const styleSearchContainer = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: globalColors.white,
  borderRadius: 100,
  ...(isMobile
    ? {borderColor: globalColors.black_05, borderWidth: 1}
    : {border: `1px solid ${globalColors.black_05}`}),
  justifyContent: 'center',
  minHeight: isMobile ? 33 : 28,
  width: 273,
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
  ...(isMobile ? {fontSize: 15} : {fontSize: 13}),
}
