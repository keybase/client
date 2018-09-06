// @flow
import React, {Component} from 'react'
import Text from '../text'
import shallowEqual from 'shallowequal'
import * as Styles from '../../styles'
import {compose, connect, setDisplayName} from '../../util/container'
import {type TypedState} from '../../constants/reducer'
import * as ProfileGen from '../../actions/profile-gen'
import * as TrackerGen from '../../actions/tracker-gen'
import type {Props, PlaintextProps} from '../usernames'

function UsernameText(props: Props) {
  const derivedJoinerStyle = Styles.collapseStyles([
    props.joinerStyle,
    styles.joinerStyle,
    {color: props.commaColor},
  ])
  return props.users.map((u, i) => {
    let userStyle = {
      ...(!Styles.isMobile ? {textDecoration: 'inherit'} : null),
      ...(props.colorFollowing && !u.you
        ? {color: u.following ? Styles.globalColors.green2 : Styles.globalColors.blue}
        : null),
      ...(props.colorBroken && u.broken && !u.you
        ? {color: props.redColor || Styles.globalColors.red}
        : null),
      ...(props.inline && !Styles.isMobile ? {display: 'inline'} : null),
      ...(u.you ? Styles.globalStyles.italic : null),
      ...(props.colorYou && u.you
        ? {color: typeof props.colorYou === 'string' ? props.colorYou : Styles.globalColors.black_75}
        : null),
    }
    userStyle = Styles.collapseStyles([props.style, userStyle])

    // Make sure onClick is undefined when _onUsernameClicked is, so
    // as to not override any existing onClick handler from containers
    // on native. (See DESKTOP-3963.)
    const _onUsernameClicked = props.onUsernameClicked
    return (
      <Text type={props.type} key={u.username}>
        {i !== 0 &&
          i === props.users.length - 1 &&
          props.showAnd && (
            <Text type={props.type} backgroundMode={props.backgroundMode} style={derivedJoinerStyle}>
              {'and '}
            </Text>
          )}
        <Text
          type={props.type}
          backgroundMode={props.backgroundMode}
          className={props.underline ? 'hover-underline' : undefined}
          onClick={_onUsernameClicked ? () => _onUsernameClicked(u.username) : undefined}
          style={userStyle}
        >
          {u.username}
        </Text>
        {i !== props.users.length - 1 &&
          (!props.inlineGrammar || props.users.length > 2) && (
            <Text
              type={
                props.type // Injecting the commas here so we never wrap and have newlines starting with a ,
              }
              backgroundMode={props.backgroundMode}
              style={derivedJoinerStyle}
            >
              ,
            </Text>
          )}
        {i !== props.users.length - 1 && ' '}
      </Text>
    )
  })
}
UsernameText.defaultProps = {
  colorBroken: true,
  inlineGrammar: false,
  showAnd: false,
  underline: false,
}

const inlineProps = Styles.isMobile ? {lineClamp: 1} : {}

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
        style={Styles.collapseStyles([containerStyle, this.props.containerStyle])}
        title={this.props.title}
        {...(this.props.inline ? inlineProps : {})}
      >
        {!!this.props.prefix && (
          <Text type={this.props.type} backgroundMode={this.props.backgroundMode} style={this.props.style}>
            {this.props.prefix}
          </Text>
        )}
        <UsernameText {...this.props} users={rwers} />
        {!!readers.length && (
          <Text
            type={this.props.type}
            backgroundMode={this.props.backgroundMode}
            style={Styles.collapseStyles([this.props.style, {marginRight: 1}])}
          >
            #
          </Text>
        )}
        <UsernameText {...this.props} users={readers} />
        {!!this.props.suffix && (
          <Text type={this.props.type} backgroundMode={this.props.backgroundMode} style={this.props.style}>
            {this.props.suffix}
          </Text>
        )}
      </Text>
    )
  }
}

const divider = Styles.isMobile ? ', ' : ',\u200a'

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
        style={Styles.collapseStyles([containerStyle, this.props.containerStyle])}
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

const mapDispatchToProps = dispatch => ({
  onOpenProfile: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
  onOpenTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
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

  let onUsernameClicked
  if (ownProps.onUsernameClicked === 'tracker') {
    onUsernameClicked = dispatchProps.onOpenTracker
  } else if (ownProps.onUsernameClicked === 'profile') {
    onUsernameClicked = dispatchProps.onOpenProfile
  } else {
    onUsernameClicked = ownProps.onUsernameClicked
  }

  return {
    ...ownProps,
    users: userData,
    onUsernameClicked,
  }
}

const styles = Styles.styleSheetCreate({
  joinerStyle: Styles.platformStyles({
    isElectron: {
      textDecoration: 'none',
    },
  }),
  inlineStyle: Styles.platformStyles({
    isElectron: {
      display: 'inline',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  nonInlineStyle: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      flexWrap: 'wrap',
    },
    isElectron: {
      textDecoration: 'inherit',
    },
  }),
})

const ConnectedUsernames = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('Usernames')
)(Usernames)
export {UsernameText, Usernames, PlaintextUsernames, ConnectedUsernames}
