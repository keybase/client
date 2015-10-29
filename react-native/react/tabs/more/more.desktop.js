'use strict'

import BaseComponent from '../../base-component'
import React from '../../base-react'
import { List, ListItem } from 'material-ui'

export default class MoreTabs extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return (
      <List>
        {this.props.items.map((title) => {
          return <ListItem key={title.name} onClick={title.onClick}>{title.name}</ListItem>
        })}
      </List>
    )
  }
}

MoreTabs.propTypes = {
  items: React.PropTypes.object
}
