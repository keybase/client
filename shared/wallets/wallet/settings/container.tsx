import Settings from '.'
import * as Container from '../../../util/container'
import {anyWaiting} from '../../../constants/waiting'
import * as Constants from '../../../constants/wallets'
import {IconType} from '../../../common-adapters/icon.constants-gen'
import * as IconUtils from '../../../common-adapters/icon.shared'
import * as Types from '../../../constants/types/wallets'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

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
  externalPartners: Array<Types.PartnerUrl>,
  accountID: string,
  username: string
): Array<Types.PartnerUrl & {showDivider: boolean}> =>
  externalPartners.map((partner, index) => ({
    adminOnly: partner.adminOnly,
    canPurchase: partner.canPurchase,
    description: partner.description,
    extra: partner.extra,
    iconFilename: toIconType(partner.iconFilename),
    showDivider: index > 0,
    title: partner.title,
    url: transformUrl(accountID, partner.url, username),
  }))

// TODO remove compose
export default Container.compose(
  Container.namedConnect(
    state => {
      const accountID = Constants.getSelectedAccount(state)
      const account = Constants.getAccount(state, accountID)
      const name = account.name
      const mobileOnlyEditable = account.mobileOnlyEditable
      const me = state.config.username || ''
      // External partner URLs include the keybase username even for non-primary accounts.
      const externalPartners = prepareExternalPartners(Constants.getExternalPartners(state), accountID, me)
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
      const mobileOnlyMode = state.wallets.mobileOnlyMap.get(accountID) ?? false
      const mobileOnlyWaiting = anyWaiting(state, Constants.setAccountMobileOnlyWaitingKey(accountID))
      const canSubmitTx = account.canSubmitTx
      return {
        accountID,
        canSubmitTx,
        currencies,
        currency,
        currencyWaiting,
        externalPartners,
        isDefault: account.isDefault,
        mobileOnlyEditable,
        mobileOnlyMode,
        mobileOnlyWaiting,
        name,
        saveCurrencyWaiting,
        secretKey,
        showExternalPartners: true,
        thisDeviceIsLockedOut,
        user,
      }
    },
    (dispatch: Container.TypedDispatch) => ({
      _onBack: (accountID: Types.AccountID) => {
        dispatch(RouteTreeGen.createNavigateUp())
        dispatch(WalletsGen.createLoadPayments({accountID}))
      },
      _onChangeMobileOnlyMode: (accountID: Types.AccountID, enabled: boolean) =>
        dispatch(WalletsGen.createChangeMobileOnlyMode({accountID, enabled})),
      _onDelete: (accountID: Types.AccountID) =>
        dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'removeAccount'}]})
        ),
      _onEditName: (accountID: Types.AccountID) =>
        dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'renameAccount'}]})
        ),
      _onLoadSecretKey: (accountID: Types.AccountID) =>
        dispatch(WalletsGen.createExportSecretKey({accountID})),
      _onSecretKeySeen: (accountID: Types.AccountID) => dispatch(WalletsGen.createSecretKeySeen({accountID})),
      _onSetDefault: (accountID: Types.AccountID) =>
        dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'setDefaultAccount'}]})
        ),
      _onSetDisplayCurrency: (accountID: Types.AccountID, code: Types.CurrencyCode) =>
        dispatch(WalletsGen.createChangeDisplayCurrency({accountID, code})),
      _refresh: (accountID: Types.AccountID) => {
        dispatch(WalletsGen.createLoadDisplayCurrencies())
        dispatch(WalletsGen.createLoadDisplayCurrency({accountID}))
        dispatch(WalletsGen.createLoadMobileOnlyMode({accountID}))
        dispatch(WalletsGen.createLoadExternalPartners())
      },
    }),
    (stateProps, dispatchProps, _: OwnProps) => ({
      ...stateProps,
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
      refresh: () => dispatchProps._refresh(stateProps.accountID),
    }),

    'Settings'
  ),
  Container.safeSubmit(['onCurrencyChange'], ['currencyWaiting'])
)(Settings)
