import * as React from 'react'
import * as Container from '../util/container'
import * as Styles from '../styles'
import * as ProfileGen from '../actions/profile-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import Text, {
  type TextType,
  type Background,
  type StylesTextCrossPlatform,
  type AllowedColors,
  type LineClampType,
  type TextTypeBold,
} from './text'
import {backgroundModeIsNegative} from './text.shared'
import shallowEqual from 'shallowequal'
import isArray from 'lodash/isArray'

export type User = {
  username: string
  readOnly?: boolean
  broken?: boolean
  you?: boolean
  following?: boolean
}

export type Props = {
  backgroundMode?: Background
  colorBroken?: boolean
  colorYou?: boolean | AllowedColors
  commaColor?: AllowedColors
  containerStyle?: Styles.StylesCrossPlatform
  inline?: boolean
  inlineGrammar?: boolean
  joinerStyle?: StylesTextCrossPlatform
  lineClamp?: LineClampType
  notFollowingColorOverride?: AllowedColors
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile'
  prefix?: string | null
  selectable?: boolean
  showAnd?: boolean
  skipSelf?: boolean
  style?: StylesTextCrossPlatform
  suffix?: string | null
  suffixType?: TextType
  title?: string
  underline?: boolean
  usernames: Array<string> | string
  withProfileCardPopup?: boolean
  fixOverdraw?: boolean | 'auto'
  virtualText?: boolean // desktop only see text.desktop
} & ({colorFollowing?: false; type: TextType} | {colorFollowing: boolean; type: TextTypeBold})

// Mobile handles spaces correctly so don't insert anything
const space = Styles.isMobile ? ` ` : <>&nbsp;</>

// common-adapters/profile-card.tsx already imports this, so have it assign
// this here instead of importing directly to avoid an import cycle.
let WithProfileCardPopup: React.ComponentType<any> | null
export const _setWithProfileCardPopup = (Comp: React.ComponentType<any>) => (WithProfileCardPopup = Comp)

type UsernameProps = {
  backgroundMode?: Background
  colorBroken: boolean
  colorFollowing: boolean
  colorYou?: boolean | AllowedColors
  inline?: boolean
  joinerStyle?: StylesTextCrossPlatform
  lineClamp?: LineClampType
  notFollowingColorOverride?: AllowedColors
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile'
  selectable?: boolean
  underline?: boolean
  showAnd: boolean
  showComma: boolean
  showSpace: boolean
  style?: StylesTextCrossPlatform
  type: TextType
  username: string
  virtualText?: boolean // desktop only see text.desktop
  you: string
  withProfileCardPopup: boolean
}
const Username = React.memo(function Username(p: UsernameProps) {
  const {colorFollowing, colorBroken, username, notFollowingColorOverride, colorYou} = p
  const {inline, style, lineClamp, selectable, type, backgroundMode, showAnd, underline} = p
  const {onUsernameClicked, joinerStyle, showComma, showSpace, virtualText, withProfileCardPopup} = p
  const you = p.you === username
  const following = Container.useSelector(state => colorFollowing && state.config.following.has(username))
  const broken = Container.useSelector(
    state => (colorBroken && state.users.infoMap.get(username)?.broken) ?? false
  )

  const dispatch = Container.useDispatch()

  const onOpenProfile = React.useCallback(
    (evt: any) => {
      evt?.stopPropagation()
      dispatch(ProfileGen.createShowUserProfile({username}))
    },
    [dispatch, username]
  )
  const onOpenTracker = React.useCallback(
    (evt: any) => {
      evt?.stopPropagation()
      dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    },
    [dispatch, username]
  )
  const onPassThrough = React.useCallback(() => {
    if (typeof onUsernameClicked === 'function') {
      onUsernameClicked(username)
    }
  }, [username, onUsernameClicked])
  let onClicked: undefined | ((evt?: any) => void)
  switch (onUsernameClicked) {
    case 'tracker':
      onClicked = onOpenTracker
      break
    case 'profile':
      onClicked = onOpenProfile
      break
    default:
      if (typeof onUsernameClicked === 'function') {
        onClicked = onPassThrough
      }
  }

  let userStyle = Styles.platformStyles({
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
  const isNegative = backgroundModeIsNegative(backgroundMode || null)
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
})

type UsernamesTextProps = {
  users: Array<string>
  backgroundMode?: Background
  colorBroken: boolean
  colorFollowing: boolean
  colorYou?: boolean | AllowedColors
  commaColor?: AllowedColors
  inlineGrammar?: boolean
  joinerStyle?: StylesTextCrossPlatform
  notFollowingColorOverride?: AllowedColors
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile' | undefined
  selectable?: boolean
  inline?: boolean
  type: TextType
  showAnd?: boolean
  underline: boolean
  virtualText?: boolean
  withProfileCardPopup: boolean
  you: string
}
const UsernamesText = (p: UsernamesTextProps) => {
  const {showAnd, inlineGrammar, users, joinerStyle, commaColor, ...rest} = p
  const derivedJoinerStyle = React.useMemo(() => {
    return Styles.collapseStyles([joinerStyle, styles.joinerStyle, {color: commaColor}])
  }, [commaColor, joinerStyle])

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

const Usernames = React.memo(
  function Usernames(p: Props) {
    const {backgroundMode, commaColor, inline, containerStyle} = p
    const {joinerStyle, lineClamp, notFollowingColorOverride, onUsernameClicked, prefix, selectable} = p
    const {showAnd, inlineGrammar, colorYou, skipSelf, style, suffix, suffixType, title} = p
    const {usernames, fixOverdraw, virtualText, type} = p
    const colorFollowing = p.colorFollowing ?? true
    const colorBroken = p.colorBroken ?? true
    const underline = p.underline ?? true
    const withProfileCardPopup = p.withProfileCardPopup ?? true
    const you = Container.useSelector(state => state.config.username)

    const canFixOverdraw = React.useContext(Styles.CanFixOverdrawContext)
    const containerStyle2: Styles.StylesCrossPlatform = inline
      ? (styles.inlineStyle as any)
      : (styles.nonInlineStyle as any)
    const bgMode = backgroundMode || null
    const isNegative = backgroundModeIsNegative(bgMode)

    const names = React.useMemo(() => {
      const n = typeof usernames === 'string' ? [usernames] : usernames
      return n.reduce<Array<string>>((arr, n) => {
        if (n !== you || !skipSelf) {
          arr.push(n)
        }
        return arr
      }, [])
    }, [usernames, skipSelf, you])

    return (
      <Text
        type={type}
        negative={isNegative}
        fixOverdraw={fixOverdraw === 'auto' ? canFixOverdraw : fixOverdraw ?? false}
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
  },
  (p, n) => {
    return shallowEqual(p, n, (v, o) => {
      if (isArray(v) && isArray(o)) {
        return shallowEqual(v, o)
      }
      return undefined
    })
  }
)

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
      const {e164ToDisplay} = require('../util/phone-numbers')
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
  } as const),
  joinerStyle: Styles.platformStyles({isElectron: {textDecoration: 'none'}} as const),
  kerning: {letterSpacing: 0.2},
  noLineHeight: {lineHeight: undefined},
  nonInlineStyle: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      flexWrap: 'wrap',
    },
    isElectron: {textDecoration: 'inherit'},
  } as const),
}))

export default Usernames
