// @noflow
import logger from '../../logger'
import * as SettingsGen from '../../actions/settings-gen'
import Bootstrapable from '../../util/bootstrapable'
import Landing from '.'
import {connect, type TypedState, compose} from '../../util/container'
import {navigateAppend} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState, ownProps: {}) => {
  const {emails} = state.settings.email
  const {rememberPassphrase} = state.settings.passphrase
  let accountProps
  if (emails.length > 0) {
    accountProps = {
      email: emails[0].email,
      isVerified: emails[0].isVerified,
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

const mapDispatchToProps = (dispatch: (a: any) => void, ownProps: {}) => ({
  onBootstrap: () => {
    dispatch(SettingsGen.createLoadSettings())
    dispatch(SettingsGen.createLoadRememberPassphrase())
  },
  onChangePassphrase: () => dispatch(navigateAppend(['changePassphrase'])),
  onChangeRememberPassphrase: (checked: boolean) =>
    dispatch(SettingsGen.createOnChangeRememberPassphrase({remember: checked})),
  onChangeEmail: () => dispatch(navigateAppend(['changeEmail'])),
  onInfo: selectedLevel => dispatch(navigateAppend([{selected: 'changePlan', props: {selectedLevel}}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps: {}) => {
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
