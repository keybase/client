import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as Styles from '../../../../styles'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'

type Props = {
  conversationIDKey: Types.ConversationIDKey
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
            title: '',
            view: (
              <Kb.Box2 direction="horizontal" gap="tiny">
                <Kb.Icon type="iconfont-dollar-sign" />
                <Kb.Text type="BodyBig" style={styles.item}>
                  Send Lumens (XLM)
                </Kb.Text>
              </Kb.Box2>
            ),
          },
        ]
      : []),
    ...(props.onRequestLumens
      ? [
          {
            onClick: props.onRequestLumens,
            title: '',
            view: (
              <Kb.Box2 direction="horizontal" gap="tiny">
                <Kb.Icon type="iconfont-dollar-sign" />
                <Kb.Text type="BodyBig" style={styles.item}>
                  Request Lumens (XLM)
                </Kb.Text>
              </Kb.Box2>
            ),
          },
        ]
      : []),
    {onClick: props.onInsertSlashCommand, title: 'Insert a slash command'},
    {onClick: props.onGiphy, title: 'Giphy'},
    {onClick: onLocationShare, title: 'Share your location'},
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
