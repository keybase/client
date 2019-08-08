import * as I from 'immutable'
import * as React from 'react'
import * as Constants from '../constants/people'
import * as Types from '../constants/types/people'
import * as Kb from '../common-adapters'
import People, {Header} from './index'
import * as PeopleGen from '../actions/people-gen'
import * as Container from '../util/container'
import {createClearJustSignedUpEmail} from '../actions/signup-gen'
import {createSearchSuggestions} from '../actions/search-gen'
import {createShowUserProfile} from '../actions/profile-gen'
import * as WaitingConstants from '../constants/waiting'
import * as RouteTreeGen from '../actions/route-tree-gen'

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
  clearJustSignedUpEmail: () => void
  oldItems: I.List<Types.PeopleScreenItem>
  newItems: I.List<Types.PeopleScreenItem>
  followSuggestions: I.List<Types.FollowSuggestion>
  getData: (markViewed?: boolean) => void
  onClickUser: (username: string) => void
  signupEmail: string
  showAirdrop: boolean
  myUsername: string
  waiting: boolean
}

class LoadOnMount extends React.PureComponent<Props> {
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
        waitingKeys={Constants.getPeopleDataWaitingKey}
        onReload={this._onReload}
        reloadOnMount={true}
      >
        <People
          newItems={this.props.newItems.toArray()}
          oldItems={this.props.oldItems.toArray()}
          followSuggestions={this.props.followSuggestions.toArray()}
          myUsername={this.props.myUsername}
          waiting={this.props.waiting}
          getData={this._getData}
          onClickUser={this._onClickUser}
          showAirdrop={this.props.showAirdrop}
          signupEmail={this.props.signupEmail}
          clearJustSignedUpEmail={this.props.clearJustSignedUpEmail}
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
    showAirdrop: Container.isMobile,
    signupEmail: state.signup.justSignedUpEmail,
    waiting: WaitingConstants.anyWaiting(state, Constants.getPeopleDataWaitingKey),
  }),
  dispatch => ({
    clearJustSignedUpEmail: () => dispatch(createClearJustSignedUpEmail()),
    getData: (markViewed = true) =>
      dispatch(PeopleGen.createGetPeopleData({markViewed, numFollowSuggestionsWanted: 10})),
    onClickUser: (username: string) => dispatch(createShowUserProfile({username})),
    onSearch: () => {
      dispatch(createSearchSuggestions({searchKey: 'profileSearch'}))
    },
  }),
  (stateProps, dispatchProps) => ({
    followSuggestions: stateProps.followSuggestions,
    myUsername: stateProps.myUsername,
    newItems: stateProps.newItems,
    oldItems: stateProps.oldItems,
    showAirdrop: stateProps.showAirdrop,
    signupEmail: stateProps.signupEmail,
    waiting: stateProps.waiting,
    ...dispatchProps,
  })
)(LoadOnMount)
