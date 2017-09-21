// @flow
import type {Tab} from '../constants/tabs'
export const mergeProps = (stateProps: any, dispatchProps: any, ownProps: any) => {
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    switchTab: (tab: Tab) => {
      dispatchProps._switchTab(tab, stateProps._me)
    },
  }
}
