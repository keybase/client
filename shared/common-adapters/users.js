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
  return {following: state.config.following}
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
  following: string[],
  onClick: (username: string) => void,
  textType?: TextType,
  usernames: string[],
}
const Users = (props: Props) => {
  return (
    props.usernames.map((username, i, usernames) => {
      const following = props.following.includes(username)
      return props.children({
        color: following ? globalColors.green2 : globalColors.blue,
        following,
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
