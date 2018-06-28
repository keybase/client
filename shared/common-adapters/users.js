// @flow
import * as React from 'react'
import * as ProfileGen from '../actions/profile-gen'
import * as TrackerGen from '../actions/tracker-gen'
import {connect, type TypedState} from '../util/container'
import Text, {type TextType} from './text'
import {globalColors, isMobile, styleSheetCreate} from '../styles'

type Args = {
  index: number,
  username: string,
  following: boolean,
  color: string,
  text: React.Element<typeof Text>,
  last: boolean,
}

type OwnProps = {
  children: Args => React.Node,
  textType?: TextType,
  tracker?: boolean,
  usernames: string[],
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  return (
    ownProps.usernames.reduce(
      (res, username) => {
        const following = state.config.following.includes(username)
        res && res.usernames.push(username)
        res && res.followings.push(following)
        res && res.colors.push(following ? globalColors.green : globalColors.blue)
        res &&
          res.texts.push(
            <Text
              type={ownProps.textType || 'BodySemibold'}
              style={following ? styles.following : styles.everyoneElse}
            >
              {username}
            </Text>
          )
        return res
      },
      {
        usernames: [],
        followings: [],
        colors: [],
        texts: [],
      }
    ) || {
      usernames: ownProps.usernames,
      followings: [],
      colors: [],
      texts: [],
    }
  )
}

const mapDispatchToProps = (dispatch: Dispatch, {tracker, usernames}: OwnProps) => ({
  onClick: (i: number) =>
    tracker && !isMobile
      ? dispatch(TrackerGen.createGetProfile({username: usernames[i]}))
      : dispatch(ProfileGen.createShowUserProfile({username: usernames[i]})),
})

const styles = styleSheetCreate({
  following: {
    color: globalColors.green2,
  },
  everyoneElse: {
    color: globalColors.blue,
  },
})

type Props = {
  children: Args => React.Node,
  onClick: (i: number) => void,
  usernames: string[],
  followings: boolean[],
  colors: string[],
  texts: React.Element<typeof Text>[],
}
const Users = (props: Props) => {
  return (
    props.usernames.map((username, i, usernames) =>
      props.children({
        index: i,
        username,
        following: props.followings[i],
        color: props.colors[i],
        text: props.texts[i],
        last: i === usernames.length - 1,
      })
    ) || null
  )
}

export default connect(mapStateToProps, mapDispatchToProps)(Users)
