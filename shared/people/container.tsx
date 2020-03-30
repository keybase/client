import * as React from 'react'
import * as Constants from '../constants/people'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as PeopleGen from '../actions/people-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Types from '../constants/types/people'
import * as WaitingConstants from '../constants/waiting'
import {createShowUserProfile} from '../actions/profile-gen'
import People, {Header} from '.'

type OwnProps = {}

const ConnectedHeader = Container.connect(
  state => ({
    myUsername: state.config.username,
  }),
  dispatch => ({
    onClickUser: (username: string) => dispatch(createShowUserProfile({username})),
    onOpenAccountSwitcher: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['accountSwitcher']})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    myUsername: stateProps.myUsername,
    ...dispatchProps,
  })
)(Header)

type Props = {
  oldItems: Array<Types.PeopleScreenItem>
  newItems: Array<Types.PeopleScreenItem>
  wotUpdates: Map<string, Types.WotUpdate>
  followSuggestions: Array<Types.FollowSuggestion>
  getData: (markViewed?: boolean) => void
  onClickUser: (username: string) => void
  signupEmail: string
  myUsername: string
  waiting: boolean
}

export class LoadOnMount extends React.PureComponent<Props> {
  static navigationOptions = {
    header: undefined,
    headerTitle: () => <ConnectedHeader />,
    headerTitleContainerStyle: {
      left: 40,
      right: 0,
    },
    underNotch: true,
  }
  _onReload = () => this.props.getData(false)
  _getData = (markViewed?: boolean) => this.props.getData(markViewed)
  _onClickUser = (username: string) => this.props.onClickUser(username)
  render() {
    return (
      <Kb.Reloadable
        onReload={this._onReload}
        reloadOnMount={true}
        waitingKeys={Constants.getPeopleDataWaitingKey}
      >
        <People
          followSuggestions={this.props.followSuggestions}
          getData={this._getData}
          myUsername={this.props.myUsername}
          newItems={this.props.newItems}
          oldItems={this.props.oldItems}
          onClickUser={this._onClickUser}
          signupEmail={this.props.signupEmail}
          waiting={this.props.waiting}
          wotUpdates={this.props.wotUpdates}
        />
      </Kb.Reloadable>
    )
  }
}

export default Container.connect(
  state => ({
    followSuggestions: state.people.followSuggestions,
    myUsername: state.config.username,
    newItems: state.people.newItems,
    oldItems: state.people.oldItems,
    signupEmail: state.signup.justSignedUpEmail,
    waiting: WaitingConstants.anyWaiting(state, Constants.getPeopleDataWaitingKey),
    wotUpdates: state.people.wotUpdates,
  }),
  dispatch => ({
    getData: (markViewed = true) =>
      dispatch(PeopleGen.createGetPeopleData({markViewed, numFollowSuggestionsWanted: 10})),
    onClickUser: (username: string) => dispatch(createShowUserProfile({username})),
  }),
  (stateProps, dispatchProps) => ({
    ...dispatchProps,
    followSuggestions: stateProps.followSuggestions,
    myUsername: stateProps.myUsername,
    newItems: stateProps.newItems,
    oldItems: stateProps.oldItems,
    signupEmail: stateProps.signupEmail,
    waiting: stateProps.waiting,
    wotUpdates: stateProps.wotUpdates,
  })
)(LoadOnMount)
