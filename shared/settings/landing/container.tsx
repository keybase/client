import logger from '../../logger'
import * as SettingsGen from '../../actions/settings-gen'
import {connect, compose} from '../../util/container'
import Bootstrapable from '../../util/bootstrapable'
import Landing from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {}

const mapStateToProps = state => {
  const {emails} = state.settings.email
  const {rememberPassword} = state.settings.password
  let accountProps
  let email = ''
  let isVerified = false
  if (emails && emails.first()) {
    const firstEmail = emails.first()
    email = firstEmail.email
    isVerified = firstEmail.isVerified
  }

  accountProps = {
    email,
    hasRandomPW: state.settings.password.randomPW,
    isVerified,
    onChangeEmail: () => logger.debug('todo'),
    onChangePassword: () => logger.debug('todo'),
    rememberPassword,
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
    dispatch(SettingsGen.createLoadRememberPassword())
    dispatch(SettingsGen.createLoadHasRandomPw())
  },
  onChangeEmail: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['changeEmail']})),
  onChangePassword: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['changePassword']})),
  onChangeRememberPassword: (checked: boolean) =>
    dispatch(SettingsGen.createOnChangeRememberPassword({remember: checked})),
  onInfo: selectedLevel =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {selectedLevel}, selected: 'changePlan'}]})),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => {
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
        onChangePassword: dispatchProps.onChangePassword,
        onChangeRememberPassword: (checked: boolean) => dispatchProps.onChangeRememberPassword(checked),
      },
      plan: {
        ...stateProps.originalProps.plan,
        onInfo: selectedLevel => {
          dispatchProps.onInfo(selectedLevel)
        },
      },
    },
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Bootstrapable
)(Landing)
