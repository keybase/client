import * as React from 'react'
import * as Constants from '../../../constants/wallets'
import * as Container from '../../../util/container'
import * as IconUtils from '../../../common-adapters/icon.shared'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import Settings from '.'
import type * as Types from '../../../constants/types/wallets'
import type {IconType} from '../../../common-adapters/icon.constants-gen'
import {anyWaiting} from '../../../constants/waiting'

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

const SettingsContainer = () => {
  const accountID = Container.useSelector(state => Constants.getSelectedAccount(state))
  const account = Container.useSelector(state => Constants.getAccount(state, accountID))
  const name = account.name
  const mobileOnlyEditable = account.mobileOnlyEditable
  const me = Container.useSelector(state => state.config.username || '')
  // External partner URLs include the keybase username even for non-primary accounts.
  const externalPartners = Container.useSelector(state =>
    prepareExternalPartners(Constants.getExternalPartners(state), accountID, me)
  )
  const user = account.isDefault ? me : ''
  const currencies = Container.useSelector(state => Constants.getDisplayCurrencies(state))
  const currency = Container.useSelector(state => Constants.getDisplayCurrency(state, accountID))
  const currencyWaiting = Container.useSelector(state =>
    anyWaiting(
      state,
      Constants.changeDisplayCurrencyWaitingKey,
      Constants.getDisplayCurrencyWaitingKey(accountID)
    )
  )
  const saveCurrencyWaiting = Container.useSelector(state =>
    anyWaiting(state, Constants.changeDisplayCurrencyWaitingKey)
  )
  const thisDeviceIsLockedOut = account.deviceReadOnly
  const secretKey = Container.useSelector(state =>
    !thisDeviceIsLockedOut ? Constants.getSecretKey(state, accountID).stringValue() : ''
  )
  const mobileOnlyMode = Container.useSelector(state => state.wallets.mobileOnlyMap.get(accountID) ?? false)
  const mobileOnlyWaiting = Container.useSelector(state =>
    anyWaiting(state, Constants.setAccountMobileOnlyWaitingKey(accountID))
  )
  const canSubmitTx = account.canSubmitTx
  const isDefault = account.isDefault
  const showExternalPartners = true

  const dispatch = Container.useDispatch()
  const onBack = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(WalletsGen.createLoadPayments({accountID}))
  }, [dispatch, accountID])
  const onMobileOnlyModeChange = React.useCallback(
    (enabled: boolean) => {
      dispatch(WalletsGen.createChangeMobileOnlyMode({accountID, enabled}))
    },
    [dispatch, accountID]
  )
  const onDelete = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'removeAccount'}]}))
  }, [dispatch, accountID])
  const onEditName = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'renameAccount'}]}))
  }, [dispatch, accountID])
  const onLoadSecretKey = React.useCallback(() => {
    dispatch(WalletsGen.createExportSecretKey({accountID}))
  }, [dispatch, accountID])
  const onSecretKeySeen = React.useCallback(() => {
    dispatch(WalletsGen.createSecretKeySeen({accountID}))
  }, [dispatch, accountID])
  const onSetDefault = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {accountID}, selected: 'setDefaultAccount'}]}))
  }, [dispatch, accountID])
  const _onCurrencyChange = React.useCallback(
    (code: Types.CurrencyCode) => {
      dispatch(WalletsGen.createChangeDisplayCurrency({accountID, code}))
    },
    [dispatch, accountID]
  )
  const onCurrencyChange = Container.useSafeSubmit(_onCurrencyChange, !currencyWaiting)
  const refresh = React.useCallback(() => {
    dispatch(WalletsGen.createLoadDisplayCurrencies())
    dispatch(WalletsGen.createLoadDisplayCurrency({accountID}))
    dispatch(WalletsGen.createLoadMobileOnlyMode({accountID}))
    dispatch(WalletsGen.createLoadExternalPartners())
  }, [dispatch, accountID])

  return (
    <Settings
      accountID={accountID}
      canSubmitTx={canSubmitTx}
      currencies={currencies}
      currency={currency}
      currencyWaiting={currencyWaiting}
      externalPartners={externalPartners}
      isDefault={isDefault}
      mobileOnlyEditable={mobileOnlyEditable}
      mobileOnlyMode={mobileOnlyMode}
      mobileOnlyWaiting={mobileOnlyWaiting}
      name={name}
      onBack={onBack}
      onCurrencyChange={onCurrencyChange}
      onDelete={onDelete}
      onEditName={onEditName}
      onLoadSecretKey={thisDeviceIsLockedOut ? undefined : onLoadSecretKey}
      onMobileOnlyModeChange={onMobileOnlyModeChange}
      onSecretKeySeen={thisDeviceIsLockedOut ? undefined : onSecretKeySeen}
      onSetDefault={onSetDefault}
      refresh={refresh}
      saveCurrencyWaiting={saveCurrencyWaiting}
      secretKey={secretKey}
      showExternalPartners={showExternalPartners}
      thisDeviceIsLockedOut={thisDeviceIsLockedOut}
      user={user}
    />
  )
}
export default SettingsContainer
