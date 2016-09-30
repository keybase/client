// @flow
import type {BillingState} from '../constants/plan-billing'
import type {ConfigState} from '../reducers/config'
import type {FavoriteState} from '../constants/favorite'
import type {LoginState} from '../reducers/login'
import type {RootPinentryState} from '../reducers/pinentry'
import type {SignupState} from '../reducers/signup'
import type {State as GregorState} from '../reducers/gregor'
import type {State as PgpState} from '../reducers/pgp'
import type {State as ProfileState} from '../constants/profile'
import type {State as SearchState} from '../reducers/search'
import type {State as TotalTrackerState} from '../reducers/tracker'
import type {State as UnlockFoldersState} from '../reducers/unlock-folders'

export type TypedState = {
  config: ConfigState,
  favorite: FavoriteState,
  gregor: GregorState,
  login: LoginState,
  pgp: PgpState,
  pinentry: RootPinentryState,
  planBilling: BillingState,
  profile: ProfileState,
  search: SearchState,
  signup: SignupState,
  tracker: TotalTrackerState,
  unlockFolders: UnlockFoldersState,
}

// TODO swap State with TypedState when TypedState includes everything we care about
export type State = {[key: string]: any}
export const stateKey = 'reducer:stateKey'
