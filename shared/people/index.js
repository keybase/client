// @flow
import * as React from 'react'
import * as Types from '../constants/types/people'
import * as I from 'immutable'
import {Box} from '../common-adapters'
import {globalStyles} from '../styles'
import Todo from './task'
import FollowNotification from './follow-notification'

type Props = {
  oldItems: I.List<Types.PeopleScreenItem>,
  newItems: I.List<Types.PeopleScreenItem>,
}

const itemToComponent: Types.PeopleScreenItem => React.Node = item => {
  switch (item.type) {
    case 'todo':
      return <Todo {...item} onConfirm={onConfirm} onDismiss={onDismiss} key={item.todoType} />
    case 'notification':
      return <FollowNotification {...item} key={item.notificationTime} />
  }
}

const onConfirm = () => {}
const onDismiss = () => {}
class People extends React.Component<Props> {
  render() {
    return (
      <Box style={{...globalStyles.flexBoxColumn, width: '100%'}}>
        {this.props.newItems.map(itemToComponent)}
        {this.props.oldItems.map(itemToComponent)}
      </Box>
    )
  }
}

export default People
