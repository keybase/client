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
  lineClamp?: number
  prefix?: string | null
  redColor?: string
  selectable?: boolean
  showAnd?: boolean
  style?: StylesTextCrossPlatform
  suffix?: string | null
  suffixType?: TextType
  title?: string
  type: TextType
  underline?: boolean
  withProfileCardPopup?: boolean
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

// Mobile handles spaces correctly so don't insert anything
const space = Styles.isMobile ? `` : <>&nbsp;</>

// common-adapters/profile-card.tsx already imports this, so have it assign
// this here instead of importing directly to avoid an import cycle.
let WithProfileCardPopup: React.ComponentType<any> | null
export const _setWithProfileCardPopup = (Comp: React.ComponentType<any>) => (WithProfileCardPopup = Comp)

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
          userStyle,
          props.style,
          props.type.startsWith('Body') && styles.kerning,
        ])

        // Make sure onClick is undefined when _onUsernameClicked is, so
        // as to not override any existing onClick handler from containers
        // on native. (See DESKTOP-3963.)
        const _onUsernameClicked = props.onUsernameClicked
        const isNegative = backgroundModeIsNegative(props.backgroundMode || null)
        const renderText = (onLongPress?: () => void) => (
          <Text type={props.type} key={u.username}>
            {i !== 0 && i === props.users.length - 1 && props.showAnd && (
              <Text type={props.type} negative={isNegative} style={derivedJoinerStyle}>
                {space}
                {'and '}
              </Text>
            )}
            <Text
              type={props.type}
              negative={isNegative}
              className={Styles.classNames({'hover-underline': props.underline})}
              selectable={props.selectable}
              onLongPress={onLongPress}
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
              {assertionToDisplay(u.username)}
            </Text>
            {/* Injecting the commas here so we never wrap and have newlines starting with a , */}
            {i !== props.users.length - 1 && (!props.inlineGrammar || props.users.length > 2) && (
              <Text type={props.type} negative={isNegative} style={derivedJoinerStyle}>
                ,{props.users.length > 2 && i !== props.users.length - 2 ? space : null}
              </Text>
            )}
            {i !== props.users.length - 1 && ' '}
          </Text>
        )
        return props.withProfileCardPopup && WithProfileCardPopup ? (
          <WithProfileCardPopup key={u.username} username={u.username}>
            {renderText}
          </WithProfileCardPopup>
        ) : (
          renderText()
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
  withProfileCardPopup: true,
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
    const bgMode = this.props.backgroundMode || null
    const isNegative = backgroundModeIsNegative(bgMode)

    return (
      <Text
        type={this.props.type}
        negative={isNegative}
        style={Styles.collapseStyles([containerStyle, this.props.containerStyle])}
        title={this.props.title}
        ellipsizeMode="tail"
        lineClamp={this.props.lineClamp}
        {...(this.props.inline ? inlineProps : {})}
      >
        {!!this.props.prefix && (
          <Text type={this.props.type} negative={isNegative} style={this.props.style}>
            {this.props.prefix}
          </Text>
        )}
        <UsernameText {...this.props} users={rwers} />
        {!!readers.length && (
          <Text
            type={this.props.type}
            negative={isNegative}
            style={Styles.collapseStyles([this.props.style, {marginRight: 1}])}
          >
            #
          </Text>
        )}
        <UsernameText {...this.props} users={readers} />
        {!!this.props.suffix && (
          <Text
            type={this.props.suffixType || this.props.type}
            negative={isNegative}
            style={Styles.collapseStyles([this.props.style, {marginLeft: Styles.globalMargins.xtiny}])}
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
        negative={backgroundModeIsNegative(this.props.backgroundMode || null)}
        style={Styles.collapseStyles([containerStyle, this.props.containerStyle, styles.kerning])}
        title={this.props.title}
        {...inlineProps}
      >
        {rwers.map(u => assertionToDisplay(u.username)).join(divider)}
      </Text>
    )
  }
}

// 15550123456@phone => +1 (555) 012-3456
// [test@example.com]@email => test@example.com
export const assertionToDisplay = (assertion: string): string => {
  if (assertion.includes('@email') || assertion.includes('@phone')) {
    const noSuffix = assertion.substring(0, assertion.length - 6)
    if (assertion.includes('@email')) {
      return noSuffix.substring(1, noSuffix.length - 1)
    }
    // phone number
    try {
      const {e164ToDisplay} = require('../../util/phone-numbers')
      return e164ToDisplay('+' + noSuffix)
    } catch (e) {
      return '+' + noSuffix
    }
  }
  return assertion
}

const styles = Styles.styleSheetCreate(() => ({
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
}))

export {UsernameText, Usernames, PlaintextUsernames}
