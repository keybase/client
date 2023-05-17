import {ParticipantsKeybaseUser, ParticipantsStellarPublicKey, ParticipantsOtherAccount} from '.'
import * as ProfileGen from '../../../actions/profile-gen'
import * as WalletsGen from '../../../actions/wallets-gen'
import * as Tracker2Gen from '../../../actions/tracker2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/wallets'
import * as Types from '../../../constants/types/wallets'
import {anyWaiting} from '../../../constants/waiting'
import * as Container from '../../../util/container'
import {appendWalletPersonBuilder} from '../../../actions/typed-routes'

const ConnectedParticipantsKeybaseUser = () => {
  const build = Container.useSelector(state => state.wallets.building)
  const built = Container.useSelector(state =>
    build.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment
  )

  // If build.to is set, assume it's a valid username.
  const errorMessage = built.toErrMsg
  const isRequest = build.isRequest
  const recipientUsername = build.to

  const dispatch = Container.useDispatch()
  const onChangeRecipient = (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  }
  const onOpenTracker = (username: string) => {
    dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
  }
  const onOpenUserProfile = (username: string) => {
    dispatch(ProfileGen.createShowUserProfile({username}))
  }
  const onRemoveProfile = () => {
    dispatch(WalletsGen.createSetBuildingTo({to: ''}))
  }
  const onScanQRCode = Container.isMobile
    ? () => {
        dispatch(RouteTreeGen.createNavigateAppend({path: ['qrScan']}))
      }
    : undefined
  const onSearch = () => {
    dispatch(appendWalletPersonBuilder())
  }

  const onShowProfile = Container.isMobile ? onOpenUserProfile : onOpenTracker
  const props = {
    errorMessage,
    isRequest,
    onChangeRecipient,
    onRemoveProfile,
    onScanQRCode,
    onSearch,
    onShowProfile,
    recipientUsername,
  }
  return <ParticipantsKeybaseUser {...props} />
}

const ConnectedParticipantsStellarPublicKey = () => {
  const build = Container.useSelector(state => state.wallets.building)
  const built = Container.useSelector(state =>
    build.isRequest ? state.wallets.builtRequest : state.wallets.builtPayment
  )

  const errorMessage = built.toErrMsg
  const recipientPublicKey = build.to

  const dispatch = Container.useDispatch()
  const onChangeRecipient = (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  }
  const onScanQRCode = Container.isMobile
    ? () => dispatch(RouteTreeGen.createNavigateAppend({path: ['qrScan']}))
    : undefined
  const setReadyToReview = (readyToReview: boolean) => {
    dispatch(WalletsGen.createSetReadyToReview({readyToReview}))
  }
  const props = {
    errorMessage,
    onChangeRecipient,
    onScanQRCode,
    recipientPublicKey,
    setReadyToReview,
  }
  return <ParticipantsStellarPublicKey {...props} />
}

const makeAccount = (stateAccount: Types.Account) => ({
  contents: stateAccount.balanceDescription,
  id: stateAccount.accountID,
  isDefault: stateAccount.isDefault,
  name: stateAccount.name,
  unknown: stateAccount === Constants.unknownAccount,
})

const ConnectedParticipantsOtherAccount = () => {
  const build = Container.useSelector(state => state.wallets.building)

  const fromAccount = Container.useSelector(state => makeAccount(Constants.getAccount(state, build.from)))
  const toAccount = Container.useSelector(state =>
    build.to ? makeAccount(Constants.getAccount(state, Types.stringToAccountID(build.to))) : undefined
  )
  const showSpinner = Container.useSelector(state =>
    toAccount
      ? toAccount.unknown
      : anyWaiting(state, Constants.linkExistingWaitingKey, Constants.createNewAccountWaitingKey)
  )

  const allAccounts = Container.useSelector(state => Constants.getAccounts(state).map(makeAccount))
  const user = Container.useSelector(state => state.config.username)

  const dispatch = Container.useDispatch()
  const onChangeFromAccount = (from: Types.AccountID) => {
    dispatch(WalletsGen.createSetBuildingFrom({from}))
  }
  const onChangeRecipient = (to: string) => {
    dispatch(WalletsGen.createSetBuildingTo({to}))
  }
  const onCreateNewAccount = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {fromSendForm: true}, selected: 'createNewAccount'}],
      })
    )
  }
  const onLinkAccount = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {fromSendForm: true}, selected: 'linkExisting'}],
      })
    )
  }
  const props = {
    allAccounts,
    fromAccount,
    onChangeFromAccount,
    onChangeRecipient,
    onCreateNewAccount,
    onLinkAccount,
    showSpinner,
    toAccount,
    user,
  }
  return <ParticipantsOtherAccount {...props} />
}

const ParticipantsChooser = (props: {recipientType: Types.CounterpartyType}) => {
  switch (props.recipientType) {
    case 'keybaseUser':
      return <ConnectedParticipantsKeybaseUser />
    case 'stellarPublicKey':
      return <ConnectedParticipantsStellarPublicKey />
    case 'otherAccount':
      return <ConnectedParticipantsOtherAccount />
  }
  return null
}

const ConnectedParticipantsChooser = () => {
  const recipientType = Container.useSelector(state => state.wallets.building.recipientType)
  const props = {recipientType}
  return <ParticipantsChooser {...props} />
}

export default ConnectedParticipantsChooser
