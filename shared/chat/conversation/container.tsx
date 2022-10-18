import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/chat2'
import * as Container from '../../util/container'
import {AnimatedKeyboardAvoidingView} from '../../common-adapters/keyboard-avoiding-view'
import Normal from './normal/container'
import NoConversation from './no-conversation'
import Error from './error/container'
import YouAreReset from './you-are-reset'
import Rekey from './rekey/container'
import {useFocusEffect, useNavigation} from '@react-navigation/core'
import {tabBarStyle} from '../../router-v2/common'
import {headerNavigationOptions} from './header-area/container'
import type {RouteProps} from '../../router-v2/route-params'

type SwitchProps = RouteProps<'chatConversation'>

const hideTabBarStyle = {display: 'none'}

// due to timing issues if we go between convos we can 'lose track' of focus in / out
// so instead we keep a count and only bring back the tab if we're entirely gone
let focusRefCount = 0

let showDeferId: any = 0
const deferChangeTabOptions = (tabNav, tabBarStyle, defer) => {
  if (showDeferId) {
    clearTimeout(showDeferId)
  }
  if (tabNav) {
    if (defer) {
      showDeferId = setTimeout(() => {
        tabNav.setOptions({tabBarStyle})
      }, 1)
    } else {
      tabNav.setOptions({tabBarStyle})
    }
  }
}

const Conversation = (p: SwitchProps) => {
  const navigation = useNavigation()
  let tabNav: any = navigation.getParent()
  if (tabNav?.getState()?.type !== 'tab') {
    tabNav = undefined
  }

  useFocusEffect(
    React.useCallback(() => {
      if (!Container.isPhone) {
        return
      }
      ++focusRefCount
      deferChangeTabOptions(tabNav, hideTabBarStyle, false)
      return () => {
        --focusRefCount
        if (focusRefCount === 0) {
          deferChangeTabOptions(tabNav, tabBarStyle, true)
        }
      }
    }, [tabNav])
  )

  const conversationIDKey = p.route.params?.conversationIDKey ?? Constants.noConversationIDKey
  const type = Container.useSelector(state => {
    const meta = Constants.getMeta(state, conversationIDKey)
    switch (conversationIDKey) {
      case Constants.noConversationIDKey:
        return 'noConvo'
      default:
        if (meta.membershipType === 'youAreReset') {
          return 'youAreReset'
        } else if (meta.rekeyers.size > 0) {
          return 'rekey'
        } else if (meta.trustedState === 'error') {
          return 'error'
        } else {
          return 'normal'
        }
    }
  })

  let content: React.ReactNode = null
  switch (type) {
    case 'error':
      content = <Error key={conversationIDKey} conversationIDKey={conversationIDKey} />
      break
    case 'noConvo':
      // When navigating back to the inbox on mobile, we deselect
      // conversationIDKey by called mobileChangeSelection. This results in
      // the conversation view rendering "NoConversation" as it is
      // transitioning back the the inbox.
      // On android this is very noticeable because transitions fade between
      // screens, so "NoConversation" will appear on top of the inbox for
      // approximately 150ms.
      // On iOS it is less noticeable because screen transitions slide away to
      // the right, though it is visible for a small amount of time.
      // To solve this we render a blank screen on mobile conversation views with "noConvo"
      content = Container.isPhone ? null : <NoConversation />
      break
    case 'normal':
      // the id as key is so we entirely force a top down redraw to ensure nothing is possibly from another convo
      content = <Normal key={conversationIDKey} conversationIDKey={conversationIDKey} />
      break
    case 'youAreReset':
      content = <YouAreReset />
      break
    case 'rekey':
      content = <Rekey key={conversationIDKey} conversationIDKey={conversationIDKey} />
      break
    default:
      content = <NoConversation />
      break
  }

  if (Styles.isMobile) {
    content = (
      <AnimatedKeyboardAvoidingView style={styles.keyboard}>
        <Kb.SafeAreaView style={styles.safe}>{content}</Kb.SafeAreaView>
      </AnimatedKeyboardAvoidingView>
    )
  }
  return content
}

// @ts-ignore
Conversation.navigationOptions = ({route}) => ({
  ...headerNavigationOptions(route),
  needsSafe: true,
})

const ConversationMemoed = React.memo(Conversation)
Container.hoistNonReactStatic(ConversationMemoed, Conversation)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      keyboard: {
        flexGrow: 1,
        position: 'relative',
      },
      safe: {
        backgroundColor: Styles.globalColors.fastBlank,
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
    } as const)
)

export default ConversationMemoed
