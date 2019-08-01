package stellar

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/keybase/client/go/stellar/relays"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
	stellarAddress "github.com/stellar/go/address"
	"github.com/stellar/go/build"
)

const AccountNameMaxRunes = 24

// CreateWallet creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe (but wasteful) to call even if the user has a bundle already.
func CreateWallet(mctx libkb.MetaContext) (created bool, err error) {
	defer mctx.TraceTimed("Stellar.CreateWallet", func() error { return err })()
	loggedInUsername := mctx.ActiveDevice().Username(mctx)
	if !loggedInUsername.IsValid() {
		return false, fmt.Errorf("could not get logged-in username")
	}
	perUserKeyUpgradeSoft(mctx, "create-wallet")
	clearBundle, err := bundle.NewInitial(fmt.Sprintf("%v's account", loggedInUsername))
	if err != nil {
		return false, err
	}
	meUV, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return false, err
	}
	err = remote.PostWithChainlink(mctx, *clearBundle)
	switch e := err.(type) {
	case nil:
		// ok
	case libkb.AppStatusError:
		if keybase1.StatusCode(e.Code) == keybase1.StatusCode_SCStellarWrongRevision {
			// Assume this happened because a bundle already existed.
			// And suppress the error.
			mctx.Debug("suppressing error: %v", err)
			return false, nil
		}
		return false, err
	default:
		return false, err
	}
	getGlobal(mctx.G()).InformHasWallet(mctx.Ctx(), meUV)
	go getGlobal(mctx.G()).KickAutoClaimRunner(mctx.BackgroundWithLogTags(), gregor1.MsgID{})
	return true, nil
}

type CreateWalletGatedResult struct {
	JustCreated        bool  // whether the user's wallet was created by this call
	HasWallet          bool  // whether the user now has a wallet
	AcceptedDisclaimer bool  // whether the user has accepted the disclaimer
	ErrorCreating      error // error encountered while attempting to create the wallet
}

// CreateWalletGated may create a wallet for the user.
// Taking into account settings from the server.
// It should be speedy to call repeatedly _if_ the user gets a wallet.
func CreateWalletGated(mctx libkb.MetaContext) (res CreateWalletGatedResult, err error) {
	defer mctx.TraceTimed("Stellar.CreateWalletGated", func() error { return err })()
	defer func() {
		mctx.Debug("CreateWalletGated: (res:%+v, err:%v)", res, err != nil)
	}()
	res, err = createWalletGatedHelper(mctx)
	if err == nil && res.ErrorCreating != nil {
		// An error was encountered while creating the wallet.
		// This could have been the result of losing a race against other threads.
		// When multiple threads create a wallet only one will succeed.
		// In that case we _do_ have a wallet now even though this thread failed,
		// so run again for an accurate reply.
		return createWalletGatedHelper(mctx)
	}
	return res, err
}

func createWalletGatedHelper(mctx libkb.MetaContext) (res CreateWalletGatedResult, err error) {
	defer mctx.TraceTimed("Stellar.createWalletGatedHelper", func() error { return err })()
	defer func() {
		mctx.Debug("createWalletGatedHelper: (res:%+v, err:%v)", res, err != nil)
	}()
	meUV, err := mctx.G().GetMeUV(mctx.Ctx())
	if err != nil {
		return res, err
	}
	if getGlobal(mctx.G()).CachedHasWallet(mctx.Ctx(), meUV) {
		mctx.Debug("createWalletGatedHelper: local cache says we already have a wallet")
		return CreateWalletGatedResult{
			JustCreated:        false,
			HasWallet:          true,
			AcceptedDisclaimer: true, // because it should be impossible to have created a wallet without accepting.
		}, nil
	}
	scr, err := remote.ShouldCreate(mctx.Ctx(), mctx.G())
	if err != nil {
		return res, err
	}
	res.HasWallet = scr.HasWallet
	res.AcceptedDisclaimer = scr.AcceptedDisclaimer
	if scr.HasWallet {
		mctx.Debug("createWalletGatedHelper: server says we already have a wallet")
		getGlobal(mctx.G()).InformHasWallet(mctx.Ctx(), meUV)
		return res, nil
	}
	if !scr.ShouldCreate {
		mctx.Debug("createWalletGatedHelper: server did not recommend wallet creation")
		return res, nil
	}
	justCreated, err := CreateWallet(mctx)
	if err != nil {
		mctx.Debug("createWalletGatedHelper: error creating wallet: %v", err)
		res.ErrorCreating = err
		return res, nil
	}
	res.JustCreated = justCreated
	if justCreated {
		res.HasWallet = true
	}
	return res, nil
}

// CreateWalletSoft creates a user's initial wallet if they don't already have one.
// Does not get in the way of intentional user actions.
func CreateWalletSoft(mctx libkb.MetaContext) {
	var err error
	defer mctx.TraceTimed("CreateWalletSoft", func() error { return err })()
	if !mctx.G().LocalSigchainGuard().IsAvailable(mctx.Ctx(), "CreateWalletSoft") {
		err = fmt.Errorf("yielding to guard")
		return
	}
	_, err = CreateWalletGated(mctx)
}

func pushSimpleUpdateForAccount(mctx libkb.MetaContext, accountID stellar1.AccountID) (err error) {
	defer mctx.TraceTimed("Stellar.Upkeep pushSimpleUpdateForAccount", func() error { return err })()
	prevBundle, err := remote.FetchAccountBundle(mctx, accountID)
	if err != nil {
		return err
	}
	nextBundle := bundle.AdvanceAccounts(*prevBundle, []stellar1.AccountID{accountID})
	return remote.Post(mctx, nextBundle)
}

// Upkeep makes sure the bundle is encrypted for the user's latest PUK.
func Upkeep(mctx libkb.MetaContext) (err error) {
	defer mctx.TraceTimed("Stellar.Upkeep", func() error { return err })()
	_, _, prevAccountPukGens, err := remote.FetchBundleWithGens(mctx)
	if err != nil {
		return err
	}
	pukring, err := mctx.G().GetPerUserKeyring(mctx.Ctx())
	if err != nil {
		return err
	}
	err = pukring.Sync(mctx)
	if err != nil {
		return err
	}
	currentPukGen := pukring.CurrentGeneration()
	var madeAnyChanges bool
	for accountID, accountPukGen := range prevAccountPukGens {
		if accountPukGen < currentPukGen {
			madeAnyChanges = true
			mctx.Debug("Stellar.Upkeep: reencrypting %s... for gen %v from gen %v", accountID[:5], currentPukGen, accountPukGen)
			if err = pushSimpleUpdateForAccount(mctx, accountID); err != nil {
				mctx.Debug("Stellar.Upkeep: error reencrypting %v: %v", accountID[:5], err)
				return err
			}
		}
	}
	if !madeAnyChanges {
		mctx.Debug("Stellar.Upkeep: no need to reencrypt. Everything is at gen %v", currentPukGen)
	}
	return nil
}

func ImportSecretKey(mctx libkb.MetaContext, secretKey stellar1.SecretKey, makePrimary bool, accountName string) (err error) {
	prevBundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return err
	}
	nextBundle := bundle.AdvanceBundle(*prevBundle)
	err = bundle.AddAccount(&nextBundle, secretKey, accountName, makePrimary)
	if err != nil {
		return err
	}

	if makePrimary {
		// primary account changes need sigchain link
		// (so other users can find user's primary account id)
		err = remote.PostWithChainlink(mctx, nextBundle)
	} else {
		err = remote.Post(mctx, nextBundle)
	}
	if err != nil {
		return err
	}

	// after import, mark all the transactions in this account as "read"
	// any errors in this process are not fatal, since the important task
	// has been accomplished.
	_, accountID, _, err := libkb.ParseStellarSecretKey(string(secretKey))
	if err != nil {
		mctx.Debug("ImportSecretKey, failed to parse secret key after import: %s", err)
		return nil
	}
	arg := remote.RecentPaymentsArg{
		AccountID:       accountID,
		SkipPending:     true,
		IncludeAdvanced: true,
	}
	page, err := remote.RecentPayments(mctx.Ctx(), mctx.G(), arg)
	if err != nil {
		mctx.Debug("ImportSecretKey, RecentPayments error: %s", err)
		return nil
	}
	if len(page.Payments) == 0 {
		return nil
	}
	mostRecentID, err := page.Payments[0].TransactionID()
	if err != nil {
		mctx.Debug("ImportSecretKey, tx id from most recent payment error: %s", err)
		return nil
	}
	if err = remote.MarkAsRead(mctx.Ctx(), mctx.G(), accountID, mostRecentID); err != nil {
		mctx.Debug("ImportSecretKey, markAsRead error: %s", err)
		return nil
	}

	return nil
}

func ExportSecretKey(mctx libkb.MetaContext, accountID stellar1.AccountID) (res stellar1.SecretKey, err error) {
	prevBundle, err := remote.FetchAccountBundle(mctx, accountID)
	if err != nil {
		return res, err
	}
	for _, account := range prevBundle.Accounts {
		if account.AccountID.Eq(accountID) {
			signers := prevBundle.AccountBundles[account.AccountID].Signers
			if len(signers) == 0 {
				return res, fmt.Errorf("no secret keys found for account")
			}
			if len(signers) != 1 {
				return res, fmt.Errorf("expected 1 secret key but found %v", len(signers))
			}
			return signers[0], nil
		}
	}
	_, _, _, parseSecErr := libkb.ParseStellarSecretKey(accountID.String())
	if parseSecErr == nil {
		// Just in case a secret key worked its way in here
		return res, fmt.Errorf("account not found: unexpected secret key")
	}
	return res, fmt.Errorf("account not found: %v", accountID)
}

func OwnAccount(mctx libkb.MetaContext, accountID stellar1.AccountID) (own, isPrimary bool, err error) {
	bundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return false, false, err
	}
	for _, account := range bundle.Accounts {
		if account.AccountID.Eq(accountID) {
			return true, account.IsPrimary, nil
		}
	}
	return false, false, nil
}

