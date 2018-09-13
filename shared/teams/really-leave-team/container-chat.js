// @flow
import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import {connect, type TypedState} from '../../util/container'
import ReallyLeaveTeam, {Spinner, type Props as RenderProps} from '.'
import LastOwnerDialog from './last-owner'
import {getCanPerform, hasCanPerform} from '../../constants/teams'
import {type Teamname} from '../../constants/types/teams'

type Props = {|
  ...$Exact<RenderProps>,
  _canLeaveTeam: boolean,
  _loadOperations: (teamname: Teamname) => void,
  _loaded: boolean,
|}

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const name = routeProps.get('teamname')
  const canPerform = getCanPerform(state, name)
  const _canLeaveTeam = canPerform.leaveTeam
  return {
    _canLeaveTeam,
    _loaded: hasCanPerform(state, name),
    name,
    title: 'Confirmation',
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  _loadOperations: teamname => dispatch(TeamsGen.createGetTeamOperations({teamname})),
  onBack: () => dispatch(navigateUp()),
  onLeave: () => {
    dispatch(TeamsGen.createLeaveTeam({teamname: routeProps.get('teamname')}))
  },
})

class Switcher extends React.PureComponent<Props> {
  componentDidMount() {
    if (!this.props._loaded) {
      this.props._loadOperations(this.props.name)
    }
  }

  render() {
    if (!this.props._loaded) {
      return <Spinner {...this.props} />
    }
    if (!this.props._canLeaveTeam) {
      return <LastOwnerDialog {...this.props} />
    }
    return <ReallyLeaveTeam {...this.props} />
  }
}

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(Switcher)
