// @flow
import * as React from 'react'
import * as ProfileGen from '../actions/profile-gen'
import * as TrackerGen from '../actions/tracker-gen'
import {connect, type TypedState} from '../util/container'
import Text, {type TextType} from './text'
import {globalColors, isMobile, styleSheetCreate} from '../styles'

type Args = {
  color: string,
  following: boolean,
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
  return {_following: state.config.following}
}

const mapDispatchToProps = (dispatch: Dispatch, {tracker, usernames}: OwnProps) => ({
  onClick: (username: string) =>
    tracker && !isMobile
      ? dispatch(TrackerGen.createGetProfile({username}))
      : dispatch(ProfileGen.createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  children: ownProps.children,
  colors: ownProps.usernames.map(
    u => (stateProps._following.has(u) ? globalColors.green2 : globalColors.blue)
  ),
  followings: ownProps.usernames.map(u => stateProps._following.has(u)),
  onClick: dispatchProps.onClick,
  texts: ownProps.usernames.map(username => (
    <Text
      type={ownProps.textType || 'BodySemibold'}
      style={stateProps._following.has(username) ? styles.following : styles.everyoneElse}
      key={username}
      onClick={() => dispatchProps.onClick(username)}
    >
      {username}
    </Text>
  )),
  usernames: ownProps.usernames,
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
  colors: string[],
  followings: boolean[],
  onClick: (username: string) => void,
  texts: React.Element<typeof Text>[],
  usernames: string[],
}
const Users = (props: Props) => {
  return (
    props.usernames.map((username, i, usernames) =>
      props.children({
        color: props.colors[i],
        following: props.followings[i],
        index: i,
        last: i === usernames.length - 1,
        onClick: () => props.onClick(username),
        text: props.texts[i],
        username,
      })
    ) || null
  )
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Users)
