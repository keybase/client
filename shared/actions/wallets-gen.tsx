// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/wallets'
import type * as ChatTypes from '../constants/types/chat2'
import type * as StellarRPCTypes from '../constants/types/rpc-stellar-gen'
import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of wallets but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'wallets:'
export const abandonPayment = 'wallets:abandonPayment'
export const acceptDisclaimer = 'wallets:acceptDisclaimer'
export const acceptSEP7Path = 'wallets:acceptSEP7Path'
export const acceptSEP7Pay = 'wallets:acceptSEP7Pay'
export const acceptSEP7Tx = 'wallets:acceptSEP7Tx'
export const accountUpdateReceived = 'wallets:accountUpdateReceived'
export const accountsReceived = 'wallets:accountsReceived'
export const addTrustline = 'wallets:addTrustline'
export const assetDeposit = 'wallets:assetDeposit'
export const assetWithdraw = 'wallets:assetWithdraw'
export const assetsReceived = 'wallets:assetsReceived'
export const badgesUpdated = 'wallets:badgesUpdated'
export const buildPayment = 'wallets:buildPayment'
export const buildingPaymentIDReceived = 'wallets:buildingPaymentIDReceived'
export const builtPaymentReceived = 'wallets:builtPaymentReceived'
export const builtRequestReceived = 'wallets:builtRequestReceived'
export const calculateBuildingAdvanced = 'wallets:calculateBuildingAdvanced'
export const cancelPayment = 'wallets:cancelPayment'
export const cancelRequest = 'wallets:cancelRequest'
export const changeAccountName = 'wallets:changeAccountName'
export const changeDisplayCurrency = 'wallets:changeDisplayCurrency'
export const changeMobileOnlyMode = 'wallets:changeMobileOnlyMode'
export const changedAccountName = 'wallets:changedAccountName'
export const changedTrustline = 'wallets:changedTrustline'
export const checkDisclaimer = 'wallets:checkDisclaimer'
export const clearBuilding = 'wallets:clearBuilding'
export const clearBuildingAdvanced = 'wallets:clearBuildingAdvanced'
export const clearBuiltPayment = 'wallets:clearBuiltPayment'
export const clearBuiltRequest = 'wallets:clearBuiltRequest'
export const clearErrors = 'wallets:clearErrors'
export const clearTrustlineSearchResults = 'wallets:clearTrustlineSearchResults'
export const createNewAccount = 'wallets:createNewAccount'
export const createdNewAccount = 'wallets:createdNewAccount'
export const deleteAccount = 'wallets:deleteAccount'
export const deleteTrustline = 'wallets:deleteTrustline'
export const deletedAccount = 'wallets:deletedAccount'
export const didSetAccountAsDefault = 'wallets:didSetAccountAsDefault'
export const displayCurrenciesReceived = 'wallets:displayCurrenciesReceived'
export const displayCurrencyReceived = 'wallets:displayCurrencyReceived'
export const exitFailedPayment = 'wallets:exitFailedPayment'
export const exportSecretKey = 'wallets:exportSecretKey'
export const externalPartnersReceived = 'wallets:externalPartnersReceived'
export const linkExistingAccount = 'wallets:linkExistingAccount'
export const linkedExistingAccount = 'wallets:linkedExistingAccount'
export const loadAccounts = 'wallets:loadAccounts'
export const loadAssets = 'wallets:loadAssets'
export const loadDisplayCurrencies = 'wallets:loadDisplayCurrencies'
export const loadDisplayCurrency = 'wallets:loadDisplayCurrency'
export const loadExternalPartners = 'wallets:loadExternalPartners'
export const loadMobileOnlyMode = 'wallets:loadMobileOnlyMode'
export const loadMorePayments = 'wallets:loadMorePayments'
export const loadPaymentDetail = 'wallets:loadPaymentDetail'
export const loadPayments = 'wallets:loadPayments'
export const loadSendAssetChoices = 'wallets:loadSendAssetChoices'
export const loadWalletDisclaimer = 'wallets:loadWalletDisclaimer'
export const loadedMobileOnlyMode = 'wallets:loadedMobileOnlyMode'
export const markAsRead = 'wallets:markAsRead'
export const openSendRequestForm = 'wallets:openSendRequestForm'
export const paymentDetailReceived = 'wallets:paymentDetailReceived'
export const paymentsReceived = 'wallets:paymentsReceived'
export const pendingPaymentsReceived = 'wallets:pendingPaymentsReceived'
export const recentPaymentsReceived = 'wallets:recentPaymentsReceived'
export const refreshTrustlineAcceptedAssets = 'wallets:refreshTrustlineAcceptedAssets'
export const refreshTrustlineAcceptedAssetsByUsername = 'wallets:refreshTrustlineAcceptedAssetsByUsername'
export const refreshTrustlinePopularAssets = 'wallets:refreshTrustlinePopularAssets'
export const rejectDisclaimer = 'wallets:rejectDisclaimer'
export const requestPayment = 'wallets:requestPayment'
export const requestedPayment = 'wallets:requestedPayment'
export const resetAcceptingDisclaimer = 'wallets:resetAcceptingDisclaimer'
export const reviewPayment = 'wallets:reviewPayment'
export const reviewedPaymentReceived = 'wallets:reviewedPaymentReceived'
export const secretKeyReceived = 'wallets:secretKeyReceived'
export const secretKeySeen = 'wallets:secretKeySeen'
export const selectAccount = 'wallets:selectAccount'
export const sendAssetChoicesReceived = 'wallets:sendAssetChoicesReceived'
export const sendPayment = 'wallets:sendPayment'
export const sendPaymentAdvanced = 'wallets:sendPaymentAdvanced'
export const sentPayment = 'wallets:sentPayment'
export const sentPaymentError = 'wallets:sentPaymentError'
export const setAccountAsDefault = 'wallets:setAccountAsDefault'
export const setBuildingAdvancedPublicMemo = 'wallets:setBuildingAdvancedPublicMemo'
export const setBuildingAdvancedRecipient = 'wallets:setBuildingAdvancedRecipient'
export const setBuildingAdvancedRecipientAmount = 'wallets:setBuildingAdvancedRecipientAmount'
export const setBuildingAdvancedRecipientAsset = 'wallets:setBuildingAdvancedRecipientAsset'
export const setBuildingAdvancedRecipientType = 'wallets:setBuildingAdvancedRecipientType'
export const setBuildingAdvancedSecretNote = 'wallets:setBuildingAdvancedSecretNote'
export const setBuildingAdvancedSenderAccountID = 'wallets:setBuildingAdvancedSenderAccountID'
export const setBuildingAdvancedSenderAsset = 'wallets:setBuildingAdvancedSenderAsset'
export const setBuildingAmount = 'wallets:setBuildingAmount'
export const setBuildingCurrency = 'wallets:setBuildingCurrency'
export const setBuildingFrom = 'wallets:setBuildingFrom'
export const setBuildingIsRequest = 'wallets:setBuildingIsRequest'
export const setBuildingPublicMemo = 'wallets:setBuildingPublicMemo'
export const setBuildingRecipientType = 'wallets:setBuildingRecipientType'
export const setBuildingSecretNote = 'wallets:setBuildingSecretNote'
export const setBuildingTo = 'wallets:setBuildingTo'
export const setBuiltPaymentAdvanced = 'wallets:setBuiltPaymentAdvanced'
export const setLastSentXLM = 'wallets:setLastSentXLM'
export const setReadyToReview = 'wallets:setReadyToReview'
export const setSEP6Message = 'wallets:setSEP6Message'
export const setSEP7SendError = 'wallets:setSEP7SendError'
export const setSEP7Tx = 'wallets:setSEP7Tx'
export const setTrustlineAcceptedAssets = 'wallets:setTrustlineAcceptedAssets'
export const setTrustlineAcceptedAssetsByUsername = 'wallets:setTrustlineAcceptedAssetsByUsername'
export const setTrustlineExpanded = 'wallets:setTrustlineExpanded'
export const setTrustlinePopularAssets = 'wallets:setTrustlinePopularAssets'
export const setTrustlineSearchResults = 'wallets:setTrustlineSearchResults'
export const setTrustlineSearchText = 'wallets:setTrustlineSearchText'
export const showTransaction = 'wallets:showTransaction'
export const staticConfigLoaded = 'wallets:staticConfigLoaded'
export const validateAccountName = 'wallets:validateAccountName'
export const validateSEP7Link = 'wallets:validateSEP7Link'
export const validateSEP7LinkError = 'wallets:validateSEP7LinkError'
export const validateSecretKey = 'wallets:validateSecretKey'
export const validatedAccountName = 'wallets:validatedAccountName'
export const validatedSecretKey = 'wallets:validatedSecretKey'
export const walletDisclaimerReceived = 'wallets:walletDisclaimerReceived'

