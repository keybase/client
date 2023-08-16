import * as C from '../../../../constants'
import * as Kb from '../../../../common-adapters'

type Props = {
  onHidden: () => void
  visible: boolean
}

const MoreMenuPopup = (props: Props) => {
  const {onHidden, visible} = props
  const injectIntoInput = C.useChatContext(s => s.dispatch.injectIntoInput)
  const navigateAppend = C.useChatNavigateAppend()
  const onLocationShare = () => {
    navigateAppend(conversationIDKey => ({props: {conversationIDKey}, selected: 'chatLocationPreview'}))
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
