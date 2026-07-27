import * as Common from '@/router-v2/common'
import * as Kb from '@/common-adapters'
import {HeaderNewChatButton} from './new-chat-button'
import AccountSwitchHeaderAvatar from '@/router-v2/account-switch-header-avatar'

const buttonWidth = 132

const mobileOptions = isIOS
  ? {
      // Keep both sides in the route-level options. Cold-starting with a
      // conversation above this tab can otherwise leave the inherited left
      // items stale when the conversation is popped.
      unstable_headerLeftItems: () => [
        {
          element: <AccountSwitchHeaderAvatar />,
          hidesSharedBackground: true,
          type: 'custom' as const,
        },
      ],
      // iOS 26: hidesSharedBackground prevents the glass circle around the custom button
      unstable_headerRightItems: () => [
        {element: <HeaderNewChatButton />, hidesSharedBackground: true, type: 'custom' as const},
      ],
    }
  : {
      headerLeft: () => <AccountSwitchHeaderAvatar />,
      headerRight: () => <HeaderNewChatButton />,
      headerRightContainerStyle: {
        ...Common.defaultNavigationOptions.headerRightContainerStyle,
        minWidth: buttonWidth,
        paddingRight: 8,
        width: buttonWidth,
      } as Kb.Styles.StylesCrossPlatform,
    }

const desktopOptions = {
  headerLeft: () => null,
  headerLeftContainerStyle: {
    ...Common.defaultNavigationOptions.headerLeftContainerStyle,
    minWidth: buttonWidth,
    width: buttonWidth,
  } as Kb.Styles.StylesCrossPlatform,
  headerRight: () => <HeaderNewChatButton />,
  headerRightContainerStyle: {
    ...Common.defaultNavigationOptions.headerRightContainerStyle,
    minWidth: buttonWidth,
    paddingRight: 8,
    width: buttonWidth,
  } as Kb.Styles.StylesCrossPlatform,
}

export default {
  inactiveBehavior: 'none' as const,
  ...(isMobile ? mobileOptions : desktopOptions),
  headerTitle: () => (
    <Kb.Text type="BodyBig" center={true}>
      Chats
    </Kb.Text>
  ),
}
