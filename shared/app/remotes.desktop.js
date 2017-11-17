// @flow
import * as React from 'react'
import type {Dispatch} from '../constants/types/more'
import type {TypedState} from '../constants/reducer'
import {Box} from '../common-adapters'
import {connect} from '../util/container'

// TODO move out

class PinentryWindow extends React.PureComponent<any> {
  render() {
    return this.props.id
  }
}
type Props = {
  pinentryIDs: Array<string>,
}

const Remotes = ({pinentryIDs}: Props) => (
  <Box style={{minWidth: 200, height: 200}}>
    {pinentryIDs.map(id => <PinentryWindow id={id} key={id} />)}
  </Box>
)

const mapStateToProps = (state: TypedState) => {
  return {
    pinentryIDs: Object.keys(state.pinentry.pinentryStates),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(Remotes)
