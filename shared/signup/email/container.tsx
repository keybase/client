import * as React from 'react'
import * as Container from '../../util/container'
import * as SignupGen from '../../actions/signup-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {InfoIcon} from '../common'
import EnterEmail from '.'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => ({
  allowSearch: false,
  error: state.signup.emailError,
  initialEmail: state.signup.email,
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onBack: () => dispatch(SignupGen.createGoBackAndClearErrors()),
  onFinish: (email: string) => dispatch(SignupGen.createCheckEmail({email})),
})

const ConnectedEnterEmail = Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => ({
  ...s,
  ...d,
  ...o,
}))(EnterEmail)

// @ts-ignore fix this
ConnectedEnterEmail.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default ConnectedEnterEmail
