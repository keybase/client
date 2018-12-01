// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../constants/types/people'
import People from './'
import * as PeopleGen from '../actions/people-gen'
import {connect, type RouteProps} from '../util/container'
import {createSearchSuggestions} from '../actions/search-gen'
import {createShowUserProfile} from '../actions/profile-gen'
import {getPeopleDataWaitingKey} from '../constants/people'
import * as WaitingConstants from '../constants/waiting'

type OwnProps = RouteProps<{}, {}>

type Props = {
  oldItems: I.List<Types.PeopleScreenItem>,
  newItems: I.List<Types.PeopleScreenItem>,
  followSuggestions: I.List<Types.FollowSuggestion>,
  getData: (markViewed?: boolean) => void,
  onSearch: () => void,
  onClickUser: (username: string) => void,
  myUsername: string,
  waiting: boolean,
}

class LoadOnMount extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.getData(false)
  }

  _onSearch = () => this.props.onSearch()
  _getData = (markViewed?: boolean) => this.props.getData(markViewed)
  _onClickUser = (username: string) => this.props.onClickUser(username)

  render() {
    return (
      <People
        newItems={this.props.newItems.toArray()}
        oldItems={this.props.oldItems.toArray()}
        followSuggestions={this.props.followSuggestions.toArray()}
        myUsername={this.props.myUsername}
        waiting={this.props.waiting}
        getData={this._getData}
        onSearch={this._onSearch}
        onClickUser={this._onClickUser}
      />
    )
  }
}

const mapStateToProps = state => ({
  followSuggestions: state.people.followSuggestions,
  myUsername: state.config.username,
  newItems: state.people.newItems,
  oldItems: state.people.oldItems,
  waiting: WaitingConstants.anyWaiting(state, getPeopleDataWaitingKey),
})

const mapDispatchToProps = (dispatch, {navigateAppend}) => ({
  getData: (markViewed = true) =>
    dispatch(PeopleGen.createGetPeopleData({markViewed, numFollowSuggestionsWanted: 10})),
  onClickUser: (username: string) => dispatch(createShowUserProfile({username})),
  onSearch: () => {
    dispatch(createSearchSuggestions({searchKey: 'profileSearch'}))
    dispatch(navigateAppend([{props: {}, selected: 'search'}]))
  },
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    followSuggestions: stateProps.followSuggestions,
    myUsername: stateProps.myUsername,
    newItems: stateProps.newItems,
    oldItems: stateProps.oldItems,
    waiting: stateProps.waiting,
    ...dispatchProps,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(LoadOnMount)
