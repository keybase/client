import * as React from 'react'
import Text, {TextType, Background, StylesTextCrossPlatform} from '../text'
import shallowEqual from 'shallowequal'
import * as Styles from '../../styles'
import {backgroundModeIsNegative} from '../text.shared'

export type UserListItem = {
  username: string
  readOnly?: boolean
  broken?: boolean
  you?: boolean
  following?: boolean
}

export type UserList = Array<UserListItem>

export type BaseUsernamesProps = {
  backgroundMode?: Background
  colorBroken?: boolean
  colorFollowing?: boolean
  notFollowingColorOverride?: string
  colorYou?: boolean | string
  commaColor?: string
  containerStyle?: Styles.StylesCrossPlatform
  inline?: boolean
  inlineGrammar?: boolean
  joinerStyle?: Styles.StylesCrossPlatform
  prefix?: string | null
  redColor?: string
  selectable?: boolean
  showAnd?: boolean
  style?: StylesTextCrossPlatform
  suffix?: string | null
  title?: string
  type: TextType
  underline?: boolean
}

export type Props = {
  onUsernameClicked?: (username: string) => void
  users: UserList
} & BaseUsernamesProps

export type PlaintextProps = {
  type: TextType
  users: UserList
  backgroundMode?: Background
  containerStyle?: Styles.StylesCrossPlatform
  title?: string
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
        let userStyle = Styles.platformStyles({
          common: {
            ...(props.colorFollowing && !u.you
              ? {
                  color: u.following
                    ? Styles.globalColors.greenDark
                    : props.notFollowingColorOverride || Styles.globalColors.blueDark,
                }
              : null),
            ...(props.colorBroken && u.broken && !u.you
              ? {color: props.redColor || Styles.globalColors.redDark}
              : null),
            ...(props.colorYou && u.you
              ? {color: typeof props.colorYou === 'string' ? props.colorYou : Styles.globalColors.black}
              : null),
          },
          isElectron: props.inline ? {display: 'inline'} : {},
        })
        userStyle = Styles.collapseStyles([
          props.style,
          userStyle,
          props.type.startsWith('Body') && styles.kerning,
        ])

        // Make sure onClick is undefined when _onUsernameClicked is, so
        // as to not override any existing onClick handler from containers
        // on native. (See DESKTOP-3963.)
        const _onUsernameClicked = props.onUsernameClicked
        return (
          <Text type={props.type} key={u.username}>
            {i !== 0 && i === props.users.length - 1 && props.showAnd && (
              <Text
                type={props.type}
                negative={backgroundModeIsNegative(props.backgroundMode)}
                style={derivedJoinerStyle}
              >
                {'and '}
              </Text>
            )}
            <Text
              type={props.type}
              negative={backgroundModeIsNegative(props.backgroundMode)}
              className={Styles.classNames({'hover-underline': props.underline})}
              selectable={props.selectable}
              onClick={
                _onUsernameClicked
                  ? evt => {
                      evt && evt.stopPropagation()
                      _onUsernameClicked(u.username)
                    }
                  : undefined
              }
              style={userStyle}
            >
              {u.username}
            </Text>
            {/* Injecting the commas here so we never wrap and have newlines starting with a , */}
            {i !== props.users.length - 1 && (!props.inlineGrammar || props.users.length > 2) && (
              <Text
                type={props.type}
                negative={backgroundModeIsNegative(props.backgroundMode)}
                style={derivedJoinerStyle}
              >
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
  selectable: undefined,
  showAnd: false,
  underline: true,
}

const inlineProps = Styles.isMobile ? {lineClamp: 1} : {}

class Usernames extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (['style', 'containerStyle', 'users'].includes(key as string)) {
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
        negative={backgroundModeIsNegative(this.props.backgroundMode)}
        style={Styles.collapseStyles([containerStyle, this.props.containerStyle])}
        title={this.props.title}
        ellipsizeMode="tail"
        {...(this.props.inline ? inlineProps : {})}
      >
        {!!this.props.prefix && (
          <Text
            type={this.props.type}
            negative={backgroundModeIsNegative(this.props.backgroundMode)}
            style={this.props.style}
          >
            {this.props.prefix}
          </Text>
        )}
        <UsernameText {...this.props} users={rwers} />
        {!!readers.length && (
          <Text
            type={this.props.type}
            negative={backgroundModeIsNegative(this.props.backgroundMode)}
            style={Styles.collapseStyles([this.props.style, {marginRight: 1}])}
          >
            #
          </Text>
        )}
        <UsernameText {...this.props} users={readers} />
        {!!this.props.suffix && (
          <Text
            type={this.props.type}
            negative={backgroundModeIsNegative(this.props.backgroundMode)}
            style={this.props.style}
          >
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
      if (['containerStyle', 'users'].includes(key as string)) {
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
        negative={backgroundModeIsNegative(this.props.backgroundMode)}
        style={Styles.collapseStyles([containerStyle, this.props.containerStyle, styles.kerning])}
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
  kerning: {
    letterSpacing: 0.2,
  },
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