func OwnAccountCached(mctx libkb.MetaContext, accountID stellar1.AccountID) (own, isPrimary bool, err error) {
	return getGlobal(mctx.G()).OwnAccountCached(mctx, accountID)
}

func lookupSenderEntry(mctx libkb.MetaContext, accountID stellar1.AccountID) (stellar1.BundleEntry, stellar1.AccountBundle, error) {
	if accountID == "" {
		bundle, err := remote.FetchSecretlessBundle(mctx)
		if err != nil {
			return stellar1.BundleEntry{}, stellar1.AccountBundle{}, err
		}
		entry, err := bundle.PrimaryAccount()
		if err != nil {
			return stellar1.BundleEntry{}, stellar1.AccountBundle{}, err
		}
		accountID = entry.AccountID
	}

	bundle, err := remote.FetchAccountBundle(mctx, accountID)
	switch err := err.(type) {
	case nil:
		// ok
	case libkb.AppStatusError:
		if libkb.IsAppStatusCode(err, keybase1.StatusCode_SCStellarMissingAccount) {
			mctx.Debug("suppressing error: %v", err)
			err = err.WithDesc("Sender account not found")
		}
		return stellar1.BundleEntry{}, stellar1.AccountBundle{}, err
	default:
		return stellar1.BundleEntry{}, stellar1.AccountBundle{}, err
	}

	for _, entry := range bundle.Accounts {
		if entry.AccountID.Eq(accountID) {
			return entry, bundle.AccountBundles[entry.AccountID], nil
		}
	}

	return stellar1.BundleEntry{}, stellar1.AccountBundle{}, libkb.NotFoundError{Msg: fmt.Sprintf("Sender account not found")}
}

func LookupSenderPrimary(mctx libkb.MetaContext) (stellar1.BundleEntry, stellar1.AccountBundle, error) {
	return LookupSender(mctx, "" /* empty account id returns primary */)
}

func LookupSender(mctx libkb.MetaContext, accountID stellar1.AccountID) (stellar1.BundleEntry, stellar1.AccountBundle, error) {
	entry, ab, err := lookupSenderEntry(mctx, accountID)
	if err != nil {
		return stellar1.BundleEntry{}, stellar1.AccountBundle{}, err
	}
	if len(ab.Signers) == 0 {
		return stellar1.BundleEntry{}, stellar1.AccountBundle{}, errors.New("no signer for bundle")
	}
	if len(ab.Signers) > 1 {
		return stellar1.BundleEntry{}, stellar1.AccountBundle{}, errors.New("only single signer supported")
	}

	return entry, ab, nil
}

// LookupRecipient finds a recipient.
// `to` can be a username, social assertion, account ID, or federation address.
func LookupRecipient(m libkb.MetaContext, to stellarcommon.RecipientInput, isCLI bool) (res stellarcommon.Recipient, err error) {
	defer m.TraceTimed("Stellar.LookupRecipient", func() error { return err })()

	res = stellarcommon.Recipient{
		Input: to,
	}
	if len(to) == 0 {
		return res, fmt.Errorf("empty recipient parameter")
	}

	storeAddress := func(address string) error {
		_, err := libkb.ParseStellarAccountID(address)
		if err != nil {
			if verr, ok := err.(libkb.VerboseError); ok {
				m.Debug(verr.Verbose())
			}
			return err
		}
		accountID, err := stellarnet.NewAddressStr(address)
		if err != nil {
			return err
		}
		res.AccountID = &accountID
		return nil
	}

	// Federation address
	if strings.Contains(string(to), stellarAddress.Separator) {
		name, domain, err := stellarAddress.Split(string(to))
		if err != nil {
			return res, err
		}

		if domain == "keybase.io" {
			// Keybase.io federation address. Fall through to identify
			// path.
			m.Debug("Got federation address %q but it's under keybase.io domain!", to)
			m.Debug("Instead going to lookup Keybase assertion: %q", name)
			to = stellarcommon.RecipientInput(name)
		} else {
			// Actual federation address that is not under keybase.io
			// domain. Use federation client.
			fedCli := getGlobal(m.G()).federationClient
			nameResponse, err := fedCli.LookupByAddress(string(to))
			if err != nil {
				errStr := err.Error()
				m.Debug("federation.LookupByAddress returned error: %s", errStr)
				if strings.Contains(errStr, "lookup federation server failed") {
					return res, fmt.Errorf("Server at url %q does not respond to federation requests", domain)
				} else if strings.Contains(errStr, "get federation failed") {
					return res, fmt.Errorf("Federation server %q did not find record %q", domain, name)
				}
				return res, err
			}
			// We got an address! Fall through to the "Stellar
			// address" path.
			m.Debug("federation.LookupByAddress returned: %+v", nameResponse)
			to = stellarcommon.RecipientInput(nameResponse.AccountID)
		}
	}

	// Stellar account ID
	if to[0] == 'G' && len(to) > 16 {
		err := storeAddress(string(to))
		return res, err
	}

	maybeUsername, err := lookupRecipientAssertion(m, string(to), isCLI)
	if err != nil {
		return res, err
	}
	if maybeUsername == "" {
		expr, err := externals.AssertionParse(m, string(to))
		if err != nil {
			m.Debug("error parsing assertion: %s", err)
			return res, fmt.Errorf("invalid recipient %q: %s", to, err)
		}

		// valid assertion, but not a user yet
		m.Debug("assertion %s (%s) is valid, but not a user yet", to, expr)
		social, err := expr.ToSocialAssertion()
		if err != nil {
			m.Debug("not a social assertion: %s (%s)", to, expr)
			if _, ok := expr.(libkb.AssertionKeybase); ok {
				return res, libkb.NotFoundError{Msg: fmt.Sprintf("user not found: %q", to)}
			}
			return res, fmt.Errorf("invalid recipient %q: %s", to, err)
		}
		res.Assertion = &social
		return res, nil
	}

	// load the user to get their wallet
	user, err := libkb.LoadUser(
		libkb.NewLoadUserByNameArg(m.G(), maybeUsername).
			WithNetContext(m.Ctx()).
			WithPublicKeyOptional())
	if err != nil {
		return res, err
	}
	res.User = &stellarcommon.User{
		UV:       user.ToUserVersion(),
		Username: user.GetNormalizedName(),
	}
	accountID := user.StellarAccountID()
	if accountID == nil {
		return res, nil
	}
	err = storeAddress(accountID.String())
	return res, err
}

type DisplayBalance struct {
	Amount   string
	Currency string
}

func getTimeboundsForSending(m libkb.MetaContext, walletState *WalletState) (*build.Timebounds, error) {
	// Timeout added as Timebounds.MaxTime to Stellar transactions that client
	// creates, effectively adding a "deadline" to the transaction. We can
	// safely assume that a transaction will never end up in a ledger if it's
	// not included before the deadline.

	// We ask server for timebounds because local clock might not be accurate,
	// and typically we will be setting timeout as 30 seconds.
	start := m.G().Clock().Now()
	serverTimes, err := walletState.ServerTimeboundsRecommendation(m.Ctx())
	if err != nil {
		return nil, err
	}
	took := m.G().Clock().Since(start)
	m.Debug("Server timebounds recommendation is: %+v. Request took %fs", serverTimes, took.Seconds())
	if serverTimes.TimeNow == 0 {
		return nil, fmt.Errorf("Invalid server response for transaction timebounds")
	}
	if serverTimes.Timeout == 0 {
		m.Debug("Returning nil timebounds")
		return nil, nil
	}

	// Offset server time by our latency to the server. We are making two
	// requests to submit a transaction: one here to get the server time, and
	// another one to send the signed transaction. Assuming server roundtrip
	// time will be the same for both requests, we can offset timebounds here
	// by entire roundtrip time and then we will have MaxTime set as 30 seconds
	// counting from when the server gets our signed tx.
	deadline := serverTimes.TimeNow.Time().Add(took).Unix() + serverTimes.Timeout
	tb := build.Timebounds{
		MaxTime: uint64(deadline),
	}
	m.Debug("Returning timebounds for tx: %+v", tb)
	return &tb, nil
}

type SendPaymentArg struct {
	From           stellar1.AccountID // Optional. Defaults to primary account.
	To             stellarcommon.RecipientInput
	Amount         string // Amount of XLM to send.
	DisplayBalance DisplayBalance
	SecretNote     string           // Optional.
	PublicMemo     *stellarnet.Memo // Optional.
	ForceRelay     bool
	QuickReturn    bool
}

type SendPaymentResult struct {
	KbTxID stellar1.KeybaseTransactionID
	// Direct: tx ID of the payment tx
	// Relay : tx ID of the funding payment tx
	TxID    stellar1.TransactionID
	Pending bool
	// Implicit team that the relay secret is encrypted for.
	// Present if this was a relay transfer.
	RelayTeamID *keybase1.TeamID
	JumpToChat  string
}

// SendPaymentCLI sends XLM from CLI.
func SendPaymentCLI(m libkb.MetaContext, walletState *WalletState, sendArg SendPaymentArg) (res SendPaymentResult, err error) {
	return sendPayment(m, walletState, sendArg, true)
}

// SendPaymentGUI sends XLM from GUI.
func SendPaymentGUI(m libkb.MetaContext, walletState *WalletState, sendArg SendPaymentArg) (res SendPaymentResult, err error) {
	return sendPayment(m, walletState, sendArg, false)
}