// Action Creators
/**
 * A response from the service after an account is deleted.
 */
export const createDeletedAccount = (payload?: undefined) => ({
  payload,
  type: deletedAccount as typeof deletedAccount,
})
/**
 * A response from the service after an account is set as the default
 */
export const createDidSetAccountAsDefault = (payload: {readonly accounts: Array<Types.Account>}) => ({
  payload,
  type: didSetAccountAsDefault as typeof didSetAccountAsDefault,
})
/**
 * A response from the service after an account's name is changed
 */
export const createChangedAccountName = (
  payload: {readonly name?: string; readonly account?: Types.Account; readonly error?: string} = {}
) => ({payload, type: changedAccountName as typeof changedAccountName})
/**
 * Accept the Stellar account disclaimer
 */
export const createAcceptDisclaimer = (payload?: undefined) => ({
  payload,
  type: acceptDisclaimer as typeof acceptDisclaimer,
})
/**
 * Accept the prepared SEP7 path payment
 */
export const createAcceptSEP7Path = (payload: {readonly inputURI: string}) => ({
  payload,
  type: acceptSEP7Path as typeof acceptSEP7Path,
})
/**
 * Accept the prepared SEP7 payment
 */
export const createAcceptSEP7Pay = (payload: {readonly amount: string; readonly inputURI: string}) => ({
  payload,
  type: acceptSEP7Pay as typeof acceptSEP7Pay,
})
/**
 * Accept the prepared SEP7 tx
 */
export const createAcceptSEP7Tx = (payload: {readonly inputURI: string}) => ({
  payload,
  type: acceptSEP7Tx as typeof acceptSEP7Tx,
})
/**
 * Add a new wallet to your account
 */
export const createCreateNewAccount = (payload: {
  readonly name: string
  readonly showOnCreation?: boolean
  readonly setBuildingTo?: boolean
}) => ({payload, type: createNewAccount as typeof createNewAccount})
/**
 * Ask the service for current mobile only mode for Stellar account.
 */
export const createLoadMobileOnlyMode = (payload: {readonly accountID: Types.AccountID}) => ({
  payload,
  type: loadMobileOnlyMode as typeof loadMobileOnlyMode,
})
/**
 * Ask the service to validate an account name.
 */
export const createValidateAccountName = (payload: {readonly name: string}) => ({
  payload,
  type: validateAccountName as typeof validateAccountName,
})
/**
 * Ask the service to validate an account secret key.
 */
export const createValidateSecretKey = (payload: {readonly secretKey: HiddenString}) => ({
  payload,
  type: validateSecretKey as typeof validateSecretKey,
})
/**
 * Cancel a payment. Valid for payments of status 'claimable'.
 * If showAccount is true, nav to the currently selected account when done.
 */
export const createCancelPayment = (payload: {
  readonly showAccount?: boolean
  readonly paymentID: Types.PaymentID
}) => ({payload, type: cancelPayment as typeof cancelPayment})
/**
 * Cancel a request. Optionally delete an associated message
 */
export const createCancelRequest = (payload: {
  readonly conversationIDKey?: ChatTypes.ConversationIDKey
  readonly ordinal?: ChatTypes.Ordinal
  readonly requestID: StellarRPCTypes.KeybaseRequestID
}) => ({payload, type: cancelRequest as typeof cancelRequest})
/**
 * Change display currency for an account
 */
export const createChangeDisplayCurrency = (payload: {
  readonly accountID: Types.AccountID
  readonly code: Types.CurrencyCode
}) => ({payload, type: changeDisplayCurrency as typeof changeDisplayCurrency})
/**
 * Change mobile only mode for Stellar account.
 */
export const createChangeMobileOnlyMode = (payload: {
  readonly accountID: Types.AccountID
  readonly enabled: boolean
}) => ({payload, type: changeMobileOnlyMode as typeof changeMobileOnlyMode})
/**
 * Change the default account
 */
export const createSetAccountAsDefault = (payload: {readonly accountID: Types.AccountID}) => ({
  payload,
  type: setAccountAsDefault as typeof setAccountAsDefault,
})
/**
 * Change the name of an account
 */
export const createChangeAccountName = (payload: {
  readonly accountID: Types.AccountID
  readonly name: string
}) => ({payload, type: changeAccountName as typeof changeAccountName})
/**
 * Clear a payment or request that was being prepared
 */
export const createClearBuilding = (payload?: undefined) => ({
  payload,
  type: clearBuilding as typeof clearBuilding,
})
/**
 * Clear a prepared payment once it has been sent or canceled
 */
export const createClearBuiltPayment = (payload?: undefined) => ({
  payload,
  type: clearBuiltPayment as typeof clearBuiltPayment,
})
/**
 * Clear a prepared request once it has been sent or canceled
 */
