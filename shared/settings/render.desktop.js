// @flow
import React, {Component} from 'react'
import MenuList from './menu-list'
import type {MenuListItem} from './menu-list'
import {ComingSoon} from '../common-adapters'
import type {Props} from './render'

type State = {
  menuItems: Array<MenuListItem>
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      menuItems: [
        {name: 'Account', hasChildren: true, onClick: this.props.onAccount},
        {name: 'Billing Settings', hasChildren: true, onClick: this.props.onBilling},
        {name: 'App Preferences', hasChildren: true, onClick: this.props.onPrefs},
        {name: 'Invitations', hasChildren: true, onClick: this.props.onInvites},
        {name: 'Notifications', hasChildren: true, onClick: this.props.onNotifications},
        {name: 'Delete me', hasChildren: true, onClick: this.props.onDeleteMe},
        {name: 'Log Send', hasChildren: false, onClick: this.props.onLogSend},
        {name: 'About', hasChildren: true, onClick: this.props.onAbout},
      ],
    }

    if (__DEV__) {
      this.state.menuItems.push({name: 'Dev Menu', hasChildren: true, onClick: this.props.onDev})
    }
  }

  _renderComingSoon () {
    return <ComingSoon />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    return <MenuList items={this.state.menuItems} />
  }

}

export default Render
