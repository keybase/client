import Settings from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import * as I from 'immutable'
import * as Constants from '../../../constants/wallets'
import {IconType} from '../../../common-adapters/icon.constants'
import * as IconUtils from '../../../common-adapters/icon.shared'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import flags from '../../../util/feature-flags'

type OwnProps = Container.RouteProps

// Note: `props.user` is only the Keybase username if this is the primary
// account. Non-primary accounts are not associated with usernames.
const transformUrl = (accountID: string, url: string, username: string): string =>
  url.replace('%{accountId}', accountID).replace('%{username}', username)

const toIconType = (iconFilename: string): IconType => {
  const iconType = iconFilename as IconType
  if (IconUtils.isValidIconType(iconType)) {
    return iconType
  } else {
    return 'iconfont-identity-stellar'
  }
}

const prepareExternalPartners = (
  externalPartners: I.List<Types.PartnerUrl>,
  accountID: string,
  username: string
): Array<Types.PartnerUrl & {showDivider: boolean}> =>
  externalPartners
    .map((partner, index) => ({
      adminOnly: partner.adminOnly,
      description: partner.description,
      extra: partner.extra,
      iconFilename: toIconType(partner.iconFilename),
      showDivider: index > 0,
      title: partner.title,
      url: transformUrl(accountID, partner.url, username),
    }))
    .toArray()

const mapStateToProps = (state: Container.TypedState) => {
  const accountID = Constants.getSelectedAccount(state)
  const account = Constants.getAccount(state, accountID)
  const name = account.name
  const mobileOnlyEditable = account.mobileOnlyEditable
  const me = state.config.username || ''
  const user = account.isDefault ? me : ''
  const currencies = Constants.getDisplayCurrencies(state)
  const currency = Constants.getDisplayCurrency(state, accountID)
  const currencyWaiting = anyWaiting(
    state,
    Constants.changeDisplayCurrencyWaitingKey,
    Constants.getDisplayCurrencyWaitingKey(accountID)
  )
  const saveCurrencyWaiting = anyWaiting(state, Constants.changeDisplayCurrencyWaitingKey)
  const thisDeviceIsLockedOut = account.deviceReadOnly
  const secretKey = !thisDeviceIsLockedOut ? Constants.getSecretKey(state, accountID).stringValue() : ''
  const mobileOnlyMode = state.wallets.mobileOnlyMap.get(accountID, false)
  const mobileOnlyWaiting = anyWaiting(state, Constants.setAccountMobileOnlyWaitingKey(accountID))
  const canSubmitTx = account.canSubmitTx
  const inflationDest = Constants.getInflationDestination(state, accountID)
  const externalPartners = Constants.getExternalPartners(state)
  return {
    accountID,
    canSubmitTx,
    currencies,
    currency,
    currencyWaiting,
    externalPartners,
    inflationDestination:
      inflationDest === Constants.noAccountInflationDestination
        ? ''
        : inflationDest.name || inflationDest.accountID,
    isDefault: account.isDefault,
    mobileOnlyEditable,
    mobileOnlyMode,
    mobileOnlyWaiting,
    name,
    saveCurrencyWaiting,
    secretKey,
    showExternalPartners: flags.stellarExternalPartners,
    thisDeviceIsLockedOut,
    user,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onBack: (accountID: Types.AccountID) => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(WalletsGen.createLoadPayments({accountID}))
  },
  _onChangeMobileOnlyMode: (accountID: Types.AccountID, enabled: boolean) =>
    dispatch(WalletsGen.createChangeMobileOnlyMode({accountID, enabled})),
  _onDelete: (accountID: Types.AccountID) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'removeAccount'}]})),
  _onEditName: (accountID: Types.AccountID) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'renameAccount'}]})),
  _onLoadSecretKey: (accountID: Types.AccountID) => dispatch(WalletsGen.createExportSecretKey({accountID})),
  _onSecretKeySeen: (accountID: Types.AccountID) => dispatch(WalletsGen.createSecretKeySeen({accountID})),
  _onSetDefault: (accountID: Types.AccountID) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'setDefaultAccount'}]})
    ),
  _onSetDisplayCurrency: (accountID: Types.AccountID, code: Types.CurrencyCode) =>
    dispatch(WalletsGen.createChangeDisplayCurrency({accountID, code})),
  _onSetupInflation: (accountID: Types.AccountID) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'setInflation'}]})),
  _refresh: (accountID: Types.AccountID) => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    dispatch(WalletsGen.createLoadInflationDestination({accountID}))
    dispatch(WalletsGen.createLoadDisplayCurrency({accountID}))
    dispatch(WalletsGen.createLoadMobileOnlyMode({accountID}))
    dispatch(WalletsGen.createLoadExternalPartners())
  },
})

// TODO remove compose
export default Container.compose(
  Container.namedConnect(
    mapStateToProps,
    mapDispatchToProps,
    (stateProps, dispatchProps, _: OwnProps) => ({
      ...stateProps,
      externalPartners: prepareExternalPartners(
        stateProps.externalPartners,
        stateProps.accountID,
        stateProps.user
      ),
      onBack: () => dispatchProps._onBack(stateProps.accountID),
      onCurrencyChange: (code: Types.CurrencyCode) =>
        dispatchProps._onSetDisplayCurrency(stateProps.accountID, code),
      onDelete: () => dispatchProps._onDelete(stateProps.accountID),
      onEditName: () => dispatchProps._onEditName(stateProps.accountID),
      onLoadSecretKey: !stateProps.thisDeviceIsLockedOut
        ? () => dispatchProps._onLoadSecretKey(stateProps.accountID)
        : undefined,
      onMobileOnlyModeChange: (enabled: boolean) =>
        dispatchProps._onChangeMobileOnlyMode(stateProps.accountID, enabled),
      onSecretKeySeen: !stateProps.thisDeviceIsLockedOut
        ? () => dispatchProps._onSecretKeySeen(stateProps.accountID)
        : undefined,
      onSetDefault: () => dispatchProps._onSetDefault(stateProps.accountID),
      onSetupInflation: () => dispatchProps._onSetupInflation(stateProps.accountID),
      refresh: () => dispatchProps._refresh(stateProps.accountID),
    }),

    'Settings'
  ),
  Container.safeSubmit(['onCurrencyChange'], ['currencyWaiting'])
)(Settings)
