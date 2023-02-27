// used by a route
import * as React from 'react'
import type * as Container from '../../../../util/container'
import MessagePopup from '.'
import {InlineFloatingMenuContext} from '../../../../common-adapters/floating-menu'
import {useNavigation} from '@react-navigation/core'

type Props = Container.RouteProps<'chatMessagePopup'>

const MessagePopupModal = (p: Props) => {
  const conversationIDKey = p.route.params?.conversationIDKey ?? ''
  const id = p.route.params?.id ?? 0

  const navigation = useNavigation()
  const onBack = React.useCallback(() => {
    // @ts-ignore
    navigation.pop()
  }, [navigation])
  return (
    <InlineFloatingMenuContext.Provider value={true}>
      <MessagePopup
        attachTo={undefined}
        conversationIDKey={conversationIDKey}
        ordinal={id}
        onHidden={onBack}
        position="bottom left"
        visible={true}
      />
    </InlineFloatingMenuContext.Provider>
  )
}
export default MessagePopupModal
