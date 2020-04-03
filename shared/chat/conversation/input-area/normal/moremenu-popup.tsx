import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as WalletsGen from '../../../../actions/wallets-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import HiddenString from '../../../../util/hidden-string'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  onHidden: () => void
  visible: boolean
}

const MoreMenuPopup = (props: Props) => {
  const {conversationIDKey, onHidden, visible} = props
  // state
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )
  const wallet = Container.useSelector(state => Constants.shouldShowWalletsIcon(state, conversationIDKey))
  const you = Container.useSelector(state => state.config.username)
  // dispatch
  const dispatch = Container.useDispatch()
  const onLumens = (to: string, isRequest: boolean) => {
    dispatch(
      WalletsGen.createOpenSendRequestForm({
        isRequest,
        recipientType: 'keybaseUser',
        to,
      })
    )
  }
  const onSlashPrefill = (text: string) => {
    dispatch(
      Chat2Gen.createSetUnsentText({
        conversationIDKey,
        text: new HiddenString(text),
      })
    )
  }
  const onLocationShare = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey, namespace: 'chat2'},
            selected: 'chatLocationPreview',
          },
        ],
      })
    )
  }
  // merge
  let to = ''
  if (wallet) {
    const otherParticipants = participantInfo.all.filter(u => u !== you)
    to = (otherParticipants && otherParticipants[0]) || ''
  }
  const onSendLumens = wallet ? () => onLumens(to, false) : undefined
  const onRequestLumens = wallet ? () => onLumens(to, true) : undefined
  const onCoinFlip = () => onSlashPrefill('/flip ')
  const onGiphy = () => onSlashPrefill('/giphy ')
  const onInsertSlashCommand = () => onSlashPrefill('/')

  // render
  const items: Kb.MenuItems = [
    ...(onSendLumens
      ? [
          {
            icon: 'iconfont-stellar-send',
            onClick: onSendLumens,
            title: 'Send Lumens (XLM)',
          },
        ]
      : []),
    ...(onRequestLumens
      ? [
          {
            icon: 'iconfont-stellar-request',
            onClick: onRequestLumens,
            title: 'Request Lumens (XLM)',
          },
        ]
      : []),
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
  ].reduce<Kb.MenuItems>((arr, i) => {
    i && arr.push(i as Kb.MenuItem)
    return arr
  }, [])
  return <Kb.FloatingMenu closeOnSelect={true} items={items} onHidden={onHidden} visible={visible} />
}

export default MoreMenuPopup
