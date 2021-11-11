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
import ProfileSearch from '../profile/search/bar'

// type OwnProps = {}

// const ConnectedHeader = Container.connect(
// state => ({
// myUsername: state.config.username,
// }),
// dispatch => ({
// onClickUser: (username: string) => dispatch(createShowUserProfile({username})),
// onOpenAccountSwitcher: () => ),
// }),
// (stateProps, dispatchProps, _: OwnProps) => ({
// myUsername: stateProps.myUsername,
// ...dispatchProps,
// })
// )(Header)

const HeaderAvatar = () => {
  const myUsername = Container.useSelector(state => state.config.username)
  const dispatch = Container.useDispatch()
  const onClick = React.useCallback(
    () => dispatch(RouteTreeGen.createNavigateAppend({path: ['accountSwitcher']})),
    [dispatch]
  )
  return <Kb.Avatar size={32} username={myUsername} onClick={onClick} />
}

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

// const Test = ({children}) => {
// return (
// <Kb.Box2 direction="horizontal" fullWidth={true} style={{backgroundColor: 'red', flexGrow: 100}}>
// <Kb.Text type="Body">{children}</Kb.Text>
// </Kb.Box2>
// )
// }
//

export class LoadOnMount extends React.PureComponent<Props> {
  static navigationOptions = {
    // header: undefined,
    // headerTitle: ({children}) => <Test>{children}</Test>,
    // underNotch: true,
    headerTitle: () => <ProfileSearch />,
    headerRight: () => <HeaderAvatar />,
    headerLeft: () => <Kb.HeaderLeftBlank />,
    // headerLeftLabelVisible: true,
    // headerLeftContainerStyle: {
    // backgroundColor: 'yellow',
    // // minWidth: 48,
    // },
    // headerTitleContainerStyle: {
    // paddingLeft: 40,
    // marginHorizontal: 0,
    // maxWidth: '100%',
    // },
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
