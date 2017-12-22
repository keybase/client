// @flow
import * as React from 'react'
import * as Types from '../constants/types/people'
import {Box} from '../common-adapters'
import Todo from './task'
import FollowNotification from './follow-notification'
import {type Props} from '.'
import {globalStyles} from '../styles'

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

export const PeoplePageContent = (props: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, width: '100%'}}>
    {props.newItems.map(itemToComponent)}
    {props.oldItems.map(itemToComponent)}
  </Box>
)