export const createClearBuiltRequest = (payload?: undefined) => ({
  payload,
  type: clearBuiltRequest as typeof clearBuiltRequest,
})
/**
 * Clear errors from the store at times like opening or closing a form dialog.
 */
export const createClearErrors = (payload?: undefined) => ({payload, type: clearErrors as typeof clearErrors})
/**
 * Clear exported secret keys from our store once they've been seen
 */
export const createSecretKeySeen = (payload: {readonly accountID: Types.AccountID}) => ({
  payload,
  type: secretKeySeen as typeof secretKeySeen,
})
/**
 * Close the send form and show the user their transactions so they can review.
 */
export const createExitFailedPayment = (payload?: undefined) => ({
  payload,
  type: exitFailedPayment as typeof exitFailedPayment,
})
/**
 * Delete an account
 */
export const createDeleteAccount = (payload: {readonly accountID: Types.AccountID}) => ({
  payload,
  type: deleteAccount as typeof deleteAccount,
})
/**
 * Discover whether the user has accepted the Stellar disclaimer
 */
export const createCheckDisclaimer = (payload: {readonly nextScreen: Types.NextScreenAfterAcceptance}) => ({
  payload,
  type: checkDisclaimer as typeof checkDisclaimer,
})
/**
 * Export a Stellar account's secret key
 */
export const createExportSecretKey = (payload: {readonly accountID: Types.AccountID}) => ({
  payload,
  type: exportSecretKey as typeof exportSecretKey,
})
/**
 * Failed to send a payment
 */
export const createSentPaymentError = (payload: {readonly error: string}) => ({
  payload,
  type: sentPaymentError as typeof sentPaymentError,
})
/**
 * Handle a SEP6 Deposit link
 */
export const createAssetDeposit = (payload: {
  readonly accountID: Types.AccountID
  readonly code: Types.CurrencyCode
  readonly issuerAccountID: Types.AccountID
}) => ({payload, type: assetDeposit as typeof assetDeposit})
/**
 * Handle a SEP6 Withdraw link
 */
export const createAssetWithdraw = (payload: {
  readonly accountID: Types.AccountID
  readonly code: Types.CurrencyCode
  readonly issuerAccountID: Types.AccountID
}) => ({payload, type: assetWithdraw as typeof assetWithdraw})
/**
 * Initialize and navigate to the send or request form.
 *
 * See docs for `setBuilding*` for param semantics.
 */
export const createOpenSendRequestForm = (
  payload: {
    readonly amount?: string
    readonly currency?: string
    readonly from?: Types.AccountID
    readonly isRequest?: boolean
    readonly publicMemo?: HiddenString
    readonly recipientType?: Types.CounterpartyType
    readonly secretNote?: HiddenString
    readonly to?: string
  } = {}
) => ({payload, type: openSendRequestForm as typeof openSendRequestForm})
/**
 * Link an existing Stellar account with this Keybase user.
 */
export const createLinkExistingAccount = (payload: {
  readonly name: string
  readonly secretKey: HiddenString
  readonly showOnCreation?: boolean
  readonly setBuildingTo?: boolean
}) => ({payload, type: linkExistingAccount as typeof linkExistingAccount})
/**
 * Load display currency for an account
 */
export const createLoadDisplayCurrency = (payload: {
  readonly accountID: Types.AccountID | null
  readonly setBuildingCurrency?: boolean
}) => ({payload, type: loadDisplayCurrency as typeof loadDisplayCurrency})
/**
 * Load extra detail for one given payment
 */
export const createLoadPaymentDetail = (payload: {
  readonly accountID: Types.AccountID
  readonly paymentID: Types.PaymentID
}) => ({payload, type: loadPaymentDetail as typeof loadPaymentDetail})
/**
 * Load valid assets for sending to user
 */
export const createLoadSendAssetChoices = (payload: {
  readonly from: Types.AccountID
  readonly to: string
}) => ({payload, type: loadSendAssetChoices as typeof loadSendAssetChoices})
/**
 * Load valid display currencies to choose from
 */
export const createLoadDisplayCurrencies = (payload?: undefined) => ({
  payload,
  type: loadDisplayCurrencies as typeof loadDisplayCurrencies,
})
/**
 * Load wallet disclaimer
 */
export const createLoadWalletDisclaimer = (payload?: undefined) => ({
  payload,
  type: loadWalletDisclaimer as typeof loadWalletDisclaimer,
})
/**
 * Mark the given payment ID and anything older as read.
 */
export const createMarkAsRead = (payload: {
  readonly accountID: Types.AccountID
  readonly mostRecentID: Types.PaymentID
}) => ({payload, type: markAsRead as typeof markAsRead})
/**
 * Move to the confirm screen on a built payment.
 */
export const createReviewPayment = (payload?: undefined) => ({
  payload,
  type: reviewPayment as typeof reviewPayment,
})
/**
 * Navigate to the details page for the given transaction.
 */
export const createShowTransaction = (payload: {
  readonly accountID: Types.AccountID
  readonly paymentID: Types.PaymentID
}) => ({payload, type: showTransaction as typeof showTransaction})
/**
 * Perform sending a payment
 */
export const createSendPayment = (payload?: undefined) => ({payload, type: sendPayment as typeof sendPayment})
/**
 * Prepare a SEP7 tx to be shown to the user for confirmation
 */
export const createSetSEP7Tx = (payload: {
  readonly confirmURI: string
  readonly fromQR: boolean
  readonly tx: Types.SEP7ConfirmInfo
}) => ({payload, type: setSEP7Tx as typeof setSEP7Tx})
/**
 * Received a fresh first page of recent payments
 */
export const createRecentPaymentsReceived = (payload: {
  readonly accountID: Types.AccountID
  readonly paymentCursor: StellarRPCTypes.PageCursor | null
  readonly oldestUnread: Types.PaymentID
  readonly payments: Array<Types.PaymentResult>
}) => ({payload, type: recentPaymentsReceived as typeof recentPaymentsReceived})
/**
 * Received a new set of pending payments; replace existing ones with these
 */
export const createPendingPaymentsReceived = (payload: {
  readonly accountID: Types.AccountID
  readonly pending: Array<Types.PaymentResult>
}) => ({payload, type: pendingPaymentsReceived as typeof pendingPaymentsReceived})
/**
 * Received wallet disclaimer
 */
export const createWalletDisclaimerReceived = (payload: {readonly accepted: boolean}) => ({
  payload,
  type: walletDisclaimerReceived as typeof walletDisclaimerReceived,
})
/**
 * Refresh our list of accounts
 */
export const createLoadAccounts = (payload: {readonly reason: 'initial-load' | 'open-send-req-form'}) => ({
  payload,
  type: loadAccounts as typeof loadAccounts,
})
/**
 * Refresh our list of assets for a given account
 */
