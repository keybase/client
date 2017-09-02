// @flow
import TeamsContainer from './index'
import {RouteDefNode} from '../route-tree'
import NewTeamDialog from '../chat/conversation/new-team/container'

const routeTree = new RouteDefNode({
  children: {
    showNewTeamDialog: {
      children: {},
      component: NewTeamDialog,
      tags: {layerOnTop: true},
    },
  },
  component: TeamsContainer,
  tags: {title: 'Teams'},
})

export default routeTree
