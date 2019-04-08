import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'

export type _State = {
  forgotPasswordError: Error | null,
  forgotPasswordSubmitting: boolean,
  forgotPasswordSuccess: boolean,
  error: HiddenString,
  registerUserPassLoading: boolean
};

export type State = I.RecordOf<_State>;