export const createLoadAssets = (payload: {readonly accountID: Types.AccountID}) => ({
  payload,
  type: loadAssets as typeof loadAssets,
})
/**
 * Refresh our list of external tools and partner links
 */
export const createLoadExternalPartners = (payload?: undefined) => ({
  payload,
  type: loadExternalPartners as typeof loadExternalPartners,
})
/**
 * Refresh our list of payments for a given account
 */
export const createLoadPayments = (payload: {readonly accountID: Types.AccountID}) => ({
  payload,
  type: loadPayments as typeof loadPayments,
})
/**
 * Reject (temporarily) the Stellar account disclaimer
 */
export const createRejectDisclaimer = (payload?: undefined) => ({
  payload,
  type: rejectDisclaimer as typeof rejectDisclaimer,
})
/**
 * Request payment
 */
export const createRequestPayment = (payload?: undefined) => ({
  payload,
  type: requestPayment as typeof requestPayment,
})
/**
 * Reset to the pre-accepting-disclaimer state.
 */
export const createResetAcceptingDisclaimer = (payload?: undefined) => ({
  payload,
  type: resetAcceptingDisclaimer as typeof resetAcceptingDisclaimer,
})
/**
 * Scrolled down the list of payments for a given account
 */
export const createLoadMorePayments = (payload: {readonly accountID: Types.AccountID}) => ({
  payload,
  type: loadMorePayments as typeof loadMorePayments,
})
/**
 * Select an account. Optionally navigate to the account page.
 */
export const createSelectAccount = (payload: {
  readonly accountID: Types.AccountID
  readonly reason: 'user-selected' | 'auto-selected' | 'from-chat' | 'show-transaction'
  readonly show?: boolean
}) => ({payload, type: selectAccount as typeof selectAccount})
/**
 * Send a potential payment to the service for validation
 */
export const createBuildPayment = (payload?: undefined) => ({
  payload,
  type: buildPayment as typeof buildPayment,
})
/**
 * Set building amount
 */
export const createSetBuildingAmount = (payload: {readonly amount: string}) => ({
  payload,
  type: setBuildingAmount as typeof setBuildingAmount,
})
/**
 * Set building currency
 */
export const createSetBuildingCurrency = (payload: {readonly currency: string}) => ({
  payload,
  type: setBuildingCurrency as typeof setBuildingCurrency,
})
/**
 * Set building from
 */
export const createSetBuildingFrom = (payload: {readonly from: Types.AccountID}) => ({
  payload,
  type: setBuildingFrom as typeof setBuildingFrom,
})
/**
 * Set building isRequest
 */
export const createSetBuildingIsRequest = (payload: {readonly isRequest: boolean}) => ({
  payload,
  type: setBuildingIsRequest as typeof setBuildingIsRequest,
})
/**
 * Set building public memo
 */
export const createSetBuildingPublicMemo = (payload: {readonly publicMemo: HiddenString}) => ({
  payload,
  type: setBuildingPublicMemo as typeof setBuildingPublicMemo,
})
/**
 * Set building recipient type
 */
export const createSetBuildingRecipientType = (payload: {
  readonly recipientType: Types.CounterpartyType
}) => ({payload, type: setBuildingRecipientType as typeof setBuildingRecipientType})
/**
 * Set building secret note
 */
export const createSetBuildingSecretNote = (payload: {readonly secretNote: HiddenString}) => ({
  payload,
  type: setBuildingSecretNote as typeof setBuildingSecretNote,
})
/**
 * Set building to -- depends on recipientType
 */
export const createSetBuildingTo = (payload: {readonly to: string}) => ({
  payload,
  type: setBuildingTo as typeof setBuildingTo,
})
/**
 * Set the error field for SEP7 accepted tx attempt
 */
export const createSetSEP7SendError = (payload: {readonly error: string}) => ({
  payload,
  type: setSEP7SendError as typeof setSEP7SendError,
})
/**
 * Set the error field for a SEP7 validation.
 */
export const createValidateSEP7LinkError = (payload: {readonly error: string}) => ({
  payload,
  type: validateSEP7LinkError as typeof validateSEP7LinkError,
})
/**
 * Set whether last currency used to send was XLM
 */
export const createSetLastSentXLM = (payload: {
  readonly lastSentXLM: boolean
  readonly writeFile: boolean
}) => ({payload, type: setLastSentXLM as typeof setLastSentXLM})
/**
 * Set whether the payment is ready to review
 */
export const createSetReadyToReview = (payload: {readonly readyToReview: boolean}) => ({
  payload,
  type: setReadyToReview as typeof setReadyToReview,
})
/**
 * Show the user an external message from a SEP6 action
 */
export const createSetSEP6Message = (payload: {readonly error: boolean; readonly message: string}) => ({
  payload,
  type: setSEP6Message as typeof setSEP6Message,
})
/**
 * Signal that a payment being built is abandoned and reset the form fields to their initial states.
 */
export const createAbandonPayment = (payload?: undefined) => ({
  payload,
  type: abandonPayment as typeof abandonPayment,
})
/**
 * Static configuration info was loaded from the service.
 */
export const createStaticConfigLoaded = (payload: {readonly staticConfig: Types.StaticConfig}) => ({
  payload,
  type: staticConfigLoaded as typeof staticConfigLoaded,
})
/**
 * Successfully request payment
 */
export const createRequestedPayment = (payload: {
  readonly kbRqID: HiddenString
  readonly lastSentXLM: boolean
  readonly requestee: string
}) => ({payload, type: requestedPayment as typeof requestedPayment})
/**
 * Successfully sent a payment
 */
export const createSentPayment = (payload: {
  readonly kbTxID: HiddenString
  readonly lastSentXLM: boolean
  readonly jumpToChat: string
}) => ({payload, type: sentPayment as typeof sentPayment})
/**
 * The service has responded with mobile only mode for Stellar account.
 */
export const createLoadedMobileOnlyMode = (payload: {
  readonly accountID: Types.AccountID
  readonly enabled: boolean
}) => ({payload, type: loadedMobileOnlyMode as typeof loadedMobileOnlyMode})
/**
 * The service responded with an error or that the account name is valid.
 */
export const createValidatedAccountName = (payload: {readonly name: string; readonly error?: string}) => ({
  payload,
  type: validatedAccountName as typeof validatedAccountName,
})
/**
 * The service responded with an error or that the create new account operation succeeded
 */
export const createCreatedNewAccount = (payload: {
  readonly accountID: Types.AccountID
  readonly showOnCreation?: boolean
  readonly setBuildingTo?: boolean
  readonly name?: string
  readonly error?: string
}) => ({payload, type: createdNewAccount as typeof createdNewAccount})
/**
 * The service responded with an error or that the link existing operation succeeded
 */
