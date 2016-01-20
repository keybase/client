import React, {Component} from '../base-react'
import {List, ListItem} from 'material-ui'

export default class MenuList extends Component {
  render () {
    return (
      <List>
        {this.props.items.map(title => {
          return <ListItem key={title.name} onClick={title.onClick}>{title.name}</ListItem>
        })}
      </List>
    )
  }
}

MenuList.propTypes = {
  items: React.PropTypes.arrayOf(React.PropTypes.shape({
    name: React.PropTypes.string.isRequired,
    hasChildren: React.PropTypes.bool,
    onClick: React.PropTypes.func.isRequired
  }))
}
