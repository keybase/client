import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as Styles from '../../../../styles'
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
  const {meta, wallet, you} = Container.useSelector(state => ({
    meta: Constants.getMeta(state, conversationIDKey),
    wallet: Constants.shouldShowWalletsIcon(state, conversationIDKey),
    you: state.config.username,
  }))
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
    const otherParticipants = meta.participants.filter(u => u !== you)
    to = (otherParticipants && otherParticipants[0]) || ''
  }
  const onSendLumens = wallet ? () => onLumens(to, false) : undefined
  const onRequestLumens = wallet ? () => onLumens(to, true) : undefined
  const onCoinFlip = () => onSlashPrefill('/flip ')
  const onGiphy = () => onSlashPrefill('/giphy ')
  const onInsertSlashCommand = () => onSlashPrefill('/')

  // render
  const items = [
    ...(onSendLumens
      ? [
          {
            onClick: onSendLumens,
            title: 'Send Lumens (XLM)',
          },
        ]
      : []),
    ...(onRequestLumens
      ? [
          {
            onClick: onRequestLumens,
            title: 'Request Lumens (XLM)',
          },
        ]
      : []),
    {
      onClick: onGiphy,
      title: 'gif',
      view: (
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Text type="BodyBig" style={styles.item}>
            Share a GIF
          </Kb.Text>
          <Kb.Text type="BodySmall">/giphy</Kb.Text>
        </Kb.Box2>
      ),
    },
    {
      onClick: onCoinFlip,
      title: 'coin',
      view: (
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Text type="BodyBig" style={styles.item}>
            Flip a coin
          </Kb.Text>
          <Kb.Text type="BodySmall">/flip</Kb.Text>
        </Kb.Box2>
      ),
    },
    {
      onClick: onLocationShare,
      title: 'location',
      view: (
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Text type="BodyBig" style={styles.item}>
            Share your location
          </Kb.Text>
          <Kb.Text type="BodySmall">/location</Kb.Text>
        </Kb.Box2>
      ),
    },
    {
      onClick: onInsertSlashCommand,
      title: 'slash',
      view: (
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Text type="BodyBig" style={styles.item}>
            Other commands
          </Kb.Text>
          <Kb.Text type="BodySmall">/...</Kb.Text>
        </Kb.Box2>
      ),
    },
  ]
  return <Kb.FloatingMenu closeOnSelect={true} items={items} onHidden={onHidden} visible={visible} />
}

const styles = Styles.styleSheetCreate(() => ({
  item: {
    color: Styles.globalColors.blueDark,
  },
}))

export default MoreMenuPopup
