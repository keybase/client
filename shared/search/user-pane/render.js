// @flow
import ErrorComponent from '../../common-adapters/error-profile'
import Help from './help'
import Loading from './loading'
import NonUserInfo from './non-user.render'
import React, {Component} from 'react'
import UserInfo from './user.render'

import type {Props as NonUserInfoProps} from './non-user.render'
import type {Props as UserInfoPaneProps} from './user.render'

export type Props =
  | {
      mode: 'keybase',
      userInfoProps: UserInfoPaneProps,
    }
  | {
      mode: 'external',
      nonUserInfoProps: NonUserInfoProps,
    }
  | {
      mode: 'loading',
      username: string,
    }
  | {
      mode: 'error',
      error: string,
    }
  | {
      mode: 'nothingSelected',
    }

class UserPaneRender extends Component<void, Props, void> {
  render() {
    if (this.props.mode === 'keybase') {
      return <UserInfo {...this.props.userInfoProps} />
    } else if (this.props.mode === 'external') {
      return <NonUserInfo {...this.props.nonUserInfoProps} />
    } else if (this.props.mode === 'loading') {
      return <Loading username={this.props.username} />
    } else if (this.props.mode === 'error') {
      return <ErrorComponent error={this.props.error} />
    }

    return <Help />
  }
}

export default UserPaneRender
