import * as React from 'react'
import LongPressable from './long-pressable'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/chat2'

type Props = {
  ordinal: Types.Ordinal
  conversationIDKey: Types.ConversationIDKey
  measure?: () => void
  previous?: Types.Ordinal
  children: React.ReactNode
}

// const containerStyle = (showCenteredHighlight: boolean, showUsername: boolean) => {
//   if (showCenteredHighlight) {
//     if (!showUsername) {
//       return styles.longPressableHighlightNoUsername
//     } else {
//       return styles.longPressableHighlight
//     }
//   } else if (!showUsername) {
//     return styles.longPressableNoUsername
//   }
//   return styles.longPressable
// }

// An avatar or not
export const LeftSide = React.memo(function LeftSide() {
  return <div>left</div>
})

// Exploding/tombstone/... menu
export const RightSide = React.memo(function RightSide() {
  return <div>right</div>
})

// Author/timestamp/orange line
export const TopSide = React.memo(function TopSide() {
  return <div>top</div>
})

// Edited/reactions
export const BottomSide = React.memo(function BottomSide() {
  return <div>bottom</div>
})

// Provides swiping and top level controls
export const MessageContainer = React.memo(function Wrapper2(p: Props) {
  // const {children, conversationIDKey, ordinal, previous} = p
  const {children} = p

  // const type = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal)?.type)
  // const ptype = Container.useSelector(state =>
  //   previous ? Constants.getMessage(state, conversationIDKey, previous)?.type : undefined
  // )

  // const decorate = Container.useSelector(state => {
  //   const m = Constants.getMessage(state, conversationIDKey, ordinal)
  //   if (!m) return false
  //   const goodType = m.type === 'text' || m.type === 'attachment'
  //   return goodType && !m.exploded && !m.errorReason
  // })

  // const showUsername = useGetUsername()

  // if (Styles.isMobile) {
  // TODO
  // return null
  // return (
  //   <LongPressable
  //     onLongPress={decorate ? toggleShowingPopup : undefined}
  //     onPress={decorate ? dismissKeyboard : undefined}
  //     onSwipeLeft={decorate && canSwipeLeft ? onSwipeLeft : undefined}
  //     style={containerStyle(showCenteredHighlight, showUsername)}
  //   >
  //     {children}
  //   </LongPressable>
  // )
  // }
  return (
    <LongPressable
    // className={Styles.classNames(
    //   {
    //     'WrapperMessage-author': showUsername,
    //     'WrapperMessage-centered': showCenteredHighlight,
    //     'WrapperMessage-decorated': decorate,
    //     'WrapperMessage-hoverColor': !isPendingPayment,
    //     'WrapperMessage-noOverflow': isPendingPayment,
    //     'WrapperMessage-systemMessage': message.type.startsWith('system'),
    //     active: showingPopup || showingPicker,
    //   },
    //   'WrapperMessage-hoverBox'
    // )}
    // onContextMenu={toggleShowingPopup}
    // onMouseOver={onMouseOver}
    // attach popups to the message itself
    // ref={popupAnchor as any}
    >
      {children}
    </LongPressable>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      // longPressable: {overflow: 'hidden'},
      // longPressableHighlight: {
      //   backgroundColor: Styles.globalColors.yellowOrYellowAlt,
      //   overflow: 'hidden',
      // },
      // longPressableHighlightNoUsername: {
      //   backgroundColor: Styles.globalColors.yellowOrYellowAlt,
      //   overflow: 'hidden',
      //   paddingBottom: 3,
      //   paddingLeft:
      //     // Space for below the avatar
      //     Styles.globalMargins.tiny + // right margin
      //     Styles.globalMargins.tiny + // left margin
      //     Styles.globalMargins.mediumLarge, // avatar
      //   paddingRight: Styles.globalMargins.tiny,
      //   paddingTop: 3,
      // },
      // longPressableNoUsername: {
      //   overflow: 'hidden',
      //   paddingBottom: 3,
      //   paddingLeft:
      //     // Space for below the avatar
      //     Styles.globalMargins.tiny + // right margin
      //     Styles.globalMargins.tiny + // left margin
      //     Styles.globalMargins.mediumLarge, // avatar
      //   paddingRight: Styles.globalMargins.tiny,
      //   paddingTop: 3,
      // },
    } as const)
)
