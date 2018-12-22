// @flow
import * as React from 'react'
import {makeRouteDefNode} from '../../route-tree'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect} from '../../util/container'

type OwnProps = {||}

const NoPGPView = props => (
  <Kb.StandardScreen style={styleContainer} onCancel={props.onCancel}>
    <Kb.Text style={styleTitle} type="Header">
      Add a PGP key
    </Kb.Text>
    <Kb.Text type="Body">For now, please use our desktop app to create PGP keys.</Kb.Text>
  </Kb.StandardScreen>
)

const NoPGP = connect<OwnProps, _, _, _, _>(
  () => ({}),
  dispatch => ({onCancel: () => dispatch(navigateUp())}),
  (s, d, o) => ({...o, ...s, ...d})
)(NoPGPView)

const routeTree = makeRouteDefNode({
  component: NoPGP,
})

const styleContainer = {
  justifyContent: 'flex-start',
}

const styleTitle = {
  marginBottom: Styles.globalMargins.xlarge,
  textAlign: 'center',
}

export default routeTree
