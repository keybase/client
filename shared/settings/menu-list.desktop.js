// @flow
import React, {Component} from 'react'
import {List, ListItem} from 'material-ui'
import {Box} from '../common-adapters'
import {globalStyles} from '../styles'

export default class MenuList extends Component {
  render() {
    return (
      <Box style={{...globalStyles.scrollable}}>
        <List>
          {this.props.items.map(title => {
            return <ListItem key={title.name} onClick={title.onClick}>{title.name}</ListItem>
          })}
        </List>
      </Box>
    )
  }
}
