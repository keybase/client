import * as Kb from '../../../../common-adapters'
import * as RouterConstants from '../../../../constants/router2'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  onHidden: () => void
  visible: boolean
}

const MoreMenuPopup = (props: Props) => {
  const {conversationIDKey, onHidden, visible} = props
  const injectIntoInput = Constants.useContext(s => s.dispatch.injectIntoInput)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onLocationShare = () => {
    navigateAppend({props: {conversationIDKey}, selected: 'chatLocationPreview'})
  }
  // merge
  const onCoinFlip = () => injectIntoInput('/flip ')
  const onGiphy = () => injectIntoInput('/giphy ')
  const onInsertSlashCommand = () => injectIntoInput('/')

  // render
  const items: Kb.MenuItems = [
    {
      icon: 'iconfont-gif',
      onClick: onGiphy,
      subTitle: '/giphy',
      title: 'Share a GIF',
    },
    {
      icon: 'iconfont-coin-flip',
      onClick: onCoinFlip,
      subTitle: '/flip',
      title: 'Flip a coin',
    },
    {
      icon: 'iconfont-location',
      onClick: onLocationShare,
      subTitle: '/location',
      title: 'Share your location',
    },
    {
      icon: 'iconfont-ellipsis',
      onClick: onInsertSlashCommand,
      subTitle: '/...',
      title: 'Other commands',
    },
  ]
  return <Kb.FloatingMenu closeOnSelect={true} items={items} onHidden={onHidden} visible={visible} />
}

export default MoreMenuPopup