export const createLinkedExistingAccount = (payload: {
  readonly accountID: Types.AccountID
  readonly showOnCreation?: boolean
  readonly setBuildingTo?: boolean
  readonly name?: string
  readonly secretKey?: HiddenString
  readonly error?: string
}) => ({payload, type: linkedExistingAccount as typeof linkedExistingAccount})
/**
 * The service responded with an error or that the secret key is valid.
 */
export const createValidatedSecretKey = (payload: {
  readonly secretKey: HiddenString
  readonly error?: string
}) => ({payload, type: validatedSecretKey as typeof validatedSecretKey})
/**
 * Update a payment with additional detail
 */
export const createPaymentDetailReceived = (payload: {
  readonly accountID: Types.AccountID
  readonly payment: Types.PaymentDetail
}) => ({payload, type: paymentDetailReceived as typeof paymentDetailReceived})
/**
 * Update badges in the nav
 */
export const createBadgesUpdated = (payload: {readonly accounts: Array<RPCTypes.WalletAccountInfo>}) => ({
  payload,
  type: badgesUpdated as typeof badgesUpdated,
})
/**
 * Update display currency for a certain account
 */
export const createDisplayCurrencyReceived = (payload: {
  readonly accountID: Types.AccountID | null
  readonly currency: Types.Currency
  readonly setBuildingCurrency?: boolean
}) => ({payload, type: displayCurrencyReceived as typeof displayCurrencyReceived})
/**
 * Update our list of external tools and partners
 */
export const createExternalPartnersReceived = (payload: {
  readonly externalPartners: Array<Types.PartnerUrl>
}) => ({payload, type: externalPartnersReceived as typeof externalPartnersReceived})
/**
 * Update our store of account data
 */
export const createAccountsReceived = (payload: {readonly accounts: Array<Types.Account>}) => ({
  payload,
  type: accountsReceived as typeof accountsReceived,
})
/**
 * Update our store of assets data
 */
export const createAssetsReceived = (payload: {
  readonly accountID: Types.AccountID
  readonly assets: Array<Types.Assets>
}) => ({payload, type: assetsReceived as typeof assetsReceived})
/**
 * Update our store of payments data
 */
export const createPaymentsReceived = (payload: {
  readonly accountID: Types.AccountID
  readonly error: string
  readonly allowClearOldestUnread: boolean
  readonly paymentCursor: StellarRPCTypes.PageCursor | null
  readonly oldestUnread: Types.PaymentID
  readonly payments: Array<Types.PaymentResult>
  readonly pending: Array<Types.PaymentResult>
}) => ({payload, type: paymentsReceived as typeof paymentsReceived})
/**
 * Update our store with a prepared payment
 */
export const createBuiltPaymentReceived = (payload: {
  readonly build: Types.BuiltPayment
  readonly forBuildCounter: number
}) => ({payload, type: builtPaymentReceived as typeof builtPaymentReceived})
/**
 * Update our store with a prepared payment
 */
export const createBuiltRequestReceived = (payload: {
  readonly build: Types.BuiltRequest
  readonly forBuildCounter: number
}) => ({payload, type: builtRequestReceived as typeof builtRequestReceived})
/**
 * Update our store with an ID for a new building payment
 */
export const createBuildingPaymentIDReceived = (payload: {readonly bid: string}) => ({
  payload,
  type: buildingPaymentIDReceived as typeof buildingPaymentIDReceived,
})
/**
 * Update our store with an exported secret key
 */
export const createSecretKeyReceived = (payload: {
  readonly accountID: Types.AccountID
  readonly secretKey: HiddenString
}) => ({payload, type: secretKeyReceived as typeof secretKeyReceived})
/**
 * Update our store with the results of reviewing a built payment
 */
export const createReviewedPaymentReceived = (payload: {
  readonly bid: string
  readonly reviewID: number
  readonly seqno: number
  readonly nextButton: string
  readonly banners?: Array<StellarRPCTypes.SendBannerLocal> | null
}) => ({payload, type: reviewedPaymentReceived as typeof reviewedPaymentReceived})
/**
 * Update valid display currencies to choose from
 */
export const createDisplayCurrenciesReceived = (payload: {readonly currencies: Array<Types.Currency>}) => ({
  payload,
  type: displayCurrenciesReceived as typeof displayCurrenciesReceived,
})
/**
 * Update valid send assets to choose from
 */
export const createSendAssetChoicesReceived = (payload: {
  readonly sendAssetChoices: Array<StellarRPCTypes.SendAssetChoiceLocal>
}) => ({payload, type: sendAssetChoicesReceived as typeof sendAssetChoicesReceived})
/**
 * Validate and handle a SEP7 Stellar URL link sent to the app.
 */
export const createValidateSEP7Link = (payload: {readonly fromQR: boolean; readonly link: string}) => ({
  payload,
  type: validateSEP7Link as typeof validateSEP7Link,
})
/**
 * We received an updated account record
 */
export const createAccountUpdateReceived = (payload: {readonly account: Types.Account}) => ({
  payload,
  type: accountUpdateReceived as typeof accountUpdateReceived,
})
/**
 * replace the current buildingAdvanced builtPaymentAdvanced data with an empty ones
 */
export const createClearBuildingAdvanced = (payload?: undefined) => ({
  payload,
  type: clearBuildingAdvanced as typeof clearBuildingAdvanced,
})
/**
 * tell service to send this path payment
 */
