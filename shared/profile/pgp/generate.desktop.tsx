import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {namedConnect} from '../../util/container'
import Modal from '../modal'

type OwnProps = {}

const Generate = props => (
  <Modal onCancel={props.onCancel}>
    <Kb.Box2 direction="vertical" gap="small" alignItems="center">
      <Kb.PlatformIcon platform="pgp" overlay="icon-proof-unfinished" />
      <Kb.Text type="Header">Generating your unique key...</Kb.Text>
      <Kb.Text type="Body">
        Math time! You are about to discover a 4096-bit key pair.
        <br />
        This could take as long as a couple of minutes.
      </Kb.Text>
      <Kb.Icon type="icon-loader-infinity-64" />
    </Kb.Box2>
  </Modal>
)

const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(ProfileGen.createCancelPgpGen())
    dispatch(RouteTreeGen.createClearModals())
  },
})

export default namedConnect(
  () => ({}),
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'Generate'
)(Generate)
