// @flow
import logger from '../../logger'
import * as SettingsGen from '../../actions/settings-gen'
import {connect, compose} from '../../util/container'
import Bootstrapable from '../../util/bootstrapable'
import Landing from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {||}

const mapStateToProps = state => {
  const {emails} = state.settings.email
  const {rememberPassphrase} = state.settings.passphrase
  let accountProps
  if (emails) {
    let emailProps = {}
    if (emails.length) {
      emailProps = {
        email: emails[0].email,
        isVerified: emails[0].isVerified,
      }
    }
    accountProps = {
      ...emailProps,
      hasRandomPW: state.settings.passphrase.randomPW,
      onChangeEmail: () => logger.debug('todo'),
      onChangePassphrase: () => logger.debug('todo'),
      rememberPassphrase,
    }
  }

  // const {
  // planBilling: {availablePlans, usage, plan, paymentInfo},
  // } = state
  // let planProps
  // if (plan && usage) {
  // const freeSpaceGB = plan.gigabytes - usage.gigabytes
  // const freeSpacePercentage = freeSpaceGB / plan.gigabytes
  // planProps = {
  // onUpgrade: () => logger.debug('todo'),
  // onDowngrade: () => logger.debug('todo'),
  // onInfo: () => logger.debug('todo'),
  // selectedLevel: plan.planLevel,
  // freeSpace: freeSpaceGB + 'GB',
  // freeSpacePercentage,
  // lowSpaceWarning: false,
  // paymentInfo,
  // onChangePaymentInfo: () => logger.debug('todo'),
  // }
  // }

  // When enabling planProps, we should check both for bootstrapDone:
  // let bootstrapDone = accountProps && planProps
  let bootstrapDone = !!accountProps

  return {
    bootstrapDone: bootstrapDone,
    originalProps: {
      account: accountProps,
      // plan: planProps,
      // plans: availablePlans,
    },
  }
}

const mapDispatchToProps = (dispatch: (a: any) => void) => ({
  onBootstrap: () => {
    dispatch(SettingsGen.createLoadSettings())
    dispatch(SettingsGen.createLoadRememberPassphrase())
    dispatch(SettingsGen.createLoadHasRandomPw())
  },
  onChangeEmail: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['changeEmail']})),
  onChangePassphrase: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['changePassphrase']})),
  onChangeRememberPassphrase: (checked: boolean) =>
    dispatch(SettingsGen.createOnChangeRememberPassphrase({remember: checked})),
  onInfo: selectedLevel =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {selectedLevel}, selected: 'changePlan'}]})),
})

const mergeProps = (stateProps, dispatchProps) => {
  if (!stateProps.bootstrapDone) {
    return {
      ...stateProps,
      onBootstrap: dispatchProps.onBootstrap,
    }
  }

  return {
    ...stateProps,
    originalProps: {
      ...stateProps.originalProps,
      account: {
        ...stateProps.originalProps.account,
        onChangeEmail: dispatchProps.onChangeEmail,
        onChangePassphrase: dispatchProps.onChangePassphrase,
        onChangeRememberPassphrase: (checked: boolean) => dispatchProps.onChangeRememberPassphrase(checked),
      },
      plan: {
        // $FlowIssue
        ...stateProps.originalProps.plan,
        onInfo: selectedLevel => {
          dispatchProps.onInfo(selectedLevel)
        },
      },
    },
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Bootstrapable
)(Landing)