export const createSendPaymentAdvanced = (payload?: undefined) => ({
  payload,
  type: sendPaymentAdvanced as typeof sendPaymentAdvanced,
})
export const createAddTrustline = (payload: {
  readonly accountID: Types.AccountID
  readonly assetID: Types.AssetID
}) => ({payload, type: addTrustline as typeof addTrustline})
export const createCalculateBuildingAdvanced = (payload: {readonly forSEP7: boolean}) => ({
  payload,
  type: calculateBuildingAdvanced as typeof calculateBuildingAdvanced,
})
export const createChangedTrustline = (payload: {readonly error?: string} = {}) => ({
  payload,
  type: changedTrustline as typeof changedTrustline,
})
export const createClearTrustlineSearchResults = (payload?: undefined) => ({
  payload,
  type: clearTrustlineSearchResults as typeof clearTrustlineSearchResults,
})
export const createDeleteTrustline = (payload: {
  readonly accountID: Types.AccountID
  readonly assetID: Types.AssetID
}) => ({payload, type: deleteTrustline as typeof deleteTrustline})
export const createRefreshTrustlineAcceptedAssets = (payload: {readonly accountID: Types.AccountID}) => ({
  payload,
  type: refreshTrustlineAcceptedAssets as typeof refreshTrustlineAcceptedAssets,
})
export const createRefreshTrustlineAcceptedAssetsByUsername = (payload: {readonly username: string}) => ({
  payload,
  type: refreshTrustlineAcceptedAssetsByUsername as typeof refreshTrustlineAcceptedAssetsByUsername,
})
export const createRefreshTrustlinePopularAssets = (payload?: undefined) => ({
  payload,
  type: refreshTrustlinePopularAssets as typeof refreshTrustlinePopularAssets,
})
export const createSetBuildingAdvancedPublicMemo = (payload: {readonly publicMemo: HiddenString}) => ({
  payload,
  type: setBuildingAdvancedPublicMemo as typeof setBuildingAdvancedPublicMemo,
})
export const createSetBuildingAdvancedRecipient = (payload: {readonly recipient: string}) => ({
  payload,
  type: setBuildingAdvancedRecipient as typeof setBuildingAdvancedRecipient,
})
export const createSetBuildingAdvancedRecipientAmount = (payload: {readonly recipientAmount: string}) => ({
  payload,
  type: setBuildingAdvancedRecipientAmount as typeof setBuildingAdvancedRecipientAmount,
})
export const createSetBuildingAdvancedRecipientAsset = (payload: {
  readonly recipientAsset: Types.AssetDescriptionOrNative
}) => ({payload, type: setBuildingAdvancedRecipientAsset as typeof setBuildingAdvancedRecipientAsset})
export const createSetBuildingAdvancedRecipientType = (payload: {
  readonly recipientType: Types.CounterpartyType
}) => ({payload, type: setBuildingAdvancedRecipientType as typeof setBuildingAdvancedRecipientType})
export const createSetBuildingAdvancedSecretNote = (payload: {readonly secretNote: HiddenString}) => ({
  payload,
  type: setBuildingAdvancedSecretNote as typeof setBuildingAdvancedSecretNote,
})
export const createSetBuildingAdvancedSenderAccountID = (payload: {
  readonly senderAccountID: Types.AccountID
}) => ({payload, type: setBuildingAdvancedSenderAccountID as typeof setBuildingAdvancedSenderAccountID})
export const createSetBuildingAdvancedSenderAsset = (payload: {
  readonly senderAsset: Types.AssetDescriptionOrNative
}) => ({payload, type: setBuildingAdvancedSenderAsset as typeof setBuildingAdvancedSenderAsset})
export const createSetBuiltPaymentAdvanced = (payload: {
  readonly builtPaymentAdvanced: Types.BuiltPaymentAdvanced
  readonly forSEP7: boolean
}) => ({payload, type: setBuiltPaymentAdvanced as typeof setBuiltPaymentAdvanced})
export const createSetTrustlineAcceptedAssets = (payload: {
  readonly accountID: Types.AccountID
  readonly assets: Array<Types.AssetDescription>
  readonly limits: Map<Types.AssetID, number>
}) => ({payload, type: setTrustlineAcceptedAssets as typeof setTrustlineAcceptedAssets})
export const createSetTrustlineAcceptedAssetsByUsername = (payload: {
  readonly username: string
  readonly assets: Array<Types.AssetDescription>
  readonly limits: Map<Types.AssetID, number>
}) => ({payload, type: setTrustlineAcceptedAssetsByUsername as typeof setTrustlineAcceptedAssetsByUsername})
export const createSetTrustlineExpanded = (payload: {
  readonly expanded: boolean
  readonly assetID: Types.AssetID
}) => ({payload, type: setTrustlineExpanded as typeof setTrustlineExpanded})
export const createSetTrustlinePopularAssets = (payload: {
  readonly assets: Array<Types.AssetDescription>
  readonly totalCount: number
}) => ({payload, type: setTrustlinePopularAssets as typeof setTrustlinePopularAssets})
export const createSetTrustlineSearchResults = (payload: {
  readonly assets: Array<Types.AssetDescription>
}) => ({payload, type: setTrustlineSearchResults as typeof setTrustlineSearchResults})
export const createSetTrustlineSearchText = (payload: {readonly text: string}) => ({
  payload,
  type: setTrustlineSearchText as typeof setTrustlineSearchText,
})