// sendPayment sends XLM.
// Recipient:
// Stellar address        : Standard payment
// User with wallet ready : Standard payment
// User without a wallet  : Relay payment
// Unresolved assertion   : Relay payment
func sendPayment(mctx libkb.MetaContext, walletState *WalletState, sendArg SendPaymentArg, isCLI bool) (res SendPaymentResult, err error) {
	defer mctx.TraceTimed("Stellar.SendPayment", func() error { return err })()

	// look up sender account
	senderEntry, senderAccountBundle, err := LookupSender(mctx, sendArg.From)
	if err != nil {
		return res, err
	}
	senderSeed := senderAccountBundle.Signers[0]
	senderAccountID := senderEntry.AccountID

	// look up recipient
	recipient, err := LookupRecipient(mctx, sendArg.To, isCLI)
	if err != nil {
		return res, err
	}

	mctx.Debug("using stellar network passphrase: %q", stellarnet.Network().Passphrase)

	baseFee := walletState.BaseFee(mctx)

	if recipient.AccountID == nil || sendArg.ForceRelay {
		return sendRelayPayment(mctx, walletState,
			senderSeed, recipient, sendArg.Amount, sendArg.DisplayBalance,
			sendArg.SecretNote, sendArg.PublicMemo, sendArg.QuickReturn, senderEntry.IsPrimary, baseFee)
	}

	ownRecipient, _, err := OwnAccount(mctx, stellar1.AccountID(recipient.AccountID.String()))
	if err != nil {
		mctx.Debug("error determining if user own's recipient: %v", err)
		return res, err
	}
	if ownRecipient {
		// When sending to an account that we own, act as though sending to a user as opposed to just an account ID.
		uv, un := mctx.G().ActiveDevice.GetUsernameAndUserVersionIfValid(mctx)
		if uv.IsNil() || un.IsNil() {
			mctx.Debug("error finding self: uv:%v un:%v", uv, un)
			return res, fmt.Errorf("error getting logged-in user")
		}
		recipient.User = &stellarcommon.User{
			UV:       uv,
			Username: un,
		}
	}

	senderSeed2, err := stellarnet.NewSeedStr(senderSeed.SecureNoLogString())
	if err != nil {
		return res, err
	}

	post := stellar1.PaymentDirectPost{
		FromDeviceID:    mctx.G().ActiveDevice.DeviceID(),
		DisplayAmount:   sendArg.DisplayBalance.Amount,
		DisplayCurrency: sendArg.DisplayBalance.Currency,
		QuickReturn:     sendArg.QuickReturn,
	}
	if recipient.User != nil {
		post.To = &recipient.User.UV
	}

	// check if recipient account exists
	funded, err := isAccountFunded(mctx.Ctx(), walletState, stellar1.AccountID(recipient.AccountID.String()))
	if err != nil {
		return res, fmt.Errorf("error checking destination account balance: %v", err)
	}
	if !funded && isAmountLessThanMin(sendArg.Amount, minAmountCreateAccountXLM) {
		return res, fmt.Errorf("you must send at least %s XLM to fund the account for %s", minAmountCreateAccountXLM, sendArg.To)
	}

	sp, unlock := NewSeqnoProvider(mctx, walletState)
	defer unlock()

	tb, err := getTimeboundsForSending(mctx, walletState)
	if err != nil {
		return res, err
	}

	var txID string
	var seqno uint64
	if !funded {
		// if no balance, create_account operation
		sig, err := stellarnet.CreateAccountXLMTransactionWithMemo(senderSeed2, *recipient.AccountID, sendArg.Amount, sendArg.PublicMemo, sp, tb, baseFee)
		if err != nil {
			return res, err
		}
		post.SignedTransaction = sig.Signed
		txID = sig.TxHash
		seqno = sig.Seqno
	} else {
		// if balance, payment operation
		sig, err := stellarnet.PaymentXLMTransactionWithMemo(senderSeed2, *recipient.AccountID, sendArg.Amount, sendArg.PublicMemo, sp, tb, baseFee)
		if err != nil {
			return res, err
		}
		post.SignedTransaction = sig.Signed
		txID = sig.TxHash
		seqno = sig.Seqno
	}

	if err := walletState.AddPendingTx(mctx.Ctx(), senderAccountID, stellar1.TransactionID(txID), seqno); err != nil {
		mctx.Debug("error calling AddPendingTx: %s", err)
	}

	if len(sendArg.SecretNote) > 0 {
		noteClear := stellar1.NoteContents{
			Note:      sendArg.SecretNote,
			StellarID: stellar1.TransactionID(txID),
		}
		var recipientUv *keybase1.UserVersion
		if recipient.User != nil {
			recipientUv = &recipient.User.UV
		}
		post.NoteB64, err = NoteEncryptB64(mctx, noteClear, recipientUv)
		if err != nil {
			return res, fmt.Errorf("error encrypting note: %v", err)
		}
	}

	// submit the transaction
	rres, err := walletState.SubmitPayment(mctx.Ctx(), post)
	if err != nil {
		mctx.Debug("SEQNO SubmitPayment error seqno: %d txID: %s, err: %s", seqno, rres.StellarID, err)
		if rerr := walletState.RemovePendingTx(mctx.Ctx(), senderAccountID, stellar1.TransactionID(txID)); rerr != nil {
			mctx.Debug("error calling RemovePendingTx: %s", rerr)
		}
		return res, err
	}
	mctx.Debug("sent payment (direct) kbTxID:%v txID:%v pending:%v", seqno, rres.KeybaseID, rres.StellarID, rres.Pending)
	mctx.Debug("SEQNO SubmitPayment success seqno: %d txID: %s", seqno, rres.StellarID)
	if !rres.Pending {
		mctx.Debug("SubmitPayment result wasn't pending, removing from wallet state: %s/%s", senderAccountID, txID)
		err = walletState.RemovePendingTx(mctx.Ctx(), senderAccountID, stellar1.TransactionID(txID))
		if err != nil {
			mctx.Debug("SubmitPayment ws.RemovePendingTx error: %s", err)
		}
	}

	err = walletState.Refresh(mctx, senderEntry.AccountID, "SubmitPayment")
	if err != nil {
		mctx.Debug("SubmitPayment ws.Refresh error: %s", err)
	}

	var chatRecipient string
	if senderEntry.IsPrimary {
		chatRecipient = chatRecipientStr(mctx, recipient)
		sendChat := func(mctx libkb.MetaContext) {
			chatSendPaymentMessageSoft(mctx, chatRecipient, rres.StellarID, "SendPayment")
		}
		if sendArg.QuickReturn {
			go sendChat(mctx.WithCtx(context.Background()))
		} else {
			sendChat(mctx)
		}
	} else {
		mctx.Debug("not sending chat message: sending from non-primary account")
	}

	return SendPaymentResult{
		KbTxID:     rres.KeybaseID,
		TxID:       rres.StellarID,
		Pending:    rres.Pending,
		JumpToChat: chatRecipient,
	}, nil
}

type SendPathPaymentArg struct {
	From        stellar1.AccountID
	To          stellarcommon.RecipientInput
	Path        stellar1.PaymentPath
	SecretNote  string
	PublicMemo  *stellarnet.Memo
	QuickReturn bool
}

// SendPathPaymentCLI sends a path payment from CLI.
func SendPathPaymentCLI(mctx libkb.MetaContext, walletState *WalletState, sendArg SendPathPaymentArg) (res SendPaymentResult, err error) {
	return sendPathPayment(mctx, walletState, sendArg)
}

// SendPathPaymentGUI sends a path payment from GUI.
func SendPathPaymentGUI(mctx libkb.MetaContext, walletState *WalletState, sendArg SendPathPaymentArg) (res SendPaymentResult, err error) {
	return sendPathPayment(mctx, walletState, sendArg)
}

// PathPaymentTx reutrns a signed path payment tx.
func PathPaymentTx(mctx libkb.MetaContext, walletState *WalletState, sendArg SendPathPaymentArg) (*stellarnet.SignResult, *stellar1.BundleEntry, *stellarcommon.Recipient, error) {
	senderEntry, senderAccountBundle, err := LookupSender(mctx, sendArg.From)
	if err != nil {
		return nil, nil, nil, err
	}
	senderSeed, err := stellarnet.NewSeedStr(senderAccountBundle.Signers[0].SecureNoLogString())
	if err != nil {
		return nil, nil, nil, err
	}

	recipient, err := LookupRecipient(mctx, sendArg.To, false)
	if err != nil {
		return nil, nil, nil, err
	}
	if recipient.AccountID == nil {
		return nil, nil, nil, errors.New("cannot send a path payment to a user without a stellar account")
	}

	baseFee := walletState.BaseFee(mctx)

	to, err := stellarnet.NewAddressStr(recipient.AccountID.String())
	if err != nil {
		return nil, nil, nil, err
	}

	sp, unlock := NewSeqnoProvider(mctx, walletState)
	defer unlock()

	sig, err := stellarnet.PathPaymentTransactionWithMemo(senderSeed, to, sendArg.Path.SourceAsset, sendArg.Path.SourceAmountMax, sendArg.Path.DestinationAsset, sendArg.Path.DestinationAmount, AssetSliceToAssetBase(sendArg.Path.Path), sendArg.PublicMemo, sp, nil, baseFee)
	if err != nil {
		return nil, nil, nil, err
	}

	return &sig, &senderEntry, &recipient, nil
}

