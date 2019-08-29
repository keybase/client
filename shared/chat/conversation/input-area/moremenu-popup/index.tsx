import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as Styles from '../../../../styles'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  onCoinFlip: () => void
  onGiphy: () => void
  onHidden: () => void
  onInsertSlashCommand: () => void
  onRequestLumens?: () => void
  onSendLumens?: () => void
  visible: boolean
}

const MoreMenuPopup = (props: Props) => {
  const dispatch = Container.useDispatch()
  const onLocationShare = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey: props.conversationIDKey, namespace: 'chat2'},
            selected: 'chatLocationPreview',
          },
        ],
      })
    )
  }, [dispatch, props.conversationIDKey])
  const items = [
    ...(props.onSendLumens
      ? [
          {
            onClick: props.onSendLumens,
            title: 'Send Lumens (XLM)',
          },
        ]
      : []),
    ...(props.onRequestLumens
      ? [
          {
            onClick: props.onRequestLumens,
            title: 'Request Lumens (XLM)',
          },
        ]
      : []),
    {
      onClick: props.onGiphy,
      title: '',
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
      onClick: props.onCoinFlip,
      title: '',
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
      title: '',
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
      onClick: props.onInsertSlashCommand,
      title: '',
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
  return (
    <Kb.FloatingMenu closeOnSelect={true} items={items} onHidden={props.onHidden} visible={props.visible} />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  item: {
    color: Styles.globalColors.blueDark,
  },
}))

export default MoreMenuPopup
