// @flow
import {TeamsDivider} from '.'
import {connect} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import type {StylesCrossPlatform} from '../../../../styles'
import type {RowItem} from '../../index.types'

type OwnProps = {
  rows: Array<RowItem>,
  showButton: boolean,
  toggle: () => void,
  style?: StylesCrossPlatform,
}

const mapStateToProps = state => ({_badges: state.chat2.badgeMap, _metaMap: state.chat2.metaMap})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  // we remove the badge count of the stuff we're showing
  let badgeCount = 0
  let hiddenCount = 0
  ownProps.rows.forEach(row => {
    if (row.type === 'small') {
      badgeCount -= stateProps._badges.get(row.conversationIDKey, 0)
      hiddenCount -= 1
    }
  })

  if (ownProps.showButton) {
    stateProps._metaMap.forEach(meta => {
      if (meta.teamType === 'big') {
        return
      }
      const id = meta.conversationIDKey
      if (!Constants.isValidConversationIDKey(id)) {
        return
      }

      badgeCount += stateProps._badges.get(id, 0)
      hiddenCount++
    })
  }

  return {
    badgeCount,
    hiddenCount,
    showButton: ownProps.showButton,
    style: ownProps.style,
    toggle: ownProps.toggle,
  }
}

export default connect(mapStateToProps, () => ({}), mergeProps)(TeamsDivider)
