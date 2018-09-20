// @flow
import {TeamsDivider} from '.'
import {connect} from '../../../../util/container'
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
  const {badgeCount, hiddenCount} = ownProps.showButton
    ? stateProps._metaMap.reduce(
        (acc, meta) => {
          if (meta.teamType !== 'big') {
            const id = meta.conversationIDKey
            if (!ownProps.rows.find(r => r.conversationIDKey === id)) {
              const count = stateProps._badges.get(id, 0)
              acc.badgeCount += count
              acc.hiddenCount++
            }
          }
          return acc
        },
        {badgeCount: 0, hiddenCount: 0}
      )
    : {badgeCount: 0, hiddenCount: 0}

  return {
    badgeCount,
    hiddenCount: hiddenCount - 1, // dont count ourselves
    showButton: ownProps.showButton,
    style: ownProps.style,
    toggle: ownProps.toggle,
  }
}

export default connect(mapStateToProps, () => ({}), mergeProps)(TeamsDivider)
