import * as React from 'react'
import * as Container from '../util/container'
import * as Styles from '../styles'
import * as ProfileGen from '../actions/profile-gen'
import * as Tracker2Gen from '../actions/tracker2-gen'
import * as UsersConstants from '../constants/users'
import Text, {
  TextType,
  Background,
  StylesTextCrossPlatform,
  AllowedColors,
  LineClampType,
  TextTypeBold,
} from './text'
import {backgroundModeIsNegative} from './text.shared'

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
  joinerStyle?: Styles.StylesCrossPlatform
  lineClamp?: LineClampType
  notFollowingColorOverride?: AllowedColors
  onUsernameClicked?: ((username: string) => void) | 'tracker' | 'profile'
  prefix?: string | null
  redColor?: AllowedColors
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
} & ({colorFollowing?: false; type: TextType} | {colorFollowing: boolean; type: TextTypeBold})

// Mobile handles spaces correctly so don't insert anything
const space = Styles.isMobile ? ` ` : <>&nbsp;</>

// common-adapters/profile-card.tsx already imports this, so have it assign
// this here instead of importing directly to avoid an import cycle.
let WithProfileCardPopup: React.ComponentType<any> | null
export const _setWithProfileCardPopup = (Comp: React.ComponentType<any>) => (WithProfileCardPopup = Comp)

const UsernameText = (
  props: Omit<Props, 'users' | 'onUsernameClicked'> & {
    onUsernameClicked: undefined | ((s: string) => void)
    users: Array<User>
  }
) => {
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
        const onUsernameClicked = props.onUsernameClicked
        const isNegative = backgroundModeIsNegative(props.backgroundMode || null)
        const renderText = (onLongPress?: () => void) => (
          // type is set to Body here to prevent unwanted hover behaviors
          // line height is unset to prevent some text clipping issues
          // in children with larger text styles on Android (HOTPOT-2112)
          // see also https://github.com/keybase/client/pull/22331#discussion_r374224355
          <Text className="noLineHeight" type="Body" style={{lineHeight: undefined}} key={u.username}>
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
              lineClamp={props.lineClamp}
              onClick={
                onUsernameClicked
                  ? evt => {
                      evt && evt.stopPropagation()
                      onUsernameClicked(u.username)
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

const inlineProps = Styles.isMobile ? {lineClamp: 1 as const} : {}

const _Usernames = (props: Props) => {
  const containerStyle = props.inline ? styles.inlineStyle : styles.nonInlineStyle
  const bgMode = props.backgroundMode || null
  const isNegative = backgroundModeIsNegative(bgMode)

  const dispatch = Container.useDispatch()

  const onOpenProfile = (username: string) => dispatch(ProfileGen.createShowUserProfile({username}))
  const onOpenTracker = (username: string) =>
    dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
  const you = Container.useSelector(state => state.config.username)
  const following = Container.useSelector(state => state.config.following)
  const infoMap = Container.useSelector(state => state.users.infoMap)

  const usernamesArray = typeof props.usernames === 'string' ? [props.usernames] : props.usernames
  const users = usernamesArray.reduce<Array<User>>((arr, username) => {
    const isYou = you === username
    if (!props.skipSelf || !isYou) {
      arr.push({
        broken: UsersConstants.getIsBroken(infoMap, username) || false,
        following: following.has(username),
        username,
        you: isYou,
      })
    }
    return arr
  }, [])

  const rwers = users.filter(u => !u.readOnly)
  const readers = users.filter(u => !!u.readOnly)

  let onUsernameClicked: undefined | ((s: string) => void)
  switch (props.onUsernameClicked) {
    case 'tracker':
      onUsernameClicked = onOpenTracker
      break
    case 'profile':
      onUsernameClicked = onOpenProfile
      break
    default:
      if (typeof props.onUsernameClicked === 'function') {
        onUsernameClicked = props.onUsernameClicked
      }
  }

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
      <UsernameText {...props} onUsernameClicked={onUsernameClicked} users={rwers} />
      {!!readers.length && (
        <Text
          type={props.type}
          negative={isNegative}
          style={Styles.collapseStyles([props.style, {marginRight: 1}])}
        >
          #
        </Text>
      )}
      <UsernameText {...props} onUsernameClicked={onUsernameClicked} users={readers} />
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

export {UsernameText}
export default Usernames