// Action Payloads
export type AbandonPaymentPayload = ReturnType<typeof createAbandonPayment>
export type AcceptDisclaimerPayload = ReturnType<typeof createAcceptDisclaimer>
export type AcceptSEP7PathPayload = ReturnType<typeof createAcceptSEP7Path>
export type AcceptSEP7PayPayload = ReturnType<typeof createAcceptSEP7Pay>
export type AcceptSEP7TxPayload = ReturnType<typeof createAcceptSEP7Tx>
export type AccountUpdateReceivedPayload = ReturnType<typeof createAccountUpdateReceived>
export type AccountsReceivedPayload = ReturnType<typeof createAccountsReceived>
export type AddTrustlinePayload = ReturnType<typeof createAddTrustline>
export type AssetDepositPayload = ReturnType<typeof createAssetDeposit>
export type AssetWithdrawPayload = ReturnType<typeof createAssetWithdraw>
export type AssetsReceivedPayload = ReturnType<typeof createAssetsReceived>
export type BadgesUpdatedPayload = ReturnType<typeof createBadgesUpdated>
export type BuildPaymentPayload = ReturnType<typeof createBuildPayment>
export type BuildingPaymentIDReceivedPayload = ReturnType<typeof createBuildingPaymentIDReceived>
export type BuiltPaymentReceivedPayload = ReturnType<typeof createBuiltPaymentReceived>
export type BuiltRequestReceivedPayload = ReturnType<typeof createBuiltRequestReceived>
export type CalculateBuildingAdvancedPayload = ReturnType<typeof createCalculateBuildingAdvanced>
export type CancelPaymentPayload = ReturnType<typeof createCancelPayment>
export type CancelRequestPayload = ReturnType<typeof createCancelRequest>
export type ChangeAccountNamePayload = ReturnType<typeof createChangeAccountName>
export type ChangeDisplayCurrencyPayload = ReturnType<typeof createChangeDisplayCurrency>
export type ChangeMobileOnlyModePayload = ReturnType<typeof createChangeMobileOnlyMode>
export type ChangedAccountNamePayload = ReturnType<typeof createChangedAccountName>
export type ChangedTrustlinePayload = ReturnType<typeof createChangedTrustline>
export type CheckDisclaimerPayload = ReturnType<typeof createCheckDisclaimer>
export type ClearBuildingAdvancedPayload = ReturnType<typeof createClearBuildingAdvanced>
export type ClearBuildingPayload = ReturnType<typeof createClearBuilding>
export type ClearBuiltPaymentPayload = ReturnType<typeof createClearBuiltPayment>
export type ClearBuiltRequestPayload = ReturnType<typeof createClearBuiltRequest>
export type ClearErrorsPayload = ReturnType<typeof createClearErrors>
export type ClearTrustlineSearchResultsPayload = ReturnType<typeof createClearTrustlineSearchResults>
export type CreateNewAccountPayload = ReturnType<typeof createCreateNewAccount>
export type CreatedNewAccountPayload = ReturnType<typeof createCreatedNewAccount>
export type DeleteAccountPayload = ReturnType<typeof createDeleteAccount>
export type DeleteTrustlinePayload = ReturnType<typeof createDeleteTrustline>
export type DeletedAccountPayload = ReturnType<typeof createDeletedAccount>
export type DidSetAccountAsDefaultPayload = ReturnType<typeof createDidSetAccountAsDefault>
export type DisplayCurrenciesReceivedPayload = ReturnType<typeof createDisplayCurrenciesReceived>
export type DisplayCurrencyReceivedPayload = ReturnType<typeof createDisplayCurrencyReceived>
export type ExitFailedPaymentPayload = ReturnType<typeof createExitFailedPayment>
export type ExportSecretKeyPayload = ReturnType<typeof createExportSecretKey>
export type ExternalPartnersReceivedPayload = ReturnType<typeof createExternalPartnersReceived>
export type LinkExistingAccountPayload = ReturnType<typeof createLinkExistingAccount>
export type LinkedExistingAccountPayload = ReturnType<typeof createLinkedExistingAccount>
export type LoadAccountsPayload = ReturnType<typeof createLoadAccounts>
export type LoadAssetsPayload = ReturnType<typeof createLoadAssets>
export type LoadDisplayCurrenciesPayload = ReturnType<typeof createLoadDisplayCurrencies>
export type LoadDisplayCurrencyPayload = ReturnType<typeof createLoadDisplayCurrency>
export type LoadExternalPartnersPayload = ReturnType<typeof createLoadExternalPartners>
export type LoadMobileOnlyModePayload = ReturnType<typeof createLoadMobileOnlyMode>
export type LoadMorePaymentsPayload = ReturnType<typeof createLoadMorePayments>
export type LoadPaymentDetailPayload = ReturnType<typeof createLoadPaymentDetail>
export type LoadPaymentsPayload = ReturnType<typeof createLoadPayments>
export type LoadSendAssetChoicesPayload = ReturnType<typeof createLoadSendAssetChoices>
export type LoadWalletDisclaimerPayload = ReturnType<typeof createLoadWalletDisclaimer>
export type LoadedMobileOnlyModePayload = ReturnType<typeof createLoadedMobileOnlyMode>
export type MarkAsReadPayload = ReturnType<typeof createMarkAsRead>
export type OpenSendRequestFormPayload = ReturnType<typeof createOpenSendRequestForm>
export type PaymentDetailReceivedPayload = ReturnType<typeof createPaymentDetailReceived>
export type PaymentsReceivedPayload = ReturnType<typeof createPaymentsReceived>
export type PendingPaymentsReceivedPayload = ReturnType<typeof createPendingPaymentsReceived>
export type RecentPaymentsReceivedPayload = ReturnType<typeof createRecentPaymentsReceived>
export type RefreshTrustlineAcceptedAssetsByUsernamePayload = ReturnType<
  typeof createRefreshTrustlineAcceptedAssetsByUsername
>
export type RefreshTrustlineAcceptedAssetsPayload = ReturnType<typeof createRefreshTrustlineAcceptedAssets>
export type RefreshTrustlinePopularAssetsPayload = ReturnType<typeof createRefreshTrustlinePopularAssets>
export type RejectDisclaimerPayload = ReturnType<typeof createRejectDisclaimer>
export type RequestPaymentPayload = ReturnType<typeof createRequestPayment>
export type RequestedPaymentPayload = ReturnType<typeof createRequestedPayment>
export type ResetAcceptingDisclaimerPayload = ReturnType<typeof createResetAcceptingDisclaimer>
export type ReviewPaymentPayload = ReturnType<typeof createReviewPayment>
export type ReviewedPaymentReceivedPayload = ReturnType<typeof createReviewedPaymentReceived>
export type SecretKeyReceivedPayload = ReturnType<typeof createSecretKeyReceived>
export type SecretKeySeenPayload = ReturnType<typeof createSecretKeySeen>
export type SelectAccountPayload = ReturnType<typeof createSelectAccount>
export type SendAssetChoicesReceivedPayload = ReturnType<typeof createSendAssetChoicesReceived>
export type SendPaymentAdvancedPayload = ReturnType<typeof createSendPaymentAdvanced>
export type SendPaymentPayload = ReturnType<typeof createSendPayment>
export type SentPaymentErrorPayload = ReturnType<typeof createSentPaymentError>
export type SentPaymentPayload = ReturnType<typeof createSentPayment>
export type SetAccountAsDefaultPayload = ReturnType<typeof createSetAccountAsDefault>
export type SetBuildingAdvancedPublicMemoPayload = ReturnType<typeof createSetBuildingAdvancedPublicMemo>
export type SetBuildingAdvancedRecipientAmountPayload = ReturnType<
  typeof createSetBuildingAdvancedRecipientAmount
>
export type SetBuildingAdvancedRecipientAssetPayload = ReturnType<
  typeof createSetBuildingAdvancedRecipientAsset
>
export type SetBuildingAdvancedRecipientPayload = ReturnType<typeof createSetBuildingAdvancedRecipient>
export type SetBuildingAdvancedRecipientTypePayload = ReturnType<
  typeof createSetBuildingAdvancedRecipientType
>
export type SetBuildingAdvancedSecretNotePayload = ReturnType<typeof createSetBuildingAdvancedSecretNote>
export type SetBuildingAdvancedSenderAccountIDPayload = ReturnType<
  typeof createSetBuildingAdvancedSenderAccountID
>
export type SetBuildingAdvancedSenderAssetPayload = ReturnType<typeof createSetBuildingAdvancedSenderAsset>
export type SetBuildingAmountPayload = ReturnType<typeof createSetBuildingAmount>
export type SetBuildingCurrencyPayload = ReturnType<typeof createSetBuildingCurrency>
export type SetBuildingFromPayload = ReturnType<typeof createSetBuildingFrom>
export type SetBuildingIsRequestPayload = ReturnType<typeof createSetBuildingIsRequest>
export type SetBuildingPublicMemoPayload = ReturnType<typeof createSetBuildingPublicMemo>
export type SetBuildingRecipientTypePayload = ReturnType<typeof createSetBuildingRecipientType>
export type SetBuildingSecretNotePayload = ReturnType<typeof createSetBuildingSecretNote>
export type SetBuildingToPayload = ReturnType<typeof createSetBuildingTo>
export type SetBuiltPaymentAdvancedPayload = ReturnType<typeof createSetBuiltPaymentAdvanced>
export type SetLastSentXLMPayload = ReturnType<typeof createSetLastSentXLM>
export type SetReadyToReviewPayload = ReturnType<typeof createSetReadyToReview>
export type SetSEP6MessagePayload = ReturnType<typeof createSetSEP6Message>
export type SetSEP7SendErrorPayload = ReturnType<typeof createSetSEP7SendError>
export type SetSEP7TxPayload = ReturnType<typeof createSetSEP7Tx>
export type SetTrustlineAcceptedAssetsByUsernamePayload = ReturnType<
  typeof createSetTrustlineAcceptedAssetsByUsername
