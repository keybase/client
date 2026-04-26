import type * as React from 'react'
import * as Styles from '@/styles'
import Text from './text'
import {backgroundModeIsNegative} from './text.shared'
import type {TextType, Background, StylesTextCrossPlatform, AllowedColors, LineClampType, TextTypeBold} from './text.shared'
import type {e164ToDisplay as e164ToDisplayType} from '@/util/phone-numbers'
import {useUsersState} from '@/stores/users'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'

export type User = {
  username: string
  readOnly?: boolean | undefined
  broken?: boolean | undefined
  you?: boolean | undefined
  following?: boolean | undefined
}

export type Props = {
  className?: string | undefined
  backgroundMode?: Background | undefined
  colorBroken?: boolean | undefined
  colorYou?: boolean | AllowedColors | undefined
  commaColor?: AllowedColors | undefined
  containerStyle?: Styles.StylesCrossPlatform | undefined
  inline?: boolean | undefined
  inlineGrammar?: boolean | undefined
  joinerStyle?: StylesTextCrossPlatform | undefined
  lineClamp?: LineClampType | undefined
  notFollowingColorOverride?: AllowedColors | undefined
  onUsernameClicked?: ((username: string) => void) | 'profile' | undefined
  prefix?: string | undefined
  selectable?: boolean | undefined
  showAnd?: boolean | undefined
  skipSelf?: boolean | undefined
  style?: StylesTextCrossPlatform | undefined
  suffix?: string | undefined
  suffixType?: TextType | undefined
  title?: string | undefined
  underline?: boolean | undefined
  usernames: ReadonlyArray<string> | string
  withProfileCardPopup?: boolean | undefined
  virtualText?: boolean | undefined // desktop only see text.desktop
} & ({colorFollowing?: false; type: TextType} | {colorFollowing: boolean; type: TextTypeBold})

// Mobile handles spaces correctly so don't insert anything
const space = Styles.isMobile ? ` ` : <>&nbsp;</>

// common-adapters/profile-card.tsx already imports this, so have it assign
// this here instead of importing directly to avoid an import cycle.
type WithProfileCardPopupProps = {
  username: string
  children: (onLongPress?: () => void) => React.ReactElement<typeof Text>
  ellipsisStyle?: Styles.StylesCrossPlatform | undefined
}
let WithProfileCardPopup: React.ComponentType<WithProfileCardPopupProps> | null
export const _setWithProfileCardPopup = (Comp: React.ComponentType<WithProfileCardPopupProps>) =>
  (WithProfileCardPopup = Comp)

type UsernameProps = {
  backgroundMode?: Background | undefined
  colorBroken: boolean
  colorFollowing: boolean
  colorYou?: boolean | AllowedColors | undefined
  inline?: boolean | undefined
  joinerStyle?: StylesTextCrossPlatform | undefined
  lineClamp?: LineClampType | undefined
  notFollowingColorOverride?: AllowedColors | undefined
  onUsernameClicked?: ((username: string) => void) | 'profile' | undefined
  selectable?: boolean | undefined
  underline?: boolean | undefined
  showAnd: boolean
  showComma: boolean
  showSpace: boolean
  style?: StylesTextCrossPlatform | undefined
  type: TextType
  username: string
  virtualText?: boolean | undefined // desktop only see text.desktop
  you: string
  withProfileCardPopup: boolean
}
function Username(p: UsernameProps) {
  const {colorFollowing, colorBroken, username, notFollowingColorOverride, colorYou} = p
  const {inline, style, lineClamp, selectable, type, backgroundMode, showAnd, underline} = p
  const {onUsernameClicked, joinerStyle, showComma, showSpace, virtualText, withProfileCardPopup} = p
  const you = p.you === username

  const following = useFollowerState(s => colorFollowing && s.following.has(username))
  const broken = useUsersState(s => (colorBroken && s.infoMap.get(username)?.broken) ?? false)

  let onClicked: undefined | ((evt?: React.BaseSyntheticEvent) => void)
  if (onUsernameClicked === 'profile') {
    onClicked = (evt?: React.BaseSyntheticEvent) => {
      evt?.stopPropagation()
      navToProfile(username)
    }
  } else if (typeof onUsernameClicked === 'function') {
    onClicked = () => onUsernameClicked(username)
  }

  let userStyle: Styles.StylesCrossPlatform = Styles.platformStyles({
    common: {
      ...(colorFollowing && !you
        ? ({
            color: following
              ? Styles.globalColors.greenDark
              : notFollowingColorOverride || Styles.globalColors.blueDark,
          } as const)
        : null),
      ...(colorBroken && broken && !you ? ({color: Styles.globalColors.redDark} as const) : null),
      ...(colorYou && you
        ? ({
            color: typeof colorYou === 'string' ? colorYou : Styles.globalColors.black,
          } as const)
        : null),
    },
    isElectron: inline ? {display: 'inline'} : {},
  })
  userStyle = Styles.collapseStyles([userStyle, style, type.startsWith('Body') && styles.kerning] as const)

  // Make sure onClick is undefined when _onUsernameClicked is, so
  // as to not override any existing onClick handler from containers
  // on native. (See DESKTOP-3963.)
  const isNegative = backgroundModeIsNegative(backgroundMode)
  const renderText = (onLongPress?: () => void) => (
    // type is set to Body here to prevent unwanted hover behaviors
    // line height is unset to prevent some text clipping issues
    // in children with larger text styles on Android (HOTPOT-2112)
    // see also https://github.com/keybase/client/pull/22331#discussion_r374224355
    <Text className="noLineHeight" type="Body" style={styles.noLineHeight} key={username}>
      {showAnd && (
        <Text type={type} negative={isNegative} style={joinerStyle} underlineNever={true}>
          {'and '}
        </Text>
      )}
      <Text
        type={type}
        negative={isNegative}
        className={Styles.classNames({'hover-underline': underline})}
        selectable={selectable}
        onLongPress={onLongPress}
        lineClamp={lineClamp}
        virtualText={virtualText}
        onClick={onClicked}
        style={userStyle}
      >
        {assertionToDisplay(username)}
      </Text>
      {/* Injecting the commas here so we never wrap and have newlines starting with a , */}
      {showComma && (
        <Text type={type} negative={isNegative} style={joinerStyle}>
          ,
        </Text>
      )}
      {showSpace && (
        <Text type={type} negative={isNegative} style={joinerStyle}>
          {space}
        </Text>
      )}
    </Text>
  )

  return withProfileCardPopup && WithProfileCardPopup ? (
    <WithProfileCardPopup key={username} username={username} ellipsisStyle={styles.inlineStyle}>
      {renderText}
    </WithProfileCardPopup>
  ) : (
    renderText()
  )
}