func sendPathPayment(mctx libkb.MetaContext, walletState *WalletState, sendArg SendPathPaymentArg) (res SendPaymentResult, err error) {
	sig, senderEntry, recipient, err := PathPaymentTx(mctx, walletState, sendArg)
	if err != nil {
		return res, err
	}
	senderAccountID := senderEntry.AccountID

	post := stellar1.PathPaymentPost{
		FromDeviceID:      mctx.G().ActiveDevice.DeviceID(),
		QuickReturn:       sendArg.QuickReturn,
		SignedTransaction: sig.Signed,
	}

	if recipient.User != nil {
		post.To = &recipient.User.UV
	}

	if err := walletState.AddPendingTx(mctx.Ctx(), senderEntry.AccountID, stellar1.TransactionID(sig.TxHash), sig.Seqno); err != nil {
		mctx.Debug("error calling AddPendingTx: %s", err)
	}

	if len(sendArg.SecretNote) > 0 {
		noteClear := stellar1.NoteContents{
			Note:      sendArg.SecretNote,
			StellarID: stellar1.TransactionID(sig.TxHash),
		}
		var recipientUv *keybase1.UserVersion
		if recipient.User != nil {
			recipientUv = &recipient.User.UV
		}
		post.NoteB64, err = NoteEncryptB64(mctx, noteClear, recipientUv)
		if err != nil {
			return res, fmt.Errorf("error encrypting note: %v", err)
		}
	}

	rres, err := walletState.SubmitPathPayment(mctx, post)
	if err != nil {
		mctx.Debug("SEQNO SubmitPathPayment error seqno: %d txID: %s, err: %s", sig.Seqno, rres.StellarID, err)
		if rerr := walletState.RemovePendingTx(mctx.Ctx(), senderEntry.AccountID, stellar1.TransactionID(sig.TxHash)); rerr != nil {
			mctx.Debug("error calling RemovePendingTx: %s", rerr)
		}
		return res, err
	}
	mctx.Debug("sent path payment (direct) kbTxID:%v txID:%v pending:%v", sig.Seqno, rres.KeybaseID, rres.StellarID, rres.Pending)
	mctx.Debug("SEQNO SubmitPathPayment success seqno: %d txID: %s", sig.Seqno, rres.StellarID)
	if !rres.Pending {
		mctx.Debug("SubmitPathPayment result wasn't pending, removing from wallet state: %s/%s", senderAccountID, sig.TxHash)
		err = walletState.RemovePendingTx(mctx.Ctx(), senderEntry.AccountID, stellar1.TransactionID(sig.TxHash))
		if err != nil {
			mctx.Debug("SubmitPathPayment ws.RemovePendingTx error: %s", err)
		}
	}

	err = walletState.Refresh(mctx, senderEntry.AccountID, "SubmitPathPayment")
	if err != nil {
		mctx.Debug("SubmitPathPayment ws.Refresh error: %s", err)
	}

	var chatRecipient string
	if senderEntry.IsPrimary {
		chatRecipient = chatRecipientStr(mctx, *recipient)
		sendChat := func(mctx libkb.MetaContext) {
			chatSendPaymentMessageSoft(mctx, chatRecipient, rres.StellarID, "SendPathPayment")
		}
		if sendArg.QuickReturn {
			go sendChat(mctx.WithCtx(context.Background()))
		} else {
			sendChat(mctx)
		}
	} else {
		mctx.Debug("not sending chat message: sending from non-primary account")
	}

	return SendPaymentResult{
		KbTxID:     rres.KeybaseID,
		TxID:       rres.StellarID,
		Pending:    rres.Pending,
		JumpToChat: chatRecipient,
	}, nil
}

type indexedSpec struct {
	spec             libkb.MiniChatPaymentSpec
	index            int
	xlmAmountNumeric int64
}

// SpecMiniChatPayments returns a summary of the payment amounts for each recipient
// and a total.
func SpecMiniChatPayments(mctx libkb.MetaContext, walletState *WalletState, payments []libkb.MiniChatPayment) (*libkb.MiniChatPaymentSummary, error) {
	// look up sender account
	_, senderAccountBundle, err := LookupSenderPrimary(mctx)
	if err != nil {
		return nil, err
	}
	senderAccountID := senderAccountBundle.AccountID
	senderCurrency, err := GetCurrencySetting(mctx, senderAccountID)
	if err != nil {
		return nil, err
	}

	senderRate, err := walletState.ExchangeRate(mctx.Ctx(), string(senderCurrency.Code))
	if err != nil {
		return nil, err
	}

	var summary libkb.MiniChatPaymentSummary

	var xlmTotal int64
	if len(payments) > 0 {
		ch := make(chan indexedSpec)
		for i, payment := range payments {
			go func(payment libkb.MiniChatPayment, index int) {
				spec, xlmAmountNumeric := specMiniChatPayment(mctx, walletState, payment)
				ch <- indexedSpec{spec: spec, index: index, xlmAmountNumeric: xlmAmountNumeric}
			}(payment, i)
		}

		summary.Specs = make([]libkb.MiniChatPaymentSpec, len(payments))
		for i := 0; i < len(payments); i++ {
			ispec := <-ch
			summary.Specs[ispec.index] = ispec.spec
			xlmTotal += ispec.xlmAmountNumeric
		}
	}

	summary.XLMTotal = stellarnet.StringFromStellarAmount(xlmTotal)
	if senderRate.Currency != "" && senderRate.Currency != "XLM" {
		outsideAmount, err := stellarnet.ConvertXLMToOutside(summary.XLMTotal, senderRate.Rate)
		if err != nil {
			return nil, err
		}
		summary.DisplayTotal, err = FormatCurrencyWithCodeSuffix(mctx, outsideAmount, senderRate.Currency, stellarnet.Round)
		if err != nil {
			return nil, err
		}
	}

	summary.XLMTotal, err = FormatAmountDescriptionXLM(mctx, summary.XLMTotal)
	if err != nil {
		return nil, err
	}

	return &summary, nil
}

func specMiniChatPayment(mctx libkb.MetaContext, walletState *WalletState, payment libkb.MiniChatPayment) (libkb.MiniChatPaymentSpec, int64) {
	spec := libkb.MiniChatPaymentSpec{Username: payment.Username}
	xlmAmount := payment.Amount
	if payment.Currency != "" && payment.Currency != "XLM" {
		exchangeRate, err := walletState.ExchangeRate(mctx.Ctx(), payment.Currency)
		if err != nil {
			spec.Error = err
			return spec, 0
		}
		spec.DisplayAmount, err = FormatCurrencyWithCodeSuffix(mctx, payment.Amount, exchangeRate.Currency, stellarnet.Round)
		if err != nil {
			spec.Error = err
			return spec, 0
		}

		xlmAmount, err = stellarnet.ConvertOutsideToXLM(payment.Amount, exchangeRate.Rate)
		if err != nil {
			spec.Error = err
			return spec, 0
		}
	}

	xlmAmountNumeric, err := stellarnet.ParseStellarAmount(xlmAmount)
	if err != nil {
		spec.Error = err
		return spec, 0
	}

	spec.XLMAmount, err = FormatAmountDescriptionXLM(mctx, xlmAmount)
	if err != nil {
		spec.Error = err
		return spec, 0
	}

	return spec, xlmAmountNumeric
}

// SendMiniChatPayments sends multiple payments from one sender to multiple
// different recipients as fast as it can.  These come from chat messages
// like "+1XLM@alice +2XLM@charlie".
func SendMiniChatPayments(m libkb.MetaContext, walletState *WalletState, convID chat1.ConversationID, payments []libkb.MiniChatPayment) (res []libkb.MiniChatPaymentResult, err error) {
	defer m.TraceTimed("Stellar.SendMiniChatPayments", func() error { return err })()

	// look up sender account
	senderAccountID, senderSeed, err := LookupSenderSeed(m)
	if err != nil {
		return nil, err
	}

	prepared, unlock, err := PrepareMiniChatPayments(m, walletState, senderSeed, convID, payments)
	defer unlock()
	if err != nil {
		return nil, err
	}

	resultList := make([]libkb.MiniChatPaymentResult, len(payments))

	// need to submit tx one at a time, in order
	for i := 0; i < len(prepared); i++ {
		if prepared[i] == nil {
			// this should never happen
			return nil, errors.New("mini chat prepare failed")
		}
		mcpResult := libkb.MiniChatPaymentResult{Username: prepared[i].Username}
		if prepared[i].Error != nil {
			mcpResult.Error = prepared[i].Error
		} else {
			// submit the transaction
			m.Debug("SEQNO ics %d submitting payment seqno %d (txid %s)", i, prepared[i].Seqno, prepared[i].TxID)

			if err := walletState.AddPendingTx(m.Ctx(), senderAccountID, prepared[i].TxID, prepared[i].Seqno); err != nil {
				m.Debug("SEQNO ics %d error calling AddPendingTx: %s", i, err)
			}

			var submitRes stellar1.PaymentResult
			switch {
			case prepared[i].Direct != nil:
				submitRes, err = walletState.SubmitPayment(m.Ctx(), *prepared[i].Direct)
			case prepared[i].Relay != nil:
				submitRes, err = walletState.SubmitRelayPayment(m.Ctx(), *prepared[i].Relay)
			default:
				mcpResult.Error = errors.New("no direct or relay payment")
			}

			if err != nil {
				mcpResult.Error = err
				m.Debug("SEQNO ics %d submit error for txid %s, seqno %d: %s", i, prepared[i].TxID, prepared[i].Seqno, err)
				if rerr := walletState.RemovePendingTx(m.Ctx(), senderAccountID, prepared[i].TxID); rerr != nil {
					m.Debug("SEQNO ics %d error calling RemovePendingTx: %s", i, rerr)
				}
			} else {
				mcpResult.PaymentID = stellar1.NewPaymentID(submitRes.StellarID)
				m.Debug("SEQNO ics %d submit success txid %s, seqno %d", i, prepared[i].TxID, prepared[i].Seqno)
			}
		}
		resultList[i] = mcpResult
	}

	return resultList, nil
}

type MiniPrepared struct {
	Username libkb.NormalizedUsername
	Direct   *stellar1.PaymentDirectPost
	Relay    *stellar1.PaymentRelayPost
	TxID     stellar1.TransactionID
	Seqno    uint64
	Error    error
}

func PrepareMiniChatPayments(m libkb.MetaContext, walletState *WalletState, senderSeed stellarnet.SeedStr, convID chat1.ConversationID, payments []libkb.MiniChatPayment) ([]*MiniPrepared, func(), error) {
	prepared := make(chan *MiniPrepared)

	baseFee := walletState.BaseFee(m)
	sp, unlock := NewSeqnoProvider(m, walletState)
	tb, err := getTimeboundsForSending(m, walletState)
	if err != nil {
		return nil, unlock, err
	}

	for _, payment := range payments {
		go func(p libkb.MiniChatPayment) {
			prepared <- prepareMiniChatPayment(m, walletState, sp, tb, senderSeed, convID, p, baseFee)
		}(payment)
	}

	// prepared chan could be out of order, so sort by seqno
	preparedList := make([]*MiniPrepared, len(payments))
	for i := 0; i < len(payments); i++ {
		preparedList[i] = <-prepared
	}
	sort.Slice(preparedList, func(a, b int) bool { return preparedList[a].Seqno < preparedList[b].Seqno })

	return preparedList, unlock, nil
}

