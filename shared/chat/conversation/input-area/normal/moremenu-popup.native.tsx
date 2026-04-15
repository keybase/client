import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'

type Props = {
  onHidden: () => void
  visible: boolean
}

const MoreMenuPopup = (props: Props) => {
  const {onHidden, visible} = props
  const injectIntoInput = ConvoState.useChatUIContext(s => s.dispatch.injectIntoInput)
  const navigateAppend = ConvoState.useChatNavigateAppend()
  const onLocationShare = () => {
    navigateAppend(conversationIDKey => ({name: 'chatLocationPreview', params: {conversationIDKey}}))
  }
  // merge
  const onCoinFlip = () => injectIntoInput('/flip ')
  const onGiphy = () => injectIntoInput('/giphy ')
  const onInsertSlashCommand = () => injectIntoInput('/')
  const onSpoiler = () => injectIntoInput('!>spoiler<!')

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
      icon: 'iconfont-shh',
      onClick: onSpoiler,
      subTitle: '!>spoiler<!',
      title: 'Add a spoiler',
    },
    {
      icon: 'iconfont-ellipsis',
      onClick: onInsertSlashCommand,
      subTitle: '/...',
      title: 'Other commands',
    },
  ]
  return (
    <Kb.FloatingMenu closeOnSelect={true} items={items} mode="bottomsheet" onHidden={onHidden} visible={visible} />
  )
}

export default MoreMenuPopup
