import * as Common from '@/router-v2/common'
import * as Kb from '@/common-adapters'
import {HeaderNewChatButton} from './new-chat-button'

const buttonWidth = 132

const mobileOptions = Kb.Styles.isIOS
  ? {
      // iOS 26: hidesSharedBackground prevents the glass circle around the custom button
      unstable_headerRightItems: () => [
        {element: <HeaderNewChatButton />, hidesSharedBackground: true, type: 'custom' as const},
      ],
    }
  : {
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
  freezeOnBlur: false,
  ...(Kb.Styles.isMobile ? mobileOptions : desktopOptions),
  headerTitle: () => (
    <Kb.Text type="BodyBig" center={true}>
      Chats
    </Kb.Text>
  ),
}
