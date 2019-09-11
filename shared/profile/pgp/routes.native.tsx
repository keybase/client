import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect} from '../../util/container'
import Modal from '../modal'

type OwnProps = {}

const NoPGPView = (props: {onCancel: () => void}) => (
  <Modal onCancel={props.onCancel}>
    <Kb.Box2 direction="vertical" gap="small" gapEnd={true}>
      <Kb.Text center={true} type="Header">
        Add a PGP key
      </Kb.Text>
      <Kb.Text type="Body">For now, please use our desktop app to create PGP keys.</Kb.Text>
    </Kb.Box2>
  </Modal>
)

const NoPGP = connect(
  () => ({}),
  dispatch => ({onCancel: () => dispatch(RouteTreeGen.createNavigateUp())}),
  (_, d, __: OwnProps) => ({...d})
)(NoPGPView)

export const newRoutes = {
  profilePgp: {getScreen: () => NoPGP},
}
