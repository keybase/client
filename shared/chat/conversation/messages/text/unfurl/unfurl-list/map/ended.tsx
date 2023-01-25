import * as Container from '../../../../../../../util/container'
import * as Kb from '../../../../../../../common-adapters'
import * as RPCChatTypes from '../../../../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../../../../../../../styles'
import {ConvoIDContext, OrdinalContext} from '../../../../ids-context'
import {formatTimeForChat} from '../../../../../../../util/timestamp'
import {getUnfurlInfo} from '../use-redux'

const UnfurlSharingEnded = React.memo(function UnfurlSharingEnded(p: {idx: number}) {
  const {idx} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const time = Container.useSelector(state => {
    const {unfurl} = getUnfurlInfo(state, conversationIDKey, ordinal, idx)
    if (unfurl?.unfurlType !== RPCChatTypes.UnfurlType.generic) {
      return 0
    }
    return unfurl?.generic?.mapInfo?.time ?? 0
  })
  return (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.Text type="BodySemibold">Location sharing ended</Kb.Text>
      {time ? <Kb.Text type="BodyTiny">Last updated {formatTimeForChat(time)}</Kb.Text> : null}
    </Kb.Box2>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.grey,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    marginTop: Styles.globalMargins.xtiny,
  },
}))

export default UnfurlSharingEnded
