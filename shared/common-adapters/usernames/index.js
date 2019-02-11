// @flow
import * as React from 'react'
import Text from '../text'
import shallowEqual from 'shallowequal'
import * as Styles from '../../styles'
import type {TextType, Background} from '../text'

export type UserListItem = {
  username: string,
  readOnly?: boolean,
  broken?: boolean,
  you?: boolean,
  following?: boolean,
}

export type UserList = Array<UserListItem>

export type BaseUsernamesProps = {|
  backgroundMode?: Background,
  colorBroken?: boolean,
  colorFollowing?: boolean,
  notFollowingColorOverride?: string,
  colorYou?: boolean | string,
  commaColor?: string,
  containerStyle?: Styles.StylesCrossPlatform,
  inline?: boolean,
  inlineGrammar?: boolean,
  joinerStyle?: Styles.StylesCrossPlatform,
  onUsernameClicked?: (username: string) => void,
  prefix?: ?string,
  redColor?: string,
  showAnd?: boolean,
  style?: Styles.StylesCrossPlatform,
  suffix?: ?string,
  title?: string,
  type: TextType,
  underline?: boolean,
|}

export type Props = {|...BaseUsernamesProps, users: UserList|}

export type PlaintextProps = {
  type: TextType,
  users: UserList,
  backgroundMode?: Background,
  containerStyle?: Styles.StylesCrossPlatform,
  title?: string,
}

function UsernameText(props: Props) {
  const derivedJoinerStyle = Styles.collapseStyles([
    props.joinerStyle,
    styles.joinerStyle,
    {color: props.commaColor},
  ])
  return (
    <>
      {props.users.map((u, i) => {
        let userStyle = {
          ...(props.colorFollowing && !u.you
            ? {
                color: u.following
                  ? Styles.globalColors.green
                  : props.notFollowingColorOverride || Styles.globalColors.blue,
              }
            : null),
          ...(props.colorBroken && u.broken && !u.you
            ? {color: props.redColor || Styles.globalColors.red}
            : null),
          ...(props.inline && !Styles.isMobile ? {display: 'inline'} : null),
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
            {i !== 0 && i === props.users.length - 1 && props.showAnd && (
              <Text type={props.type} backgroundMode={props.backgroundMode} style={derivedJoinerStyle}>
                {'and '}
              </Text>
            )}
            <Text
              type={props.type}
              backgroundMode={props.backgroundMode}
              className={Styles.classNames({'hover-underline': props.underline})}
              onClick={_onUsernameClicked ? () => _onUsernameClicked(u.username) : undefined}
              style={userStyle}
            >
              {u.username}
            </Text>
            {/* Injecting the commas here so we never wrap and have newlines starting with a , */}
            {i !== props.users.length - 1 && (!props.inlineGrammar || props.users.length > 2) && (
              <Text type={props.type} backgroundMode={props.backgroundMode} style={derivedJoinerStyle}>
                ,
              </Text>
            )}
            {i !== props.users.length - 1 && ' '}
          </Text>
        )
      })}
    </>
  )
}
UsernameText.defaultProps = {
  colorBroken: true,
  inlineGrammar: false,
  showAnd: false,
  underline: true,
}

const inlineProps = Styles.isMobile ? {lineClamp: 1} : {}

class Usernames extends React.Component<Props> {
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

class PlaintextUsernames extends React.Component<PlaintextProps> {
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

const styles = Styles.styleSheetCreate({
  inlineStyle: Styles.platformStyles({
    isElectron: {
      display: 'inline',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  joinerStyle: Styles.platformStyles({
    isElectron: {
      textDecoration: 'none',
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

export {UsernameText, Usernames, PlaintextUsernames}
