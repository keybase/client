// @flow
import {TeamsDivider} from '.'
import {connect} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import type {StylesCrossPlatform} from '../../../../styles'
import type {RowItem} from '../../index.types'
import memoize from 'memoize-one'

type OwnProps = {
  rows: Array<RowItem>,
  showButton: boolean,
  toggle: () => void,
  style?: StylesCrossPlatform,
}

const mapStateToProps = state => ({_badges: state.chat2.badgeMap, _metaMap: state.chat2.metaMap})

const getMetaCounts = memoize((badges, metaMap) => {
  let badgeCount = 0
  let hiddenCount = 0
  metaMap.forEach(meta => {
    if (meta.teamType === 'big') {
      return
    }
    const id = meta.conversationIDKey
    if (!Constants.isValidConversationIDKey(id)) {
      return
    }

    badgeCount += badges.get(id, 0)
    hiddenCount++
  })
  return {
    badgeCount,
    hiddenCount,
  }
})

const getRowCounts = memoize((badges, rows) => {
  let badgeCount = 0
  let hiddenCount = 0

  rows.forEach(row => {
    if (row.type === 'small') {
      badgeCount -= badges.get(row.conversationIDKey, 0)
      hiddenCount -= 1
    }
  })

  return {
    badgeCount,
    hiddenCount,
  }
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  // we remove the badge count of the stuff we're showing
  let {badgeCount, hiddenCount} = getRowCounts(stateProps._badges, ownProps.rows)

  if (ownProps.showButton) {
    const fromMeta = getMetaCounts(stateProps._badges, stateProps._metaMap)
    badgeCount += fromMeta.badgeCount
    hiddenCount += fromMeta.hiddenCount
  }

  return {
    badgeCount,
    hiddenCount,
    showButton: ownProps.showButton,
    style: ownProps.style,
    toggle: ownProps.toggle,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  mergeProps
)(TeamsDivider)
