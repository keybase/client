// @flow
export const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    switchTab: (tab: Tab) => {
      dispatchProps._switchTab(tab, stateProps._me)
    },
  }
}
