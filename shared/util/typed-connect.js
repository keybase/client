// @flow
import {connect} from 'react-redux'
import {compose, setDisplayName} from 'recompose'
export default connect

// typed for real in the js.flow file
export const namedConnect = (
  mapStateToProps: any,
  mapDispatchToProps: any,
  mergeProps: any,
  displayName: string
) =>
  compose(
    connect(
      mapStateToProps,
      mapDispatchToProps,
      mergeProps
    ),
    setDisplayName(displayName)
  )