>
export type SetTrustlineAcceptedAssetsPayload = ReturnType<typeof createSetTrustlineAcceptedAssets>
export type SetTrustlineExpandedPayload = ReturnType<typeof createSetTrustlineExpanded>
export type SetTrustlinePopularAssetsPayload = ReturnType<typeof createSetTrustlinePopularAssets>
export type SetTrustlineSearchResultsPayload = ReturnType<typeof createSetTrustlineSearchResults>
export type SetTrustlineSearchTextPayload = ReturnType<typeof createSetTrustlineSearchText>
export type ShowTransactionPayload = ReturnType<typeof createShowTransaction>
export type StaticConfigLoadedPayload = ReturnType<typeof createStaticConfigLoaded>
export type ValidateAccountNamePayload = ReturnType<typeof createValidateAccountName>
export type ValidateSEP7LinkErrorPayload = ReturnType<typeof createValidateSEP7LinkError>
export type ValidateSEP7LinkPayload = ReturnType<typeof createValidateSEP7Link>
export type ValidateSecretKeyPayload = ReturnType<typeof createValidateSecretKey>
export type ValidatedAccountNamePayload = ReturnType<typeof createValidatedAccountName>
export type ValidatedSecretKeyPayload = ReturnType<typeof createValidatedSecretKey>
export type WalletDisclaimerReceivedPayload = ReturnType<typeof createWalletDisclaimerReceived>

// All Actions
// prettier-ignore
export type Actions =
  | AbandonPaymentPayload
  | AcceptDisclaimerPayload
  | AcceptSEP7PathPayload
  | AcceptSEP7PayPayload
  | AcceptSEP7TxPayload
  | AccountUpdateReceivedPayload
  | AccountsReceivedPayload
  | AddTrustlinePayload
  | AssetDepositPayload
  | AssetWithdrawPayload
  | AssetsReceivedPayload
  | BadgesUpdatedPayload
  | BuildPaymentPayload
  | BuildingPaymentIDReceivedPayload
  | BuiltPaymentReceivedPayload
  | BuiltRequestReceivedPayload
  | CalculateBuildingAdvancedPayload
  | CancelPaymentPayload
  | CancelRequestPayload
  | ChangeAccountNamePayload
  | ChangeDisplayCurrencyPayload
  | ChangeMobileOnlyModePayload
  | ChangedAccountNamePayload
  | ChangedTrustlinePayload
  | CheckDisclaimerPayload
  | ClearBuildingAdvancedPayload
  | ClearBuildingPayload
  | ClearBuiltPaymentPayload
  | ClearBuiltRequestPayload
  | ClearErrorsPayload
  | ClearTrustlineSearchResultsPayload
  | CreateNewAccountPayload
  | CreatedNewAccountPayload
  | DeleteAccountPayload
  | DeleteTrustlinePayload
  | DeletedAccountPayload
  | DidSetAccountAsDefaultPayload
  | DisplayCurrenciesReceivedPayload
  | DisplayCurrencyReceivedPayload
  | ExitFailedPaymentPayload
  | ExportSecretKeyPayload
  | ExternalPartnersReceivedPayload
  | LinkExistingAccountPayload
  | LinkedExistingAccountPayload
  | LoadAccountsPayload
  | LoadAssetsPayload
  | LoadDisplayCurrenciesPayload
  | LoadDisplayCurrencyPayload
  | LoadExternalPartnersPayload
  | LoadMobileOnlyModePayload
  | LoadMorePaymentsPayload
  | LoadPaymentDetailPayload
  | LoadPaymentsPayload
  | LoadSendAssetChoicesPayload
  | LoadWalletDisclaimerPayload
  | LoadedMobileOnlyModePayload
  | MarkAsReadPayload
  | OpenSendRequestFormPayload
  | PaymentDetailReceivedPayload
  | PaymentsReceivedPayload
  | PendingPaymentsReceivedPayload
  | RecentPaymentsReceivedPayload
  | RefreshTrustlineAcceptedAssetsByUsernamePayload
  | RefreshTrustlineAcceptedAssetsPayload
  | RefreshTrustlinePopularAssetsPayload
  | RejectDisclaimerPayload
  | RequestPaymentPayload
  | RequestedPaymentPayload
  | ResetAcceptingDisclaimerPayload
  | ReviewPaymentPayload
  | ReviewedPaymentReceivedPayload
  | SecretKeyReceivedPayload
  | SecretKeySeenPayload
  | SelectAccountPayload
  | SendAssetChoicesReceivedPayload
  | SendPaymentAdvancedPayload
  | SendPaymentPayload
  | SentPaymentErrorPayload
  | SentPaymentPayload
  | SetAccountAsDefaultPayload
  | SetBuildingAdvancedPublicMemoPayload
  | SetBuildingAdvancedRecipientAmountPayload
  | SetBuildingAdvancedRecipientAssetPayload
  | SetBuildingAdvancedRecipientPayload
  | SetBuildingAdvancedRecipientTypePayload
  | SetBuildingAdvancedSecretNotePayload
  | SetBuildingAdvancedSenderAccountIDPayload
  | SetBuildingAdvancedSenderAssetPayload
  | SetBuildingAmountPayload
  | SetBuildingCurrencyPayload
  | SetBuildingFromPayload
  | SetBuildingIsRequestPayload
  | SetBuildingPublicMemoPayload
  | SetBuildingRecipientTypePayload
  | SetBuildingSecretNotePayload
  | SetBuildingToPayload
  | SetBuiltPaymentAdvancedPayload
  | SetLastSentXLMPayload
  | SetReadyToReviewPayload
  | SetSEP6MessagePayload
  | SetSEP7SendErrorPayload
  | SetSEP7TxPayload
  | SetTrustlineAcceptedAssetsByUsernamePayload
  | SetTrustlineAcceptedAssetsPayload
  | SetTrustlineExpandedPayload
  | SetTrustlinePopularAssetsPayload
  | SetTrustlineSearchResultsPayload
  | SetTrustlineSearchTextPayload
  | ShowTransactionPayload
  | StaticConfigLoadedPayload
  | ValidateAccountNamePayload
  | ValidateSEP7LinkErrorPayload
  | ValidateSEP7LinkPayload
  | ValidateSecretKeyPayload
  | ValidatedAccountNamePayload
  | ValidatedSecretKeyPayload
  | WalletDisclaimerReceivedPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
