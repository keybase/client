import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import EnterUsername from '.'
import {InfoIcon} from '../common'

type OwnProps = {}

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const ConnectedEnterUsername = Container.connect(mapStateToProps, mapDispatchToProps)(EnterUsername)

// @ts-ignore fix this
ConnectedEnterUsername.navigationOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2 style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}>
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default ConnectedEnterUsername