func prepareMiniChatPayment(m libkb.MetaContext, remoter remote.Remoter, sp build.SequenceProvider, tb *build.Timebounds, senderSeed stellarnet.SeedStr, convID chat1.ConversationID, payment libkb.MiniChatPayment, baseFee uint64) *MiniPrepared {
	result := &MiniPrepared{Username: payment.Username}
	recipient, err := LookupRecipient(m, stellarcommon.RecipientInput(payment.Username.String()), false)
	if err != nil {
		m.Debug("LookupRecipient error: %s", err)
		result.Error = errors.New("error looking up recipient")
		return result
	}

	if recipient.AccountID == nil {
		return prepareMiniChatPaymentRelay(m, remoter, sp, tb, senderSeed, convID, payment, recipient, baseFee)
	}
	return prepareMiniChatPaymentDirect(m, remoter, sp, tb, senderSeed, convID, payment, recipient, baseFee)
}

func prepareMiniChatPaymentDirect(m libkb.MetaContext, remoter remote.Remoter, sp build.SequenceProvider, tb *build.Timebounds, senderSeed stellarnet.SeedStr, convID chat1.ConversationID, payment libkb.MiniChatPayment, recipient stellarcommon.Recipient, baseFee uint64) *MiniPrepared {
	result := &MiniPrepared{Username: payment.Username}
	funded, err := isAccountFunded(m.Ctx(), remoter, stellar1.AccountID(recipient.AccountID.String()))
	if err != nil {
		result.Error = err
		return result
	}

	result.Direct = &stellar1.PaymentDirectPost{
		FromDeviceID: m.G().ActiveDevice.DeviceID(),
		To:           &recipient.User.UV,
		QuickReturn:  true,
	}
	if convID != nil {
		result.Direct.ChatConversationID = stellar1.NewChatConversationID(convID)
	}

	xlmAmount := payment.Amount
	if payment.Currency != "" && payment.Currency != "XLM" {
		result.Direct.DisplayAmount = payment.Amount
		result.Direct.DisplayCurrency = payment.Currency
		exchangeRate, err := remoter.ExchangeRate(m.Ctx(), payment.Currency)
		if err != nil {
			result.Error = err
			return result
		}

		xlmAmount, err = stellarnet.ConvertOutsideToXLM(payment.Amount, exchangeRate.Rate)
		if err != nil {
			result.Error = err
			return result
		}
	}

	var signResult stellarnet.SignResult
	if funded {
		signResult, err = stellarnet.PaymentXLMTransaction(senderSeed, *recipient.AccountID, xlmAmount, "", sp, tb, baseFee)
	} else {
		if isAmountLessThanMin(xlmAmount, minAmountCreateAccountXLM) {
			result.Error = fmt.Errorf("you must send at least %s XLM to fund the account", minAmountCreateAccountXLM)
			return result
		}
		signResult, err = stellarnet.CreateAccountXLMTransaction(senderSeed, *recipient.AccountID, xlmAmount, "", sp, tb, baseFee)
	}
	if err != nil {
		result.Error = err
		return result
	}
	result.Direct.SignedTransaction = signResult.Signed
	result.Seqno = signResult.Seqno
	result.TxID = stellar1.TransactionID(signResult.TxHash)

	return result
}

func prepareMiniChatPaymentRelay(mctx libkb.MetaContext, remoter remote.Remoter, sp build.SequenceProvider, tb *build.Timebounds, senderSeed stellarnet.SeedStr, convID chat1.ConversationID, payment libkb.MiniChatPayment, recipient stellarcommon.Recipient, baseFee uint64) *MiniPrepared {
	result := &MiniPrepared{Username: payment.Username}

	appKey, teamID, err := relays.GetKey(mctx, recipient)
	if err != nil {
		result.Error = err
		return result
	}

	xlmAmount := payment.Amount
	var displayAmount, displayCurrency string
	if payment.Currency != "" && payment.Currency != "XLM" {
		displayAmount = payment.Amount
		displayCurrency = payment.Currency
		exchangeRate, err := remoter.ExchangeRate(mctx.Ctx(), payment.Currency)
		if err != nil {
			result.Error = err
			return result
		}

		xlmAmount, err = stellarnet.ConvertOutsideToXLM(payment.Amount, exchangeRate.Rate)
		if err != nil {
			result.Error = err
			return result
		}
	}

	if isAmountLessThanMin(xlmAmount, minAmountRelayXLM) {
		result.Error = fmt.Errorf("you must send at least %s XLM to fund the account", minAmountRelayXLM)
		return result
	}

	relay, err := relays.Create(relays.Input{
		From:          stellar1.SecretKey(senderSeed),
		AmountXLM:     xlmAmount,
		EncryptFor:    appKey,
		SeqnoProvider: sp,
		Timebounds:    tb,
		BaseFee:       baseFee,
	})
	if err != nil {
		result.Error = err
		return result
	}

	post := stellar1.PaymentRelayPost{
		FromDeviceID:      mctx.ActiveDevice().DeviceID(),
		ToAssertion:       string(recipient.Input),
		RelayAccount:      relay.RelayAccountID,
		TeamID:            teamID,
		BoxB64:            relay.EncryptedB64,
		SignedTransaction: relay.FundTx.Signed,
		DisplayAmount:     displayAmount,
		DisplayCurrency:   displayCurrency,
		QuickReturn:       true,
	}
	if recipient.User != nil {
		post.To = &recipient.User.UV
	}

	result.Relay = &post
	result.Seqno = relay.FundTx.Seqno
	result.TxID = stellar1.TransactionID(relay.FundTx.TxHash)

	if convID != nil {
		result.Relay.ChatConversationID = stellar1.NewChatConversationID(convID)
	}

	return result
}

// sendRelayPayment sends XLM through a relay account.
// The balance of the relay account can be claimed by either party.
func sendRelayPayment(mctx libkb.MetaContext, walletState *WalletState,
	from stellar1.SecretKey, recipient stellarcommon.Recipient, amount string, displayBalance DisplayBalance,
	secretNote string, publicMemo *stellarnet.Memo, quickReturn bool, senderEntryPrimary bool, baseFee uint64) (res SendPaymentResult, err error) {
	defer mctx.TraceTimed("Stellar.sendRelayPayment", func() error { return err })()
	appKey, teamID, err := relays.GetKey(mctx, recipient)
	if err != nil {
		return res, err
	}

	if isAmountLessThanMin(amount, minAmountRelayXLM) {
		return res, fmt.Errorf("you must send at least %s XLM to fund the account for %s", minAmountRelayXLM, recipient.Input)
	}

	sp, unlock := NewSeqnoProvider(mctx, walletState)
	defer unlock()
	tb, err := getTimeboundsForSending(mctx, walletState)
	if err != nil {
		return res, err
	}
	relay, err := relays.Create(relays.Input{
		From:          from,
		AmountXLM:     amount,
		Note:          secretNote,
		PublicMemo:    publicMemo,
		EncryptFor:    appKey,
		SeqnoProvider: sp,
		Timebounds:    tb,
		BaseFee:       baseFee,
	})
	if err != nil {
		return res, err
	}

	_, accountID, _, err := libkb.ParseStellarSecretKey(string(from))
	if err != nil {
		return res, err
	}
	if err := walletState.AddPendingTx(mctx.Ctx(), accountID, stellar1.TransactionID(relay.FundTx.TxHash), relay.FundTx.Seqno); err != nil {
		mctx.Debug("error calling AddPendingTx: %s", err)
	}

	post := stellar1.PaymentRelayPost{
		FromDeviceID:      mctx.ActiveDevice().DeviceID(),
		ToAssertion:       string(recipient.Input),
		RelayAccount:      relay.RelayAccountID,
		TeamID:            teamID,
		BoxB64:            relay.EncryptedB64,
		SignedTransaction: relay.FundTx.Signed,
		DisplayAmount:     displayBalance.Amount,
		DisplayCurrency:   displayBalance.Currency,
		QuickReturn:       quickReturn,
	}
	if recipient.User != nil {
		post.To = &recipient.User.UV
	}
	rres, err := walletState.SubmitRelayPayment(mctx.Ctx(), post)
	if err != nil {
		if rerr := walletState.RemovePendingTx(mctx.Ctx(), accountID, stellar1.TransactionID(relay.FundTx.TxHash)); rerr != nil {
			mctx.Debug("error calling RemovePendingTx: %s", rerr)
		}
		return res, err
	}
	mctx.Debug("sent payment (relay) kbTxID:%v txID:%v pending:%v", rres.KeybaseID, rres.StellarID, rres.Pending)

	if !rres.Pending {
		if err := walletState.RemovePendingTx(mctx.Ctx(), accountID, stellar1.TransactionID(relay.FundTx.TxHash)); err != nil {
			mctx.Debug("error calling RemovePendingTx: %s", err)
		}
	}

	var chatRecipient string
	if senderEntryPrimary {
		chatRecipient = chatRecipientStr(mctx, recipient)
		sendChat := func(mctx libkb.MetaContext) {
			chatSendPaymentMessageSoft(mctx, chatRecipient, rres.StellarID, "SendRelayPayment")
		}
		if post.QuickReturn {
			go sendChat(mctx.WithCtx(context.Background()))
		} else {
			sendChat(mctx)
		}
	} else {
		mctx.Debug("not sending chat message (relay): sending from non-primary account")
	}

	return SendPaymentResult{
		KbTxID:      rres.KeybaseID,
		TxID:        rres.StellarID,
		Pending:     rres.Pending,
		RelayTeamID: &teamID,
		JumpToChat:  chatRecipient,
	}, nil
}

