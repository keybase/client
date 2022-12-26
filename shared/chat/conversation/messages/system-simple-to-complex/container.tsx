import * as React from 'react'
import type * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as TeamsGen from '../../../../actions/teams-gen'
import SystemSimpleToComplex from '.'
import * as Container from '../../../../util/container'

type OwnProps = {message: Types.MessageSystemSimpleToComplex}

const SystemSimpleToComplexContainer = React.memo(function SystemSimpleToComplexContainer(p: OwnProps) {
  const {message} = p
  const {conversationIDKey} = message
  const {teamID} = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const you = Container.useSelector(state => state.config.username)
  const dispatch = Container.useDispatch()
  const onManageChannels = React.useCallback(() => {
    dispatch(TeamsGen.createManageChatChannels({teamID}))
  }, [dispatch, teamID])
  const onViewTeam = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'team'}]}))
  }, [dispatch, teamID])
  const props = {
    message,
    onManageChannels,
    onViewTeam,
    you,
  }
  return <SystemSimpleToComplex {...props} />
})
export default SystemSimpleToComplexContainer
