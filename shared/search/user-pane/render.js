// @flow
import React, {Component} from 'react'
import UserInfo from './user.render'
import NonUserInfo from './non-user.render'
import Help from './help'
import Loading from './loading'
import type {Props as UserInfoPaneProps} from './user.render'
import type {Props as NonUserInfoProps} from './non-user.render'

export type Props = {
  mode: 'keybase',
  userInfoProps: UserInfoPaneProps,
} | {
  mode: 'external',
  nonUserInfoProps: NonUserInfoProps,
} | {
  mode: 'loading',
  username: string,
} | {
  mode: 'nothingSelected'
}

class Render extends Component<void, Props, void> {
  render () {
    if (this.props.mode === 'keybase') {
      return <UserInfo {...this.props.userInfoProps} />
    } else if (this.props.mode === 'external') {
      return <NonUserInfo {...this.props.nonUserInfoProps} />
    } else if (this.props.mode === 'loading') {
      return <Loading username={this.props.username} />
    }

    return (
      <Help />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Search'},
    }
  }
}

export default Render
