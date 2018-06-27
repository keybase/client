// @flow
import React, {Component} from 'react'
import Text from './text'
import shallowEqual from 'shallowequal'
import {
  collapseStyles,
  platformStyles,
  styleSheetCreate,
  globalStyles,
  globalColors,
  globalMargins,
} from '../styles'
import {isMobile} from '../constants/platform'
import {compose, connect, setDisplayName} from '../util/container'
import {type TypedState} from '../constants/reducer'
import {createShowUserProfile} from '../actions/profile-gen'
import {createGetProfile} from '../actions/tracker-gen'
import type {Props, PlaintextProps} from './usernames'

function usernameText({
  type,
  users,
  style,
  commaColor,
  inline,
  redColor,
  backgroundMode,
  colorFollowing,
  colorBroken = true,
  colorYou,
  onUsernameClicked,
  underline = false,
  inlineGrammar = false,
  showAnd = false,
}: Props) {
  const andStyle = collapseStyles([style, styles.andStyle, {color: commaColor}])
  const commaStyle = collapseStyles([style, styles.commaStyle, {color: commaColor}])
  return users.map((u, i) => {
    let userStyle = {
      ...(!isMobile ? {textDecoration: 'inherit'} : null),
      ...(colorFollowing && !u.you ? {color: u.following ? globalColors.green2 : globalColors.blue} : null),
      ...(colorBroken && u.broken && !u.you ? {color: redColor || globalColors.red} : null),
      ...(inline && !isMobile ? {display: 'inline'} : null),
      ...(u.you ? globalStyles.italic : null),
      ...(colorYou && u.you
        ? {color: typeof colorYou === 'string' ? colorYou : globalColors.black_75}
        : null),
    }
    userStyle = collapseStyles([style, userStyle])

    // Make sure onClick is undefined when _onUsernameClicked is, so
    // as to not override any existing onClick handler from containers
    // on native. (See DESKTOP-3963.)
    const _onUsernameClicked = onUsernameClicked
    return (
      <Text type={type} key={u.username}>
        {i !== 0 &&
          i === users.length - 1 &&
          showAnd && (
            <Text type={type} backgroundMode={backgroundMode} style={andStyle}>
              {'and '}
            </Text>
          )}
        <Text
          type={type}
          backgroundMode={backgroundMode}
          className={underline ? 'hover-underline' : undefined}
          onClick={_onUsernameClicked ? () => _onUsernameClicked(u.username) : undefined}
          style={userStyle}
        >
          {u.username}
        </Text>
        {i !== users.length - 1 &&
        (!inlineGrammar || users.length > 2) && ( // Injecting the commas here so we never wrap and have newlines starting with a ,
            <Text type={type} backgroundMode={backgroundMode} style={commaStyle}>
              ,
            </Text>
          )}
        {inlineGrammar && ' '}
      </Text>
    )
  })
}

const inlineProps = isMobile ? {lineClamp: 1} : {}

class Usernames extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'containerStyle', 'users'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render() {
    const containerStyle = this.props.inline ? styles.inlineStyle : styles.nonInlineStyle
    const rwers = this.props.users.filter(u => !u.readOnly)
    const readers = this.props.users.filter(u => !!u.readOnly)

    return (
      <Text
        type={this.props.type}
        backgroundMode={this.props.backgroundMode}
        style={collapseStyles([containerStyle, this.props.containerStyle])}
        title={this.props.title}
        {...(this.props.inline ? inlineProps : {})}
      >
        {!!this.props.prefix && (
          <Text type={this.props.type} backgroundMode={this.props.backgroundMode} style={this.props.style}>
            {this.props.prefix}
          </Text>
        )}
        {usernameText({...this.props, users: rwers})}
        {!!readers.length && (
          <Text
            type={this.props.type}
            backgroundMode={this.props.backgroundMode}
            style={collapseStyles([this.props.style, {marginRight: 1}])}
          >
            #
          </Text>
        )}
        {usernameText({...this.props, users: readers})}
        {!!this.props.suffix && (
          <Text type={this.props.type} backgroundMode={this.props.backgroundMode} style={this.props.style}>
            {this.props.suffix}
          </Text>
        )}
      </Text>
    )
  }
}

const divider = isMobile ? ', ' : ',\u200a'

class PlaintextUsernames extends Component<PlaintextProps> {
  shouldComponentUpdate(nextProps: PlaintextProps) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['containerStyle', 'users'].includes(key)) {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render() {
    const containerStyle = styles.inlineStyle
    const rwers = this.props.users.filter(u => !u.readOnly)

    return (
      <Text
        type={this.props.type}
        backgroundMode={this.props.backgroundMode}
        style={collapseStyles([containerStyle, this.props.containerStyle])}
        title={this.props.title}
        {...inlineProps}
      >
        {rwers.map(u => u.username).join(divider)}
      </Text>
    )
  }
}

// Connected username component
// instead of username objects supply array of username strings & this will fill in the rest
const mapStateToProps = (state: TypedState) => {
  const _following = state.config.following
  const _broken = state.tracker.userTrackers
  const _you = state.config.username
  return {
    _broken,
    _following,
    _you,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onUsernameClicked: (username: string) =>
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({forceDisplay: true, ignoreCache: true, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const userData = ownProps.usernames
    .map(username => ({
      broken: stateProps._broken.trackerState === 'error',
      following: stateProps._following.has(username),
      username,
      you: stateProps._you === username,
    }))
    .filter(u => !ownProps.skipSelf || !u.you)

  const onUsernameClicked =
    ownProps.onUsernameClicked || (ownProps.clickable ? dispatchProps._onUsernameClicked : undefined)

  return {
    ...ownProps,
    users: userData,
    ...(onUsernameClicked ? {onUsernameClicked} : {}),
  }
}

const styles = styleSheetCreate({
  andStyle: platformStyles({
    common: {
      marginLeft: globalMargins.xtiny,
      marginRight: globalMargins.xtiny,
    },
    isElectron: {textDecoration: 'none'},
  }),
  commaStyle: platformStyles({
    common: {marginRight: 1},
    isElectron: {textDecoration: 'none'},
  }),
  inlineStyle: platformStyles({
    isElectron: {
      display: 'inline',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      width: '100%',
    },
  }),
  nonInlineStyle: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      flexWrap: 'wrap',
    },
    isElectron: {textDecoration: 'inherit'},
  }),
})

const ConnectedUsernames = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('Usernames')
)(Usernames)
export {usernameText, Usernames, PlaintextUsernames, ConnectedUsernames}
