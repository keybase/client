// @flow
import * as React from 'react'
import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SignupGen from '../../actions/signup-gen'
import Phone, {type Props} from '.'
import {compose, connect, withStateHandlers, withHandlers} from '../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({
  _emails: state.settings.email,
  error: state.signup.emailError,
})

const mapDispatchToProps = dispatch => ({
  _onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  _onNextScreen: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {}, selected: 'signupPhone'}],
      })
    ),
  _onSkip: () => dispatch(ConfigGen.createLoggedIn({causedByStartup: false})),
  _onSubmit: (allowSearch: boolean, email: string) => dispatch(SignupGen.createCheckEmail({email})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  error: stateProps.error,
  onBack: dispatchProps._onBack,
  onNextScreen: dispatchProps._onNextScreen,
  onSkip: dispatchProps._onSkip,
})

class PhoneContainer extends React.Component<Props> {
  componentDidUpdate(prevProps: Props) {
    if (!prevProps.emailAdded && this.props.emailAdded) {
      this.props.onNextScreen()
    }
  }

  render() {
    return <Phone {...this.props} />
  }
}

const Connected = compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  withStateHandlers(
    {allowSearch: false, email: '', numberValid: false},
    {
      onChangeAllowSearch: () => allowSearch => ({allowSearch}),
      onChangePhoneNumber: () => phoneNumber => ({phoneNumber}),
      onChangeValidity: () => numberValid => {
        console.warn('in onChangeValidity with', numberValid)
        return {numberValid}
      },
    }
  ),
  withHandlers({
    onFinish: ({_onSubmit, allowSearch, phoneNumber}) => () => {
      _onSubmit()
    },
  })
)(PhoneContainer)

// $FlowIssue lets fix this
Connected.navigationOptions = {
  header: undefined,
  headerHideBorder: true,
  headerTransparent: true,
}

export default Connected
