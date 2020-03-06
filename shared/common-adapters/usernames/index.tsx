import * as React from 'react'
import * as Styles from '../../styles'
import Text, {TextType, Background, StylesTextCrossPlatform, AllowedColors} from '../text'
import {backgroundModeIsNegative} from '../text.shared'

export type User = {
  username: string
  readOnly?: boolean
  broken?: boolean
  you?: boolean
  following?: boolean
}

export type Props = {
  onUsernameClicked?: (username: string) => void
  users: Array<User>
  backgroundMode?: Background
  colorBroken?: boolean
  colorFollowing?: boolean
  notFollowingColorOverride?: AllowedColors
  colorYou?: boolean | AllowedColors
  commaColor?: AllowedColors
  containerStyle?: Styles.StylesCrossPlatform
  inline?: boolean
  inlineGrammar?: boolean
  joinerStyle?: Styles.StylesCrossPlatform
  lineClamp?: number
  prefix?: string | null
  redColor?: AllowedColors
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

// Mobile handles spaces correctly so don't insert anything
const space = Styles.isMobile ? ` ` : <>&nbsp;</>

// common-adapters/profile-card.tsx already imports this, so have it assign
// this here instead of importing directly to avoid an import cycle.
let WithProfileCardPopup: React.ComponentType<any> | null
export const _setWithProfileCardPopup = (Comp: React.ComponentType<any>) => (WithProfileCardPopup = Comp)

const UsernameText = (props: Props) => {
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
              ? ({
                  color: u.following
                    ? Styles.globalColors.greenDark
                    : props.notFollowingColorOverride || Styles.globalColors.blueDark,
                } as const)
              : null),
            ...(props.colorBroken && u.broken && !u.you
              ? ({color: props.redColor || Styles.globalColors.redDark} as const)
              : null),
            ...(props.colorYou && u.you
              ? ({
                  color: typeof props.colorYou === 'string' ? props.colorYou : Styles.globalColors.black,
                } as const)
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
              <Text type={props.type} negative={isNegative} style={derivedJoinerStyle} underlineNever={true}>
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
                ,
              </Text>
            )}
            {i !== props.users.length - 1 && (
              <Text type={props.type} negative={isNegative} style={derivedJoinerStyle}>
                {space}
              </Text>
            )}
          </Text>
        )

        return props.withProfileCardPopup && WithProfileCardPopup ? (
          <WithProfileCardPopup key={u.username} username={u.username} ellipsisStyle={styles.inlineStyle}>
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

const _Usernames = (props: Props) => {
  const containerStyle = props.inline ? styles.inlineStyle : styles.nonInlineStyle
  const rwers = props.users.filter(u => !u.readOnly)
  const readers = props.users.filter(u => !!u.readOnly)
  const bgMode = props.backgroundMode || null
  const isNegative = backgroundModeIsNegative(bgMode)

  return (
    <Text
      type={props.type}
      negative={isNegative}
      style={Styles.collapseStyles([containerStyle, props.containerStyle])}
      title={props.title}
      ellipsizeMode="tail"
      lineClamp={props.lineClamp}
      {...(props.inline ? inlineProps : {})}
    >
      {!!props.prefix && (
        <Text type={props.type} negative={isNegative} style={props.style}>
          {props.prefix}
        </Text>
      )}
      <UsernameText {...props} users={rwers} />
      {!!readers.length && (
        <Text
          type={props.type}
          negative={isNegative}
          style={Styles.collapseStyles([props.style, {marginRight: 1}])}
        >
          #
        </Text>
      )}
      <UsernameText {...props} users={readers} />
      {!!props.suffix && (
        <Text
          type={props.suffixType || props.type}
          negative={isNegative}
          style={Styles.collapseStyles([props.style, {marginLeft: Styles.globalMargins.xtiny}])}
        >
          {props.suffix}
        </Text>
      )}
    </Text>
  )
}
const Usernames = React.memo(_Usernames)

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

export {UsernameText, Usernames}