// Claim claims a waiting relay.
// If `dir` is nil the direction is inferred.
func Claim(mctx libkb.MetaContext, walletState *WalletState,
	txID string, into stellar1.AccountID, dir *stellar1.RelayDirection,
	autoClaimToken *string) (res stellar1.RelayClaimResult, err error) {
	defer mctx.TraceTimed("Stellar.Claim", func() error { return err })()
	mctx.Debug("Stellar.Claim(txID:%v, into:%v, dir:%v, autoClaimToken:%v)", txID, into, dir, autoClaimToken)
	details, err := walletState.PaymentDetailsGeneric(mctx.Ctx(), txID)
	if err != nil {
		return res, err
	}
	p := details.Summary
	typ, err := p.Typ()
	if err != nil {
		return res, fmt.Errorf("error getting payment details: %v", err)
	}
	switch typ {
	case stellar1.PaymentSummaryType_STELLAR:
		return res, fmt.Errorf("Payment cannot be claimed. It was found on the Stellar network but not in Keybase.")
	case stellar1.PaymentSummaryType_DIRECT:
		p := p.Direct()
		switch p.TxStatus {
		case stellar1.TransactionStatus_SUCCESS:
			return res, fmt.Errorf("Payment cannot be claimed. The direct transfer already happened.")
		case stellar1.TransactionStatus_PENDING:
			return res, fmt.Errorf("Payment cannot be claimed. It is currently pending.")
		default:
			return res, fmt.Errorf("Payment cannot be claimed. The payment failed anyway.")
		}
	case stellar1.PaymentSummaryType_RELAY:
		return claimPaymentWithDetail(mctx, walletState, p.Relay(), into, dir)
	default:
		return res, fmt.Errorf("unrecognized payment type: %v", typ)
	}
}

// If `dir` is nil the direction is inferred.
func claimPaymentWithDetail(mctx libkb.MetaContext, walletState *WalletState,
	p stellar1.PaymentSummaryRelay, into stellar1.AccountID, dir *stellar1.RelayDirection) (res stellar1.RelayClaimResult, err error) {
	if p.Claim != nil && p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
		recipient, _, err := mctx.G().GetUPAKLoader().Load(libkb.NewLoadUserByUIDArg(mctx.Ctx(), mctx.G(), p.Claim.To.Uid))
		if err != nil || recipient == nil {
			return res, fmt.Errorf("Payment already claimed")
		}
		return res, fmt.Errorf("Payment already claimed by %v", recipient.GetName())
	}
	rsec, err := relays.DecryptB64(mctx, p.TeamID, p.BoxB64)
	if err != nil {
		return res, fmt.Errorf("error opening secret to claim: %v", err)
	}
	skey, _, _, err := libkb.ParseStellarSecretKey(rsec.Sk.SecureNoLogString())
	if err != nil {
		return res, fmt.Errorf("error using shared secret key: %v", err)
	}
	destinationFunded, err := isAccountFunded(mctx.Ctx(), walletState, into)
	if err != nil {
		return res, err
	}
	useDir := stellar1.RelayDirection_CLAIM
	if dir == nil {
		// Infer direction
		if p.From.Uid.Equal(mctx.ActiveDevice().UID()) {
			useDir = stellar1.RelayDirection_YANK
		}
	} else {
		// Direction from caller
		useDir = *dir
	}

	baseFee := walletState.BaseFee(mctx)
	sp, unlock := NewClaimSeqnoProvider(mctx, walletState)
	defer unlock()
	tb, err := getTimeboundsForSending(mctx, walletState)
	if err != nil {
		return res, err
	}
	sig, err := stellarnet.RelocateTransaction(stellarnet.SeedStr(skey.SecureNoLogString()),
		stellarnet.AddressStr(into.String()), destinationFunded, nil, sp, tb, baseFee)
	if err != nil {
		return res, fmt.Errorf("error building claim transaction: %v", err)
	}
	return walletState.SubmitRelayClaim(mctx.Ctx(), stellar1.RelayClaimPost{
		KeybaseID:         p.KbTxID,
		Dir:               useDir,
		SignedTransaction: sig.Signed,
	})
}

func isAccountFunded(ctx context.Context, remoter remote.Remoter, accountID stellar1.AccountID) (funded bool, err error) {
	balances, err := remoter.Balances(ctx, accountID)
	if err != nil {
		return false, err
	}
	return hasPositiveLumenBalance(balances)
}

func hasPositiveLumenBalance(balances []stellar1.Balance) (res bool, err error) {
	for _, b := range balances {
		if b.Asset.IsNativeXLM() {
			a, err := stellarnet.ParseStellarAmount(b.Amount)
			if err != nil {
				return false, err
			}
			if a > 0 {
				return true, nil
			}
		}
	}
	return false, nil
}

func GetOwnPrimaryAccountID(mctx libkb.MetaContext) (res stellar1.AccountID, err error) {
	activeBundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return res, err
	}
	primary, err := activeBundle.PrimaryAccount()
	if err != nil {
		return res, err
	}
	return primary.AccountID, nil
}

func RecentPaymentsCLILocal(mctx libkb.MetaContext, remoter remote.Remoter, accountID stellar1.AccountID) (res []stellar1.PaymentOrErrorCLILocal, err error) {
	defer mctx.TraceTimed("Stellar.RecentPaymentsCLILocal", func() error { return err })()
	arg := remote.RecentPaymentsArg{
		AccountID:       accountID,
		IncludeAdvanced: true,
	}
	page, err := remoter.RecentPayments(mctx.Ctx(), arg)
	if err != nil {
		return nil, err
	}
	for _, p := range page.Payments {
		lp, err := localizePayment(mctx, p)
		if err == nil {
			res = append(res, stellar1.PaymentOrErrorCLILocal{
				Payment: &lp,
			})
		} else {
			errStr := err.Error()
			res = append(res, stellar1.PaymentOrErrorCLILocal{
				Err: &errStr,
			})
		}
	}
	return res, nil
}

func PaymentDetailCLILocal(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter, txID string) (res stellar1.PaymentCLILocal, err error) {
	defer g.CTraceTimed(ctx, "Stellar.PaymentDetailCLILocal", func() error { return err })()
	payment, err := remoter.PaymentDetailsGeneric(ctx, txID)
	if err != nil {
		return res, err
	}
	mctx := libkb.NewMetaContext(ctx, g)
	p, err := localizePayment(mctx, payment.Summary)
	if err != nil {
		return res, err
	}

	p.PublicNote = payment.Memo
	p.PublicNoteType = payment.MemoType
	if payment.FeeCharged != "" {
		p.FeeChargedDescription, err = FormatAmountDescriptionXLM(mctx, payment.FeeCharged)
		if err != nil {
			return res, err
		}
	}

	return p, nil
}

// When isCLI : Identifies the recipient checking track breaks and all.
// When not isCLI: Does a verified lookup of the assertion.
// Returns an error if a resolution was found but failed.
// Returns ("", nil) if no resolution was found.
func lookupRecipientAssertion(m libkb.MetaContext, assertion string, isCLI bool) (maybeUsername string, err error) {
	defer m.TraceTimed(fmt.Sprintf("Stellar.lookupRecipientAssertion(isCLI:%v, %v)", isCLI, assertion), func() error { return err })()
	reason := fmt.Sprintf("Find transaction recipient for %s", assertion)

	// GUI is a verified lookup modeled after func ResolveAndCheck.
	arg := keybase1.Identify2Arg{
		UserAssertion:         assertion,
		CanSuppressUI:         true,
		ActLoggedOut:          true,
		NoErrorOnTrackFailure: true,
		Reason:                keybase1.IdentifyReason{Reason: reason},
		IdentifyBehavior:      keybase1.TLFIdentifyBehavior_RESOLVE_AND_CHECK,
	}
	if isCLI {
		// CLI is a real identify
		arg = keybase1.Identify2Arg{
			UserAssertion:    assertion,
			UseDelegateUI:    true,
			Reason:           keybase1.IdentifyReason{Reason: reason},
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI,
		}
	}

	eng := engine.NewResolveThenIdentify2(m.G(), &arg)
	err = engine.RunEngine2(m, eng)
	if err != nil {
		// These errors mean no resolution was found.
		if _, ok := err.(libkb.NotFoundError); ok {
			m.Debug("identifyRecipient: not found %s: %s", assertion, err)
			return "", nil
		}
		if libkb.IsResolutionNotFoundError(err) {
			m.Debug("identifyRecipient: resolution not found error %s: %s", assertion, err)
			return "", nil
		}
		return "", err
	}

	idRes, err := eng.Result(m)
	if err != nil {
		return "", err
	}
	if idRes == nil {
		return "", fmt.Errorf("missing identify result")
	}
	m.Debug("lookupRecipientAssertion: uv: %v", idRes.Upk.Current.ToUserVersion())
	username := idRes.Upk.GetName()
	if username == "" {
		return "", fmt.Errorf("empty identify result username")
	}
	if isCLI && idRes.TrackBreaks != nil {
		m.Debug("lookupRecipientAssertion: TrackBreaks = %+v", idRes.TrackBreaks)
		return "", libkb.TrackingBrokeError{}
	}
	return username, nil
}

// ChangeAccountName changes the name of an account.
// Make sure to keep this in sync with ValidateAccountNameLocal.
// An empty name is not allowed.
// Renaming an account to an already used name is blocked.
// Maximum length of AccountNameMaxRunes runes.
func ChangeAccountName(m libkb.MetaContext, walletState *WalletState, accountID stellar1.AccountID, newName string) (err error) {
	if newName == "" {
		return fmt.Errorf("name required")
	}
	runes := utf8.RuneCountInString(newName)
	if runes > AccountNameMaxRunes {
		return fmt.Errorf("account name can be %v characters at the longest but was %v", AccountNameMaxRunes, runes)
	}
	b, err := remote.FetchSecretlessBundle(m)
	if err != nil {
		return err
	}
	var found bool
	for i, acc := range b.Accounts {
		if acc.AccountID.Eq(accountID) {
			// Change Name in place to modify Account struct.
			b.Accounts[i].Name = newName
			found = true
		} else if acc.Name == newName {
			return fmt.Errorf("you already have an account with that name")
		}
	}
	if !found {
		return fmt.Errorf("account not found: %v", accountID)
	}
	nextBundle := bundle.AdvanceBundle(*b)
	if err := remote.Post(m, nextBundle); err != nil {
		return err
	}

	return walletState.UpdateAccountEntriesWithBundle(m, "change account name", &nextBundle)
}