type UsernamesTextProps = {
  users: Array<string>
  backgroundMode?: Background | undefined
  colorBroken: boolean
  colorFollowing: boolean
  colorYou?: boolean | AllowedColors | undefined
  commaColor?: AllowedColors | undefined
  inlineGrammar?: boolean | undefined
  joinerStyle?: StylesTextCrossPlatform | undefined
  notFollowingColorOverride?: AllowedColors | undefined
  onUsernameClicked?: ((username: string) => void) | 'profile' | undefined
  selectable?: boolean | undefined
  inline?: boolean | undefined
  type: TextType
  showAnd?: boolean | undefined
  underline: boolean
  virtualText?: boolean | undefined
  withProfileCardPopup: boolean
  you: string
}
const UsernamesText = (p: UsernamesTextProps) => {
  const {showAnd, inlineGrammar, users, joinerStyle, commaColor, ...rest} = p
  const derivedJoinerStyle = Styles.collapseStyles([
    joinerStyle,
    styles.joinerStyle,
    {color: commaColor},
  ]) as StylesTextCrossPlatform

  const lastIdx = users.length - 1
  return (
    <>
      {users.map((u, i) => {
        const sa = !!showAnd && i !== 0 && i === lastIdx
        const showComma = i !== lastIdx && (!inlineGrammar || users.length > 2)
        const showSpace = i !== lastIdx
        return (
          <Username
            key={u}
            {...rest}
            username={u}
            showAnd={sa}
            showComma={showComma}
            showSpace={showSpace}
            joinerStyle={derivedJoinerStyle}
          />
        )
      })}
    </>
  )
}

const inlineProps = Styles.isMobile ? {lineClamp: 1 as const} : {}

function Usernames(p: Props) {
  const {backgroundMode, commaColor, inline, containerStyle, className} = p
  const {joinerStyle, lineClamp, notFollowingColorOverride, onUsernameClicked, prefix, selectable} = p
  const {showAnd, inlineGrammar, colorYou, skipSelf, style, suffix, suffixType, title} = p
  const {usernames, virtualText, type} = p
  const colorFollowing = p.colorFollowing ?? true
  const colorBroken = p.colorBroken ?? true
  const underline = p.underline ?? true
  const withProfileCardPopup = p.withProfileCardPopup ?? true
  const you = useCurrentUserState(s => s.username)

  const containerStyle2: Styles.StylesCrossPlatform = inline ? styles.inlineStyle : styles.nonInlineStyle
  const bgMode = backgroundMode
  const isNegative = backgroundModeIsNegative(bgMode)

  const n = typeof usernames === 'string' ? [usernames] : usernames
  const names = n.reduce<Array<string>>((arr, n) => {
    if (n !== you || !skipSelf) {
      arr.push(n)
    }
    return arr
  }, [])

  return (
    <Text
      className={className}
      type={type}
      negative={isNegative}
      style={Styles.collapseStyles([containerStyle2, containerStyle])}
      title={title}
      ellipsizeMode="tail"
      lineClamp={lineClamp}
      {...(inline ? inlineProps : {})}
    >
      {!!prefix && (
        <Text type={type} negative={isNegative} style={style}>
          {prefix}
        </Text>
      )}
      <UsernamesText
        backgroundMode={backgroundMode}
        colorBroken={colorBroken}
        colorFollowing={colorFollowing}
        colorYou={colorYou}
        commaColor={commaColor}
        inlineGrammar={inlineGrammar}
        joinerStyle={joinerStyle}
        notFollowingColorOverride={notFollowingColorOverride}
        onUsernameClicked={onUsernameClicked}
        selectable={selectable}
        showAnd={showAnd}
        underline={underline}
        type={type}
        virtualText={virtualText}
        withProfileCardPopup={withProfileCardPopup}
        you={you}
        users={names}
      />
      {!!suffix && (
        <Text
          type={suffixType || type}
          negative={isNegative}
          style={Styles.collapseStyles([style, {marginLeft: Styles.globalMargins.xtiny}])}
        >
          {suffix}
        </Text>
      )}
    </Text>
  )
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
      const {e164ToDisplay} = require('@/util/phone-numbers') as {e164ToDisplay: typeof e164ToDisplayType}
      return e164ToDisplay('+' + noSuffix)
    } catch {
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
  joinerStyle: Styles.platformStyles({isElectron: {textDecoration: 'none'}}),
  kerning: {letterSpacing: 0.2},
  noLineHeight: {lineHeight: undefined},
  nonInlineStyle: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      flexWrap: 'wrap',
    },
    isElectron: {textDecoration: 'inherit'},
  }),
}))

export default Usernames
