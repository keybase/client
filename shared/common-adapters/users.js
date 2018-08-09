// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as ProfileGen from '../actions/profile-gen'
import * as TrackerGen from '../actions/tracker-gen'
import * as UsersTypes from '../constants/types/users'
import {connect, type TypedState} from '../util/container'
import Text, {type TextType} from './text'
import {globalColors, isMobile, styleSheetCreate} from '../styles'

/**
 * Users - get generic information about users to use in your view. Passes in
 * various information (`Args`) to a function child. Renders arbitrary return
 * value with no added markup. If children returns an array, it must be of
 * either primitives or components with a `key` supplied.
 */

type Args = {
  color: string,
  following: boolean,
  fullName: string,
  index: number,
  last: boolean,
  onClick: () => void,
  text: React.Element<typeof Text>,
  username: string,
}

type OwnProps = {
  children: Args => React.Node,
  textType?: TextType,
  tracker?: boolean,
  usernames: string[],
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  return {following: state.config.following, usersInfo: state.users.infoMap}
}

const mapDispatchToProps = (dispatch: Dispatch, {tracker, usernames}: OwnProps) => ({
  onClick: (username: string) =>
    tracker && !isMobile
      ? dispatch(TrackerGen.createGetProfile({username}))
      : dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  children: ownProps.children,
  following: stateProps.following,
  onClick: dispatchProps.onClick,
  textType: ownProps.textType,
  usernames: ownProps.usernames,
  usersInfo: stateProps.usersInfo,
})

const styles = styleSheetCreate({
  everyoneElse: {
    color: globalColors.blue,
  },
  following: {
    color: globalColors.green2,
  },
})

type Props = {
  children: Args => React.Node,
  following: string[],
  onClick: (username: string) => void,
  textType?: TextType,
  usernames: string[],
  usersInfo: I.Map<string, UsersTypes.UserInfo>,
}
const Users = (props: Props) => {
  return (
    props.usernames.map((username, i, usernames) => {
      const following = props.following.includes(username)
      return props.children({
        color: following ? globalColors.green2 : globalColors.blue,
        following,
        fullName: props.usersInfo.get(username, {fullname: ''}).fullname,
        index: i,
        last: i === usernames.length - 1,
        onClick: () => props.onClick(username),
        text: (
          <Text
            className="hover-underline"
            type={props.textType || 'BodySemibold'}
            style={following ? styles.following : styles.everyoneElse}
            key={username}
            onClick={() => props.onClick(username)}
          >
            {username}
          </Text>
        ),
        username,
      })
    }) || null
  )
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Users)
