import {BigTeamsDivider} from '.'
import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {memoize} from '../../../../util/memoize'

type OwnProps = {
  toggle: () => void
}

const getBadgeCount = memoize(
  (layout: RPCChatTypes.UIInboxLayout | null, badgeMap: Types.ConversationCountMap) => {
    if (layout && layout.bigTeams) {
      return layout.bigTeams.reduce<number>((c, t) => {
        if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
          c += badgeMap.get(t.channel.convID) || 0
        }
        return c
      }, 0)
    }
    return 0
  }
)

export default Container.connect(
  state => ({
    badgeCount: getBadgeCount(state.chat2.inboxLayout, state.chat2.badgeMap),
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    badgeCount: stateProps.badgeCount,
    toggle: ownProps.toggle,
  })
)(BigTeamsDivider)
