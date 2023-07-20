import * as Kb from '../../../../common-adapters'
import * as RouterConstants from '../../../../constants/router2'
import * as Container from '../../../../util/container'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import type * as Types from '../../../../constants/types/chat2'
import HiddenString from '../../../../util/hidden-string'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  onHidden: () => void
  visible: boolean
}

const MoreMenuPopup = (props: Props) => {
  const {conversationIDKey, onHidden, visible} = props
  const dispatch = Container.useDispatch()
  const onSlashPrefill = (text: string) => {
    dispatch(Chat2Gen.createSetUnsentText({conversationIDKey, text: new HiddenString(text)}))
  }
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onLocationShare = () => {
    navigateAppend({props: {conversationIDKey}, selected: 'chatLocationPreview'})
  }
  // merge
  const onCoinFlip = () => onSlashPrefill('/flip ')
  const onGiphy = () => onSlashPrefill('/giphy ')
  const onInsertSlashCommand = () => onSlashPrefill('/')

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
