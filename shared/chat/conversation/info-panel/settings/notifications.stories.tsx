// TODO mock store
// import React from 'react'
// import * as Sb from '../../../../stories/storybook'
// import * as Container from '../../../../util/container'
// import * as Constants from '../../../../constants/chat2'
// import Notifications from '.'

// const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
// draftState.chat2.metaMap.set('normal', {
// ...Constants.makeConversationMeta(),
// isMuted: false,
// notificationsDesktop: 'onWhenAtMentioned',
// notificationsGlobalIgnoreMentions: false,
// notificationsMobile: 'never',
// })
// draftState.chat2.metaMap.set('muted', {
// ...Constants.makeConversationMeta(),
// isMuted: true,
// notificationsDesktop: 'onWhenAtMentioned',
// notificationsGlobalIgnoreMentions: false,
// notificationsMobile: 'never',
// })
// })

const load = () => {
  // Sb.storiesOf('Chat/Conversation/InfoPanelNotifications', module)
  // .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
  // .add('Notifications', () => <Notifications conversationIDKey="normal" />)
  // .add('Notifications (muted)', () => <Notifications conversationIDKey="muted" />)
}

export default load
