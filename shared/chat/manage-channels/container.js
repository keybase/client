// @flow
import {connect} from 'react-redux'
import ManageChannels from '.'
import {navigateTo} from '../../actions/route-tree'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => ({
  channels: [
    {
      description: 'desc',
      name: 'name',
      selected: 'false',
    },
  ],
  teamname: 'cnojima7',
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath}) => ({
  onClose: () => dispatch(navigateUp()),
  onCreate: () => dispatch(navigateTo(['createChannel'], routePath.butLast())),
  onToggle: (channel: string) => console.log('aaaa ontoggle', channel),
})

export default connect(mapStateToProps, mapDispatchToProps)(ManageChannels)
