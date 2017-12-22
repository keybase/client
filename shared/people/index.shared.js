// @flow
import * as React from 'react'
import * as Types from '../constants/types/people'
import * as I from 'immutable'
import {Box, ScrollView} from '../common-adapters'
import Todo from './task'
import FollowNotification from './follow-notification'
import {type Props} from '.'
import {globalStyles, globalColors} from '../styles'

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
  <ScrollView style={{...globalStyles.flexBoxColumn, ...globalStyles.fullHeight, width: '100%'}}>
    {intersperse(props.newItems.map(itemToComponent), true)}
    {intersperse(props.oldItems.map(itemToComponent), false)}
  </ScrollView>
)