func SetAccountAsPrimary(m libkb.MetaContext, walletState *WalletState, accountID stellar1.AccountID) (err error) {
	if accountID.IsNil() {
		return errors.New("passed empty AccountID")
	}
	b, err := remote.FetchAccountBundle(m, accountID)
	if err != nil {
		return err
	}
	var foundAccID, foundPrimary bool
	for i, acc := range b.Accounts {
		if acc.AccountID.Eq(accountID) {
			if acc.IsPrimary {
				// Nothing to do.
				return nil
			}
			b.Accounts[i].IsPrimary = true
			foundAccID = true
		} else if acc.IsPrimary {
			b.Accounts[i].IsPrimary = false
			foundPrimary = true
		}

		if foundAccID && foundPrimary {
			break
		}
	}
	if !foundAccID {
		return fmt.Errorf("account not found: %v", accountID)
	}
	nextBundle := bundle.AdvanceAccounts(*b, []stellar1.AccountID{accountID})
	if err = remote.PostWithChainlink(m, nextBundle); err != nil {
		return err
	}

	return walletState.UpdateAccountEntriesWithBundle(m, "set account as primary", &nextBundle)
}

func DeleteAccount(m libkb.MetaContext, accountID stellar1.AccountID) error {
	if accountID.IsNil() {
		return errors.New("passed empty AccountID")
	}
	prevBundle, err := remote.FetchAccountBundle(m, accountID)
	if err != nil {
		return err
	}

	nextBundle := bundle.AdvanceBundle(*prevBundle)
	var found bool
	for i, acc := range nextBundle.Accounts {
		if acc.AccountID.Eq(accountID) {
			if acc.IsPrimary {
				return fmt.Errorf("cannot delete primary account %v", accountID)
			}

			nextBundle.Accounts = append(nextBundle.Accounts[:i], nextBundle.Accounts[i+1:]...)
			delete(nextBundle.AccountBundles, accountID)
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("account not found: %v", accountID)
	}
	return remote.Post(m, nextBundle)
}

const DefaultCurrencySetting = "USD"

// GetAccountDisplayCurrency gets currency setting from the server, and it
// returned currency is empty (NULL in database), then default "USD" is used.
// When creating a wallet, client always sets default currency setting. Also
// when a new account in existing wallet is created, it will inherit currency
// setting from primary account (this happens serverside). Empty currency
// settings should only happen in very old accounts or when wallet generation
// was interrupted in precise moment.
func GetAccountDisplayCurrency(mctx libkb.MetaContext, accountID stellar1.AccountID) (res string, err error) {
	codeStr, err := remote.GetAccountDisplayCurrency(mctx.Ctx(), mctx.G(), accountID)
	if err != nil {
		if err != remote.ErrAccountIDMissing {
			return res, err
		}
		codeStr = "" // to be safe so it uses default below
	}
	if codeStr == "" {
		codeStr = DefaultCurrencySetting
		mctx.Debug("Using default display currency %s for account %s", codeStr, accountID)
	}
	return codeStr, nil
}

func GetCurrencySetting(mctx libkb.MetaContext, accountID stellar1.AccountID) (res stellar1.CurrencyLocal, err error) {
	codeStr, err := GetAccountDisplayCurrency(mctx, accountID)
	if err != nil {
		return res, err
	}
	conf, err := mctx.G().GetStellar().GetServerDefinitions(mctx.Ctx())
	if err != nil {
		return res, err
	}
	currency, ok := conf.GetCurrencyLocal(stellar1.OutsideCurrencyCode(codeStr))
	if !ok {
		return res, fmt.Errorf("Got unrecognized currency code %q", codeStr)
	}
	return currency, nil
}

func CreateNewAccount(mctx libkb.MetaContext, accountName string) (ret stellar1.AccountID, err error) {
	prevBundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return ret, err
	}
	nextBundle := bundle.AdvanceBundle(*prevBundle)
	ret, err = bundle.CreateNewAccount(&nextBundle, accountName, false /* makePrimary */)
	if err != nil {
		return ret, err
	}
	return ret, remote.Post(mctx, nextBundle)
}

func chatRecipientStr(mctx libkb.MetaContext, recipient stellarcommon.Recipient) string {
	if recipient.User != nil {
		if recipient.User.UV.Uid.Equal(mctx.ActiveDevice().UID()) {
			// Don't send chat to self.
			return ""
		}
		return recipient.User.Username.String()
	} else if recipient.Assertion != nil {
		return recipient.Assertion.String()
	}
	return ""
}

func chatSendPaymentMessageSoft(mctx libkb.MetaContext, to string, txID stellar1.TransactionID, logLabel string) {
	if to == "" {
		return
	}
	err := chatSendPaymentMessage(mctx, to, txID)
	if err != nil {
		// if the chat message fails to send, just log the error
		mctx.Debug("failed to send chat %v mesage: %s", logLabel, err)
	}
}

func chatSendPaymentMessage(m libkb.MetaContext, to string, txID stellar1.TransactionID) error {
	m.G().StartStandaloneChat()
	if m.G().ChatHelper == nil {
		return errors.New("cannot send SendPayment message:  chat helper is nil")
	}

	name := strings.Join([]string{m.CurrentUsername().String(), to}, ",")

	msg := chat1.MessageSendPayment{
		PaymentID: stellar1.NewPaymentID(txID),
	}

	body := chat1.NewMessageBodyWithSendpayment(msg)

	// identify already performed, so skip here
	_, err := m.G().ChatHelper.SendMsgByNameNonblock(m.Ctx(), name, nil,
		chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFIdentifyBehavior_CHAT_SKIP, body,
		chat1.MessageType_SENDPAYMENT, nil)
	return err
}

type MakeRequestArg struct {
	To       stellarcommon.RecipientInput
	Amount   string
	Asset    *stellar1.Asset
	Currency *stellar1.OutsideCurrencyCode
	Note     string
}

func MakeRequestGUI(m libkb.MetaContext, remoter remote.Remoter, arg MakeRequestArg) (ret stellar1.KeybaseRequestID, err error) {
	return makeRequest(m, remoter, arg, false /* isCLI */)
}

func MakeRequestCLI(m libkb.MetaContext, remoter remote.Remoter, arg MakeRequestArg) (ret stellar1.KeybaseRequestID, err error) {
	return makeRequest(m, remoter, arg, true /* isCLI */)
}

func makeRequest(m libkb.MetaContext, remoter remote.Remoter, arg MakeRequestArg, isCLI bool) (ret stellar1.KeybaseRequestID, err error) {
	defer m.TraceTimed("Stellar.MakeRequest", func() error { return err })()

	if arg.Asset == nil && arg.Currency == nil {
		return ret, fmt.Errorf("expected either Asset or Currency, got none")
	} else if arg.Asset != nil && arg.Currency != nil {
		return ret, fmt.Errorf("expected either Asset or Currency, got both")
	}

	if arg.Asset != nil && !arg.Asset.IsNativeXLM() {
		return ret, fmt.Errorf("requesting non-XLM assets is not supported")
	}

	if arg.Asset != nil {
		a, err := stellarnet.ParseStellarAmount(arg.Amount)
		if err != nil {
			return ret, err
		}
		if a <= 0 {
			return ret, fmt.Errorf("must request positive amount of XLM")
		}
	}

	if arg.Currency != nil {
		conf, err := m.G().GetStellar().GetServerDefinitions(m.Ctx())
		if err != nil {
			return ret, err
		}
		_, ok := conf.GetCurrencyLocal(*arg.Currency)
		if !ok {
			return ret, fmt.Errorf("unrecognized currency code %q", *arg.Currency)
		}
	}

	// Make sure chat is functional. Chat message is the only way for
	// the recipient to learn about the request, so it's essential
	// that we are able to send REQUESTPAYMENT chat message.
	m.G().StartStandaloneChat()
	if m.G().ChatHelper == nil {
		return ret, errors.New("cannot send RequestPayment message: chat helper is nil")
	}

	recipient, err := LookupRecipient(m, arg.To, isCLI)
	if err != nil {
		return ret, err
	}

	post := stellar1.RequestPost{
		Amount:   arg.Amount,
		Asset:    arg.Asset,
		Currency: arg.Currency,
	}

	switch {
	case recipient.User != nil:
		post.ToAssertion = recipient.User.Username.String()
		post.ToUser = &recipient.User.UV
	case recipient.Assertion != nil:
		post.ToAssertion = recipient.Assertion.String()
	default:
		return ret, fmt.Errorf("expected username or user assertion as recipient")
	}

	requestID, err := remoter.SubmitRequest(m.Ctx(), post)
	if err != nil {
		return ret, err
	}

	body := chat1.NewMessageBodyWithRequestpayment(chat1.MessageRequestPayment{
		RequestID: requestID,
		Note:      arg.Note,
	})

	displayName := strings.Join([]string{m.CurrentUsername().String(), post.ToAssertion}, ",")

	membersType := chat1.ConversationMembersType_IMPTEAMNATIVE
	err = m.G().ChatHelper.SendMsgByName(m.Ctx(), displayName, nil,
		membersType, keybase1.TLFIdentifyBehavior_CHAT_SKIP, body, chat1.MessageType_REQUESTPAYMENT)
	return requestID, err
}

