import * as Container from '../../util/container'
import * as GitGen from '../../actions/git-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderRightActions as _HeaderRightActions} from '.'

const mapDispatchToPropsHeaderRightActions = dispatch => ({
  onAddPersonal: () => {
    dispatch(GitGen.createSetError({error: null}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: false}, selected: 'gitNewRepo'}]}))
  },
  onAddTeam: () => {
    dispatch(GitGen.createSetError({error: null}))
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: true}, selected: 'gitNewRepo'}]}))
  },
})

// @ts-ignore codemode issue
export const HeaderRightActions = Container.namedConnect<{}, _, _, _, _>(
  () => ({}),
  mapDispatchToPropsHeaderRightActions,
  (_, d) => d,
  'GitHeaderRightActions'
)(_HeaderRightActions)

export {HeaderTitle} from '.'
