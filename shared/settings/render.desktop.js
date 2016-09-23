// @flow
import DeleteContainer from './delete/container'
import LandingContainer from './landing/container'
import NavSettings from './nav'
import NotificationsContainer from './notifications/container'
import React, {Component} from 'react'
import SettingsHelp from './help.desktop'

import type {SettingsItem} from './nav'
import type {Props} from './render'

const InvitationsContainer = LandingContainer // TODO add invitations

type State = {
    content: any,
    items: Array<SettingsItem>,
}

class Render extends Component<void, Props, State> {
  state: State;
  _textToContent: {[key: string]: any}

  constructor (props: Props) {
    super(props)

    this._textToContent = {
      'Your Account': <LandingContainer />,
      'Invitations': <InvitationsContainer />,
      'Notifications': <NotificationsContainer />,
      'Delete me': <DeleteContainer />,
      ...(__DEV__ ? {'Dev Menu': null} : {}),
    }

    // TODO handle badges and etc
    const items = [{
      text: 'Your Account',
      onClick: () => this._select('Your Account'),
      selected: true,
    }, {
      text: 'Invitations',
      onClick: () => this._select('Invitations'),
    }, {
      text: 'Notifications',
      onClick: () => this._select('Notifications'),
    }, {
      text: 'Delete me',
      onClick: () => this._select('Delete me'),
    },
      ...(__DEV__ ? [{
        text: 'Dev Menu',
        onClick: () => props.onDevMenu(),
      }] : []),
    ]

    this.state = {
      content: this._textToContent[items[0].text],
      items,
    }
  }

  _select (key: string) {
    const items = this.state.items.map(item => {
      return {
        ...item,
        selected: item.text === key,
      }
    })

    this.setState({
      content: this._textToContent[key],
      items,
    })
  }

  _renderComingSoon () {
    return <SettingsHelp />
  }

  render () {
    if (this.props.showComingSoon) {
      return this._renderComingSoon()
    }

    return <NavSettings
      content={this.state.content}
      items={this.state.items} />
  }
}

export default Render