// Lookup a user who has the stellar account ID.
// Verifies the result against the user's sigchain.
// If there are no users, or multiple users, returns NotFoundError.
func LookupUserByAccountID(m libkb.MetaContext, accountID stellar1.AccountID) (uv keybase1.UserVersion, un libkb.NormalizedUsername, err error) {
	defer m.TraceTimed(fmt.Sprintf("Stellar.LookupUserByAccount(%v)", accountID), func() error { return err })()
	usersUnverified, err := remote.LookupUnverified(m.Ctx(), m.G(), accountID)
	if err != nil {
		return uv, un, err
	}
	m.Debug("got %v unverified results", len(usersUnverified))
	for i, uv := range usersUnverified {
		m.Debug("usersUnverified[%v] = %v", i, uv)
	}
	if len(usersUnverified) == 0 {
		return uv, un, libkb.NotFoundError{Msg: fmt.Sprintf("No user found with account %v", accountID)}
	}
	if len(usersUnverified) > 1 {
		return uv, un, libkb.NotFoundError{Msg: fmt.Sprintf("Multiple users found with account: %v", accountID)}
	}
	uv = usersUnverified[0]
	// Verify that `uv` (from server) matches `accountID`.
	verify := func(forcePoll bool) (upak *keybase1.UserPlusKeysV2AllIncarnations, retry bool, err error) {
		defer m.TraceTimed(fmt.Sprintf("verify(forcePoll:%v, accountID:%v, uv:%v)", forcePoll, accountID, uv), func() error { return err })()
		upak, _, err = m.G().GetUPAKLoader().LoadV2(
			libkb.NewLoadUserArgWithMetaContext(m).WithPublicKeyOptional().WithUID(uv.Uid).WithForcePoll(forcePoll))
		if err != nil {
			return nil, false, err
		}
		genericErr := errors.New("error verifying account lookup")
		if !upak.Current.EldestSeqno.Eq(uv.EldestSeqno) {
			m.Debug("user %v's eldest seqno did not match %v != %v", upak.Current.Username, upak.Current.EldestSeqno, uv.EldestSeqno)
			return nil, true, genericErr
		}
		if upak.Current.StellarAccountID == nil {
			m.Debug("user %v has no stellar account", upak.Current.Username)
			return nil, true, genericErr
		}
		unverifiedAccountID, err := libkb.ParseStellarAccountID(*upak.Current.StellarAccountID)
		if err != nil {
			m.Debug("user has invalid account ID '%v': %v", *upak.Current.StellarAccountID, err)
			return nil, false, genericErr
		}
		if !unverifiedAccountID.Eq(accountID) {
			m.Debug("user %v has different account %v != %v", upak.Current.Username, unverifiedAccountID, accountID)
			return nil, true, genericErr
		}
		return upak, false, nil
	}
	upak, retry, err := verify(false)
	if err == nil {
		return upak.Current.ToUserVersion(), libkb.NewNormalizedUsername(upak.Current.GetName()), err
	}
	if !retry {
		return keybase1.UserVersion{}, "", err
	}
	// Try again with ForcePoll in case the previous attempt lost a race.
	upak, _, err = verify(true)
	if err != nil {
		return keybase1.UserVersion{}, "", err
	}
	return upak.Current.ToUserVersion(), libkb.NewNormalizedUsername(upak.Current.GetName()), err
}

// AccountExchangeRate returns the exchange rate for an account for the logged in user.
// Note that it is possible that multiple users can own the same account and have
// different display currency preferences.
func AccountExchangeRate(mctx libkb.MetaContext, remoter remote.Remoter, accountID stellar1.AccountID) (stellar1.OutsideExchangeRate, error) {
	currency, err := GetCurrencySetting(mctx, accountID)
	if err != nil {
		return stellar1.OutsideExchangeRate{}, err
	}

	return remoter.ExchangeRate(mctx.Ctx(), string(currency.Code))
}

func RefreshUnreadCount(g *libkb.GlobalContext, accountID stellar1.AccountID) {
	g.Log.Debug("RefreshUnreadCount for stellar account %s", accountID)
	s := getGlobal(g)
	ctx := context.Background()
	details, err := s.remoter.Details(ctx, accountID)
	if err != nil {
		return
	}
	g.Log.Debug("RefreshUnreadCount got details for stellar account %s", accountID)

	err = s.UpdateUnreadCount(ctx, accountID, details.UnreadPayments)
	if err != nil {
		g.Log.Debug("RefreshUnreadCount UpdateUnreadCount error: %s", err)
	} else {
		g.Log.Debug("RefreshUnreadCount UpdateUnreadCount => %d for stellar account %s", details.UnreadPayments, accountID)
	}
}

// Get a per-user key.
// Wait for attempt but only warn on error.
func perUserKeyUpgradeSoft(mctx libkb.MetaContext, reason string) {
	arg := &engine.PerUserKeyUpgradeArgs{}
	eng := engine.NewPerUserKeyUpgrade(mctx.G(), arg)
	err := engine.RunEngine2(mctx, eng)
	if err != nil {
		mctx.Debug("PerUserKeyUpgrade failed (%s): %v", reason, err)
	}
}

func HasAcceptedDisclaimer(ctx context.Context, g *libkb.GlobalContext) (bool, error) {
	return getGlobal(g).hasAcceptedDisclaimer(ctx)
}

func InformAcceptedDisclaimer(ctx context.Context, g *libkb.GlobalContext) {
	getGlobal(g).informAcceptedDisclaimer(ctx)
}

func RandomBuildPaymentID() (stellar1.BuildPaymentID, error) {
	randBytes, err := libkb.RandBytes(15)
	if err != nil {
		return "", err
	}
	return stellar1.BuildPaymentID("bb" + hex.EncodeToString(randBytes)), nil
}

func AllWalletAccounts(mctx libkb.MetaContext, remoter remote.Remoter) ([]stellar1.WalletAccountLocal, error) {
	bundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return nil, err
	}

	dumpBundle := false
	var accts []stellar1.WalletAccountLocal
	for _, entry := range bundle.Accounts {
		acct, err := accountLocal(mctx, remoter, entry)
		if err != nil {
			if err != remote.ErrAccountIDMissing {
				return nil, err
			}
			mctx.Debug("bundle entry has empty account id: %+v", entry)
			dumpBundle = true // log the full bundle later

			// skip this entry
			continue
		}

		if acct.AccountID.IsNil() {
			mctx.Debug("accountLocal for entry %+v returned nil account id", entry)
		}

		accts = append(accts, acct)
	}

	if dumpBundle {
		mctx.Debug("Full bundle: %+v", bundle)
	}

	// Put the primary account first, then sort by name, then by account ID
	sort.SliceStable(accts, func(i, j int) bool {
		if accts[i].IsDefault {
			return true
		}
		if accts[j].IsDefault {
			return false
		}
		if accts[i].Name == accts[j].Name {
			return accts[i].AccountID < accts[j].AccountID
		}
		return accts[i].Name < accts[j].Name
	})

	// debugging empty account id
	mctx.Debug("AllWalletAccounts returning %d accounts:", len(accts))
	for i, a := range accts {
		mctx.Debug("%d: %q (default: %v)", i, a.AccountID, a.IsDefault)
		if a.AccountID.IsNil() {
			mctx.Debug("%d: account id is empty (%+v) !!!!!!", a)
		}
	}

	return accts, nil
}

// WalletAccount returns stellar1.WalletAccountLocal for accountID.
func WalletAccount(mctx libkb.MetaContext, remoter remote.Remoter, accountID stellar1.AccountID) (stellar1.WalletAccountLocal, error) {
	bundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return stellar1.WalletAccountLocal{}, err
	}
	entry, err := bundle.Lookup(accountID)
	if err != nil {
		return stellar1.WalletAccountLocal{}, err
	}

	return accountLocal(mctx, remoter, entry)
}

func accountLocal(mctx libkb.MetaContext, remoter remote.Remoter, entry stellar1.BundleEntry) (stellar1.WalletAccountLocal, error) {
	var empty stellar1.WalletAccountLocal
	details, err := AccountDetails(mctx, remoter, entry.AccountID)
	if err != nil {
		mctx.Debug("remote.Details failed for %q: %s", entry.AccountID, err)
		return empty, err
	}

	if details.AccountID.IsNil() {
		mctx.Debug("AccountDetails for entry.AccountID %q returned empty account id (full details: %+v)", entry.AccountID, details)
	}

	return AccountDetailsToWalletAccountLocal(mctx, entry.AccountID, details, entry.IsPrimary, entry.Name, entry.Mode)
}

// AccountDetails gets stellar1.AccountDetails for accountID.
//
// It has the side effect of updating the badge state with the
// stellar payment unread count for accountID.
func AccountDetails(mctx libkb.MetaContext, remoter remote.Remoter, accountID stellar1.AccountID) (stellar1.AccountDetails, error) {
	details, err := remoter.Details(mctx.Ctx(), accountID)
	details.SetDefaultDisplayCurrency()
	if err != nil {
		return details, err
	}

	err = mctx.G().GetStellar().UpdateUnreadCount(mctx.Ctx(), accountID, details.UnreadPayments)
	if err != nil {
		mctx.Debug("AccountDetails UpdateUnreadCount error: %s", err)
	}

	return details, nil
}

func AirdropStatus(mctx libkb.MetaContext) (stellar1.AirdropStatus, error) {
	apiStatus, err := remote.AirdropStatus(mctx)
	if err != nil {
		return stellar1.AirdropStatus{}, err
	}
	return TransformToAirdropStatus(apiStatus), nil
}

func FindPaymentPath(mctx libkb.MetaContext, remoter remote.Remoter, source stellar1.AccountID, to string, sourceAsset, destinationAsset stellar1.Asset, amount string) (stellar1.PaymentPath, error) {
	recipient, err := LookupRecipient(mctx, stellarcommon.RecipientInput(to), false)
	if err != nil {
		return stellar1.PaymentPath{}, err
	}
	if recipient.AccountID == nil {
		return stellar1.PaymentPath{}, errors.New("cannot send a path payment to a user without a stellar account")
	}

	sourceEntry, _, err := LookupSender(mctx, source)
	if err != nil {
		return stellar1.PaymentPath{}, err
	}

	query := stellar1.PaymentPathQuery{
		Source:           sourceEntry.AccountID,
		Destination:      stellar1.AccountID(recipient.AccountID.String()),
		SourceAsset:      sourceAsset,
		DestinationAsset: destinationAsset,
		Amount:           amount,
	}
	return remoter.FindPaymentPath(mctx, query)
}

func FuzzyAssetSearch(mctx libkb.MetaContext, remoter remote.Remoter, arg stellar1.FuzzyAssetSearchArg) ([]stellar1.Asset, error) {
	return remoter.FuzzyAssetSearch(mctx, arg)
}

func ListPopularAssets(mctx libkb.MetaContext, remoter remote.Remoter, arg stellar1.ListPopularAssetsArg) (stellar1.AssetListResult, error) {
	return remoter.ListPopularAssets(mctx, arg)
}
