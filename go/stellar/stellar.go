package stellar

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/keybase/client/go/stellar/relays"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/amount"
	"github.com/stellar/go/xdr"
)

// CreateWallet creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe (but wasteful) to call even if the user has a bundle already.
func CreateWallet(ctx context.Context, g *libkb.GlobalContext) (created bool, err error) {
	defer g.CTraceTimed(ctx, "Stellar.CreateWallet", func() error { return err })()
	clearBundle, err := bundle.NewInitialBundle()
	if err != nil {
		return created, err
	}
	meUV, err := g.GetMeUV(ctx)
	if err != nil {
		return false, err
	}
	err = remote.PostWithChainlink(ctx, g, clearBundle)
	switch e := err.(type) {
	case nil:
		// ok
	case libkb.AppStatusError:
		switch keybase1.StatusCode(e.Code) {
		case keybase1.StatusCode_SCStellarWrongRevision:
			// Assume this happened because a bundle already existed.
			// And suppress the error.
			g.Log.CDebugf(ctx, "suppressing error: %v", err)
			return false, nil
		}
		return false, err
	default:
		return false, err
	}
	primary, err := clearBundle.PrimaryAccount()
	if err != nil {
		g.Log.CErrorf(ctx, "We've just posted a bundle that's missing PrimaryAccount: %s", err)
		return false, err
	}
	if err := remote.SetAccountDefaultCurrency(ctx, g, primary.AccountID, "USD"); err != nil {
		g.Log.CWarningf(ctx, "Error during setting display currency for %q: %s", primary.AccountID, err)
	}
	getGlobal(g).InformHasWallet(ctx, meUV)
	return true, nil
}

// CreateWalletGated may create a wallet for the user.
// Taking into account settings from the server and env.
// It should be speedy to call repeatedly _if_ the user gets a wallet.
// `hasWallet` returns whether the user has by the time this call returns.
func CreateWalletGated(ctx context.Context, g *libkb.GlobalContext) (justCreated, hasWallet bool, err error) {
	defer g.CTraceTimed(ctx, "Stellar.CreateWalletGated", func() error { return err })()
	defer func() {
		g.Log.CDebugf(ctx, "CreateWalletGated: (justCreated:%v, hasWallet:%v, err:%v)", justCreated, hasWallet, err != nil)
	}()
	meUV, err := g.GetMeUV(ctx)
	if err != nil {
		return false, false, err
	}
	if getGlobal(g).CachedHasWallet(ctx, meUV) {
		g.Log.CDebugf(ctx, "CreateWalletGated: local cache says we already have a wallet")
		return false, true, nil
	}
	shouldCreate, hasWallet, err := remote.ShouldCreate(ctx, g)
	if err != nil {
		return false, false, err
	}
	if hasWallet {
		g.Log.CDebugf(ctx, "CreateWalletGated: server says we already have a wallet")
		getGlobal(g).InformHasWallet(ctx, meUV)
		return false, hasWallet, nil
	}
	if !shouldCreate {
		g.Log.CDebugf(ctx, "CreateWalletGated: server did not recommend wallet creation")
		return false, hasWallet, nil
	}
	if !g.Env.GetAutoWallet() {
		g.Log.CDebugf(ctx, "CreateWalletGated: disabled by env setting")
		return false, hasWallet, nil
	}
	justCreated, err = CreateWallet(ctx, g)
	if err != nil {
		return false, hasWallet, err
	}
	return justCreated, true, nil
}

// CreateWalletSoft creates a user's initial wallet if they don't already have one.
// Does not get in the way of intentional user actions.
func CreateWalletSoft(ctx context.Context, g *libkb.GlobalContext) {
	var err error
	defer g.CTraceTimed(ctx, "CreateWalletSoft", func() error { return err })()
	if !g.LocalSigchainGuard().IsAvailable(ctx, "CreateWalletSoft") {
		err = fmt.Errorf("yielding to guard")
		return
	}
	_, _, err = CreateWalletGated(ctx, g)
	return
}

// Upkeep makes sure the bundle is encrypted for the user's latest PUK.
func Upkeep(ctx context.Context, g *libkb.GlobalContext) (err error) {
	defer g.CTraceTimed(ctx, "Stellar.Upkeep", func() error { return err })()
	prevBundle, prevPukGen, err := remote.Fetch(ctx, g)
	if err != nil {
		return err
	}
	pukring, err := g.GetPerUserKeyring()
	if err != nil {
		return err
	}
	err = pukring.Sync(libkb.NewMetaContext(ctx, g))
	if err != nil {
		return err
	}
	pukGen := pukring.CurrentGeneration()
	if pukGen <= prevPukGen {
		g.Log.CDebugf(ctx, "Stellar.Upkeep: early out prevPukGen:%v < pukGen:%v", prevPukGen, pukGen)
		return nil
	}
	nextBundle := bundle.Advance(prevBundle)
	return remote.Post(ctx, g, nextBundle)
}

func ImportSecretKey(ctx context.Context, g *libkb.GlobalContext, secretKey stellar1.SecretKey, makePrimary bool, accountName string) (err error) {
	prevBundle, _, err := remote.Fetch(ctx, g)
	if err != nil {
		return err
	}
	nextBundle := bundle.Advance(prevBundle)
	err = bundle.AddAccount(&nextBundle, secretKey, accountName, makePrimary)
	if err != nil {
		return err
	}
	if makePrimary {
		return remote.PostWithChainlink(ctx, g, nextBundle)
	}
	return remote.Post(ctx, g, nextBundle)
}

func ExportSecretKey(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (res stellar1.SecretKey, err error) {
	prevBundle, _, err := remote.Fetch(ctx, g)
	if err != nil {
		return res, err
	}
	for _, account := range prevBundle.Accounts {
		if account.AccountID.Eq(accountID) && account.Mode == stellar1.AccountMode_USER {
			if len(account.Signers) == 0 {
				return res, fmt.Errorf("no secret keys found for account")
			}
			if len(account.Signers) != 1 {
				return res, fmt.Errorf("expected 1 secret key but found %v", len(account.Signers))
			}
			return account.Signers[0], nil
		}
	}
	_, _, _, parseSecErr := libkb.ParseStellarSecretKey(accountID.String())
	if parseSecErr == nil {
		// Just in case a secret key worked its way in here
		return res, fmt.Errorf("account not found: unexpected secret key")
	}
	return res, fmt.Errorf("account not found: %v", accountID)
}

func OwnAccount(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (bool, error) {
	bundle, _, err := remote.Fetch(ctx, g)
	if err != nil {
		return false, err
	}

	for _, account := range bundle.Accounts {
		if account.AccountID.Eq(accountID) {
			return true, nil
		}
	}

	return false, nil
}

func lookupSenderEntry(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (stellar1.BundleEntry, error) {
	bundle, _, err := remote.Fetch(ctx, g)
	if err != nil {
		return stellar1.BundleEntry{}, err
	}

	if accountID == "" {
		return bundle.PrimaryAccount()
	}

	for _, entry := range bundle.Accounts {
		if entry.AccountID.Eq(accountID) {
			return entry, nil
		}
	}

	return stellar1.BundleEntry{}, libkb.NotFoundError{Msg: fmt.Sprintf("Sender account not found")}
}

func LookupSender(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (stellar1.BundleEntry, error) {
	entry, err := lookupSenderEntry(ctx, g, accountID)
	if err != nil {
		return stellar1.BundleEntry{}, err
	}
	if len(entry.Signers) == 0 {
		return stellar1.BundleEntry{}, errors.New("no signer for bundle")
	}
	if len(entry.Signers) > 1 {
		return stellar1.BundleEntry{}, errors.New("only single signer supported")
	}

	return entry, nil
}

// TODO: handle stellar federation address rebecca*keybase.io (or rebecca*anything.wow)
func LookupRecipient(m libkb.MetaContext, to stellarcommon.RecipientInput) (res stellarcommon.Recipient, err error) {
	defer m.CTraceTimed("Stellar.LookupRecipient", func() error { return err })()
	res = stellarcommon.Recipient{
		Input: to,
	}

	storeAddress := func(address string) error {
		accountID, err := stellarnet.NewAddressStr(address)
		if err != nil {
			return err
		}
		res.AccountID = &accountID
		return nil
	}

	// A Stellar address
	if to[0] == 'G' && len(to) > 16 {
		err := storeAddress(string(to))
		if err != nil {
			return res, err
		}
		return res, nil
	}

	idRes, err := identifyRecipient(m, string(to))
	if err != nil {
		return res, err
	}
	m.CDebugf("identifyRecipient: identify result for %s: %+v", to, idRes)
	if idRes.Breaks != nil {
		m.CDebugf("identifyRecipient: TrackBreaks = %+v", idRes.Breaks)
		return res, libkb.TrackingBrokeError{}
	}

	if idRes.User.Username == "" {
		expr, err := externals.AssertionParse(string(to))
		if err != nil {
			m.CDebugf("error parsing assertion: %s", err)
			return res, fmt.Errorf("invalid recipient %q: %s", to, err)
		}

		// valid assertion, but not a user yet
		m.CDebugf("assertion %s (%s) is valid, but not a user yet", to, expr)
		social, err := expr.ToSocialAssertion()
		if err != nil {
			m.CDebugf("not a social assertion: %s (%s)", to, expr)
			if _, ok := expr.(libkb.AssertionKeybase); ok {
				return res, libkb.NotFoundError{Msg: fmt.Sprintf("user not found: %q", to)}
			}
			return res, fmt.Errorf("invalid recipient %q: %s", to, err)
		}
		res.Assertion = &social
		return res, nil
	}

	username := idRes.User.Username

	// load the user to get its wallet
	user, err := libkb.LoadUser(
		libkb.NewLoadUserByNameArg(m.G(), username).
			WithNetContext(m.Ctx()).
			WithPublicKeyOptional())
	if err != nil {
		return res, err
	}
	res.User = user
	accountID := user.StellarWalletAddress()
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

type SendPaymentArg struct {
	From           stellar1.AccountID // Optional. Defaults to primary account.
	FromSeqno      *uint64            // Optional. Use this value for the from stellar sequence number.
	To             stellarcommon.RecipientInput
	Amount         string // Amount of XLM to send.
	DisplayBalance DisplayBalance
	SecretNote     string // Optional.
	PublicMemo     string // Optional.
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
}

// SendPayment sends XLM.
// Recipient:
// Stellar address        : Standard payment
// User with wallet ready : Standard payment
// User without a wallet  : Relay payment
// Unresolved assertion   : Relay payment
func SendPayment(m libkb.MetaContext, remoter remote.Remoter, sendArg SendPaymentArg) (res SendPaymentResult, err error) {
	defer m.CTraceTimed("Stellar.SendPayment", func() error { return err })()

	// look up sender account
	senderEntry, err := LookupSender(m.Ctx(), m.G(), sendArg.From)
	if err != nil {
		return res, err
	}
	senderSeed := senderEntry.Signers[0]

	// look up recipient
	recipient, err := LookupRecipient(m, sendArg.To)
	if err != nil {
		return res, err
	}

	m.CDebugf("using stellar network passphrase: %q", stellarnet.Network().Passphrase)

	if recipient.AccountID == nil || sendArg.ForceRelay {
		return sendRelayPayment(m, remoter,
			senderSeed, sendArg.FromSeqno, recipient, sendArg.Amount, sendArg.DisplayBalance,
			sendArg.SecretNote, sendArg.PublicMemo, sendArg.QuickReturn)
	}

	senderSeed2, err := stellarnet.NewSeedStr(senderSeed.SecureNoLogString())
	if err != nil {
		return res, err
	}

	post := stellar1.PaymentDirectPost{
		FromDeviceID:    m.G().ActiveDevice.DeviceID(),
		DisplayAmount:   sendArg.DisplayBalance.Amount,
		DisplayCurrency: sendArg.DisplayBalance.Currency,
		QuickReturn:     sendArg.QuickReturn,
	}
	if recipient.User != nil {
		tmp := recipient.User.ToUserVersion()
		post.To = &tmp
	}

	sp := NewSeqnoProvider(m.Ctx(), remoter)
	if sendArg.FromSeqno != nil {
		sp.Override(senderEntry.AccountID.String(), xdr.SequenceNumber(*sendArg.FromSeqno))
	}

	// check if recipient account exists
	var txID string
	funded, err := isAccountFunded(m.Ctx(), remoter, stellar1.AccountID(recipient.AccountID.String()))
	if err != nil {
		return res, fmt.Errorf("error checking destination account balance: %v", err)
	}
	if !funded {
		// if no balance, create_account operation
		// we could check here to make sure that amount is at least 1XLM
		// but for now, just let stellar-core tell us there was an error
		sig, err := stellarnet.CreateAccountXLMTransaction(senderSeed2, *recipient.AccountID, sendArg.Amount, sendArg.PublicMemo, sp)
		if err != nil {
			return res, err
		}
		post.SignedTransaction = sig.Signed
		txID = sig.TxHash
	} else {
		// if balance, payment operation
		sig, err := stellarnet.PaymentXLMTransaction(senderSeed2, *recipient.AccountID, sendArg.Amount, sendArg.PublicMemo, sp)
		if err != nil {
			return res, err
		}
		post.SignedTransaction = sig.Signed
		txID = sig.TxHash
	}

	if len(sendArg.SecretNote) > 0 {
		noteClear := stellar1.NoteContents{
			Note:      sendArg.SecretNote,
			StellarID: stellar1.TransactionID(txID),
		}
		var recipientUv *keybase1.UserVersion
		if recipient.User != nil {
			tmp := recipient.User.ToUserVersion()
			recipientUv = &tmp
		}
		post.NoteB64, err = NoteEncryptB64(m.Ctx(), m.G(), noteClear, recipientUv)
		if err != nil {
			return res, fmt.Errorf("error encrypting note: %v", err)
		}
	}

	// submit the transaction
	rres, err := remoter.SubmitPayment(m.Ctx(), post)
	if err != nil {
		return res, err
	}

	if err := ChatSendPaymentMessage(m, recipient, rres.KeybaseID); err != nil {
		// if the chat message fails to send, just log the error
		m.CDebugf("failed to send chat SendPayment message: %s", err)
	}

	return SendPaymentResult{
		KbTxID:  rres.KeybaseID,
		TxID:    rres.StellarID,
		Pending: rres.Pending,
	}, nil
}

// sendRelayPayment sends XLM through a relay account.
// The balance of the relay account can be claimed by either party.
func sendRelayPayment(m libkb.MetaContext, remoter remote.Remoter,
	from stellar1.SecretKey, fromSeqno *uint64, recipient stellarcommon.Recipient, amount string, displayBalance DisplayBalance,
	secretNote string, publicMemo string, quickReturn bool) (res SendPaymentResult, err error) {
	defer m.CTraceTimed("Stellar.sendRelayPayment", func() error { return err })()
	appKey, teamID, err := relays.GetKey(m.Ctx(), m.G(), recipient)
	if err != nil {
		return res, err
	}
	sp := NewSeqnoProvider(m.Ctx(), remoter)
	if fromSeqno != nil {
		fromAccountID, err := accountIDFromSecretKey(from)
		if err != nil {
			return res, err
		}
		sp.Override(fromAccountID.String(), xdr.SequenceNumber(*fromSeqno))
	}
	relay, err := relays.Create(relays.Input{
		From:          from,
		AmountXLM:     amount,
		Note:          secretNote,
		PublicMemo:    publicMemo,
		EncryptFor:    appKey,
		SeqnoProvider: sp,
	})
	if err != nil {
		return res, err
	}
	post := stellar1.PaymentRelayPost{
		FromDeviceID:      m.G().ActiveDevice.DeviceID(),
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
		tmp := recipient.User.ToUserVersion()
		post.To = &tmp
	}
	rres, err := remoter.SubmitRelayPayment(m.Ctx(), post)
	if err != nil {
		return res, err
	}

	if err := ChatSendPaymentMessage(m, recipient, rres.KeybaseID); err != nil {
		// if the chat message fails to send, just log the error
		m.CDebugf("failed to send chat SendPayment message: %s", err)
	}

	return SendPaymentResult{
		KbTxID:      rres.KeybaseID,
		TxID:        rres.StellarID,
		Pending:     rres.Pending,
		RelayTeamID: &teamID,
	}, nil
}

// Claim claims a waiting relay.
// If `dir` is nil the direction is inferred.
func Claim(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter,
	txID string, into stellar1.AccountID, dir *stellar1.RelayDirection,
	autoClaimToken *string) (res stellar1.RelayClaimResult, err error) {
	defer g.CTraceTimed(ctx, "Stellar.Claim", func() error { return err })()
	g.Log.CDebugf(ctx, "Stellar.Claim(txID:%v, into:%v, dir:%v, autoClaimToken:%v)", txID, into, dir, autoClaimToken)
	details, err := remoter.PaymentDetails(ctx, txID)
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
		return claimPaymentWithDetail(ctx, g, remoter, p.Relay(), into, dir)
	default:
		return res, fmt.Errorf("unrecognized payment type: %v", typ)
	}
}

// If `dir` is nil the direction is inferred.
func claimPaymentWithDetail(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter,
	p stellar1.PaymentSummaryRelay, into stellar1.AccountID, dir *stellar1.RelayDirection) (res stellar1.RelayClaimResult, err error) {
	if p.Claim != nil && p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
		recipient, _, err := g.GetUPAKLoader().Load(libkb.NewLoadUserByUIDArg(ctx, g, p.Claim.To.Uid))
		if err != nil || recipient == nil {
			return res, fmt.Errorf("Payment already claimed")
		}
		return res, fmt.Errorf("Payment already claimed by %v", recipient.GetName())
	}
	rsec, err := relays.DecryptB64(ctx, g, p.TeamID, p.BoxB64)
	if err != nil {
		return res, fmt.Errorf("error opening secret to claim: %v", err)
	}
	skey, _, _, err := libkb.ParseStellarSecretKey(rsec.Sk.SecureNoLogString())
	if err != nil {
		return res, fmt.Errorf("error using shared secret key: %v", err)
	}
	destinationFunded, err := isAccountFunded(ctx, remoter, into)
	if err != nil {
		return res, err
	}
	useDir := stellar1.RelayDirection_CLAIM
	if dir == nil {
		// Infer direction
		if p.From.Uid.Equal(g.ActiveDevice.UID()) {
			useDir = stellar1.RelayDirection_YANK
		}
	} else {
		// Direction from caller
		useDir = *dir
	}
	sp := NewSeqnoProvider(ctx, remoter)
	sig, err := stellarnet.RelocateTransaction(stellarnet.SeedStr(skey.SecureNoLogString()),
		stellarnet.AddressStr(into.String()), destinationFunded, sp)
	if err != nil {
		return res, fmt.Errorf("error building claim transaction: %v", err)
	}
	return remoter.SubmitRelayClaim(ctx, stellar1.RelayClaimPost{
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
	for _, b := range balances {
		if b.Asset.IsNativeXLM() {
			a, err := amount.ParseInt64(b.Amount)
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

func GetOwnPrimaryAccountID(ctx context.Context, g *libkb.GlobalContext) (res stellar1.AccountID, err error) {
	activeBundle, _, err := remote.Fetch(ctx, g)
	if err != nil {
		return res, err
	}
	primary, err := activeBundle.PrimaryAccount()
	if err != nil {
		return res, err
	}
	return primary.AccountID, nil
}

func RecentPaymentsCLILocal(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter, accountID stellar1.AccountID) (res []stellar1.PaymentOrErrorCLILocal, err error) {
	defer g.CTraceTimed(ctx, "Stellar.RecentPaymentsCLILocal", func() error { return err })()
	page, err := remoter.RecentPayments(ctx, accountID, nil, 0)
	if err != nil {
		return nil, err
	}
	for _, p := range page.Payments {
		lp, err := localizePayment(ctx, g, p)
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
	payment, err := remoter.PaymentDetails(ctx, txID)
	if err != nil {
		return res, err
	}
	return localizePayment(ctx, g, payment.Summary)
}

func localizePayment(ctx context.Context, g *libkb.GlobalContext, p stellar1.PaymentSummary) (res stellar1.PaymentCLILocal, err error) {
	typ, err := p.Typ()
	if err != nil {
		return res, fmt.Errorf("malformed payment summary: %v", err)
	}
	username := func(uid keybase1.UID) (username *string, err error) {
		uname, err := g.GetUPAKLoader().LookupUsername(ctx, uid)
		if err != nil {
			return nil, err
		}
		tmp := uname.String()
		return &tmp, nil
	}
	switch typ {
	case stellar1.PaymentSummaryType_STELLAR:
		p := p.Stellar()
		return stellar1.PaymentCLILocal{
			TxID:        p.TxID,
			Time:        p.Ctime,
			Status:      "Completed",
			Amount:      p.Amount,
			Asset:       p.Asset,
			FromStellar: p.From,
			ToStellar:   &p.To,
		}, nil
	case stellar1.PaymentSummaryType_DIRECT:
		p := p.Direct()
		res = stellar1.PaymentCLILocal{
			TxID:            p.TxID,
			Time:            p.Ctime,
			Amount:          p.Amount,
			Asset:           p.Asset,
			DisplayAmount:   p.DisplayAmount,
			DisplayCurrency: p.DisplayCurrency,
			FromStellar:     p.FromStellar,
			ToStellar:       &p.ToStellar,
		}
		res.Status, res.StatusDetail = p.TxStatus.Details(p.TxErrMsg)
		res.FromUsername, err = username(p.From.Uid)
		if err != nil {
			return res, err
		}
		if p.To != nil {
			res.ToUsername, err = username(p.To.Uid)
			if err != nil {
				return res, err
			}
		}
		if len(p.NoteB64) > 0 {
			note, err := NoteDecryptB64(ctx, g, p.NoteB64)
			if err != nil {
				res.NoteErr = fmt.Sprintf("failed to decrypt payment note: %v", err)
			} else {
				if note.StellarID != p.TxID {
					res.NoteErr = "discarded note for wrong transaction ID"
				} else {
					res.Note = note.Note
				}
			}
			if len(res.NoteErr) > 0 {
				g.Log.CWarningf(ctx, res.NoteErr)
			}
		}
		return res, nil
	case stellar1.PaymentSummaryType_RELAY:
		p := p.Relay()
		res = stellar1.PaymentCLILocal{
			TxID:            p.TxID,
			Time:            p.Ctime,
			Amount:          p.Amount,
			Asset:           stellar1.AssetNative(),
			DisplayAmount:   p.DisplayAmount,
			DisplayCurrency: p.DisplayCurrency,
			FromStellar:     p.FromStellar,
		}
		if p.TxStatus != stellar1.TransactionStatus_SUCCESS {
			// If the funding tx is not complete
			res.Status, res.StatusDetail = p.TxStatus.Details(p.TxErrMsg)
		} else {
			res.Status = "Claimable"
			res.StatusDetail = "Waiting for the recipient to open the app to claim, or the sender to cancel."
		}
		res.FromUsername, err = username(p.From.Uid)
		if err != nil {
			return res, err
		}
		if p.To != nil {
			res.ToUsername, err = username(p.To.Uid)
			if err != nil {
				return res, err
			}
		}
		if p.ToAssertion != "" {
			res.ToAssertion = &p.ToAssertion
		}
		// Override status with claim status
		if p.Claim != nil {
			if p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
				// If the claim succeeded, the relay payment is done.
				res.Status = "Completed"
				res.ToStellar = &p.Claim.ToStellar
				res.ToUsername, err = username(p.Claim.To.Uid)
				if err != nil {
					return res, err
				}
			} else {
				claimantUsername, err := username(p.Claim.To.Uid)
				if err != nil {
					return res, err
				}
				res.Status, res.StatusDetail = p.Claim.TxStatus.Details(p.Claim.TxErrMsg)
				res.Status = fmt.Sprintf("Funded. Claim by %v is: %v", claimantUsername, res.Status)
			}
		}
		relaySecrets, err := relays.DecryptB64(ctx, g, p.TeamID, p.BoxB64)
		if err == nil {
			res.Note = relaySecrets.Note
		} else {
			res.NoteErr = fmt.Sprintf("error decrypting note box: %v", err)
		}
		return res, nil
	default:
		return res, fmt.Errorf("unrecognized payment summary type: %v", typ)
	}
}

func identifyRecipient(m libkb.MetaContext, assertion string) (keybase1.TLFIdentifyFailure, error) {
	reason := fmt.Sprintf("Find transaction recipient for %s", assertion)
	arg := keybase1.Identify2Arg{
		UserAssertion:    assertion,
		UseDelegateUI:    true,
		Reason:           keybase1.IdentifyReason{Reason: reason},
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CLI, // XXX needs adjusting?
	}

	eng := engine.NewResolveThenIdentify2(m.G(), &arg)
	err := engine.RunEngine2(m, eng)
	if err != nil {
		// Ignore these errors
		if _, ok := err.(libkb.NotFoundError); ok {
			m.CDebugf("identifyRecipient: not found %s: %s", assertion, err)
			return keybase1.TLFIdentifyFailure{}, nil
		}
		if _, ok := err.(libkb.ResolutionError); ok {
			m.CDebugf("identifyRecipient: resolution error %s: %s", assertion, err)
			return keybase1.TLFIdentifyFailure{}, nil
		}
	}

	resp := eng.Result()
	m.CDebugf("identifyRecipient: resp: %+v", resp)

	var frep keybase1.TLFIdentifyFailure
	if resp != nil {
		frep.User = keybase1.User{
			Uid:      resp.Upk.Uid,
			Username: resp.Upk.Username,
		}
		frep.Breaks = resp.TrackBreaks
	}

	return frep, nil
}

func FormatCurrency(ctx context.Context, g *libkb.GlobalContext, amount string, code stellar1.OutsideCurrencyCode) (string, error) {
	conf, err := g.GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return "", err
	}
	currency, ok := conf.Currencies[code]
	if !ok {
		return "", fmt.Errorf("FormatCurrency error: cannot find curency code %q", code)
	}

	amountFmt, err := FormatAmount(amount, true)
	if err != nil {
		return "", err
	}

	if currency.Symbol.Postfix {
		return fmt.Sprintf("%s %s", amountFmt, currency.Symbol.Symbol), nil
	}

	return fmt.Sprintf("%s%s", currency.Symbol.Symbol, amountFmt), nil
}

func FormatCurrencyLabel(ctx context.Context, g *libkb.GlobalContext, code stellar1.OutsideCurrencyCode) (string, error) {
	conf, err := g.GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return "", err
	}
	currency, ok := conf.Currencies[code]
	if !ok {
		return "", fmt.Errorf("FormatCurrencyLabel error: cannot find curency code %q", code)
	}
	return fmt.Sprintf("%s (%s)", code, currency.Symbol.Symbol), nil
}

func FormatPaymentAmountXLM(amount string, delta stellar1.BalanceDelta) (string, error) {
	desc, err := FormatAmountXLM(amount)
	if err != nil {
		return "", err
	}

	switch delta {
	case stellar1.BalanceDelta_DECREASE:
		desc = "- " + desc
	case stellar1.BalanceDelta_INCREASE:
		desc = "+ " + desc
	}

	return desc, nil
}

// Example: "157.5000000 XLM"
func FormatAmountXLM(amount string) (string, error) {
	return FormatAmountWithSuffix(amount, false, "XLM")
}

func FormatAmountWithSuffix(amount string, precisionTwo bool, suffix string) (string, error) {
	formatted, err := FormatAmount(amount, precisionTwo)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s %s", formatted, suffix), nil
}

func FormatAmount(amount string, precisionTwo bool) (string, error) {
	if amount == "" {
		return "", errors.New("empty amount")
	}
	x, err := stellarnet.ParseDecimalStrict(amount)
	if err != nil {
		return "", fmt.Errorf("unable to parse amount %s: %v", amount, err)
	}
	precision := 7
	if precisionTwo {
		precision = 2
	}
	s := x.FloatString(precision)
	parts := strings.Split(s, ".")
	if len(parts) != 2 {
		return "", fmt.Errorf("unable to parse amount %s", amount)
	}
	if parts[1] == "0000000" {
		// get rid of all zeros after point if default precision
		parts = parts[:1]
	}
	head := parts[0]
	if len(head) <= 3 {
		return strings.Join(parts, "."), nil
	}
	sinceComma := 0
	var b bytes.Buffer
	for i := len(head) - 1; i >= 0; i-- {
		if sinceComma == 3 && head[i] != '-' {
			b.WriteByte(',')
			sinceComma = 0
		}
		b.WriteByte(head[i])
		sinceComma++
	}
	parts[0] = reverse(b.String())

	return strings.Join(parts, "."), nil
}

func reverse(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < len(r)/2; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}

func ChangeAccountName(m libkb.MetaContext, accountID stellar1.AccountID, newName string) (err error) {
	prevBundle, _, err := remote.Fetch(m.Ctx(), m.G())
	if err != nil {
		return err
	}
	nextBundle := bundle.Advance(prevBundle)
	var found bool
	for i, acc := range nextBundle.Accounts {
		if acc.AccountID.Eq(accountID) {
			// Change Name in place to modify Account struct.
			nextBundle.Accounts[i].Name = newName
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("account not found: %v", accountID)
	}
	return remote.Post(m.Ctx(), m.G(), nextBundle)
}

func SetAccountAsPrimary(m libkb.MetaContext, accountID stellar1.AccountID) (err error) {
	if accountID.IsNil() {
		return errors.New("passed empty AccountID")
	}
	prevBundle, _, err := remote.Fetch(m.Ctx(), m.G())
	if err != nil {
		return err
	}
	nextBundle := bundle.Advance(prevBundle)
	var foundAccID, foundPrimary bool
	for i, acc := range nextBundle.Accounts {
		if acc.AccountID.Eq(accountID) {
			if acc.IsPrimary {
				// Nothing to do.
				return nil
			}
			nextBundle.Accounts[i].IsPrimary = true
			foundAccID = true
		} else if acc.IsPrimary {
			nextBundle.Accounts[i].IsPrimary = false
			foundPrimary = true
		}

		if foundAccID && foundPrimary {
			break
		}
	}
	if !foundAccID {
		return fmt.Errorf("account not found: %v", accountID)
	}
	return remote.PostWithChainlink(m.Ctx(), m.G(), nextBundle)
}

func DeleteAccount(m libkb.MetaContext, accountID stellar1.AccountID) error {
	if accountID.IsNil() {
		return errors.New("passed empty AccountID")
	}
	prevBundle, _, err := remote.Fetch(m.Ctx(), m.G())
	if err != nil {
		return err
	}
	nextBundle := bundle.Advance(prevBundle)
	var found bool
	for i, acc := range nextBundle.Accounts {
		if acc.AccountID.Eq(accountID) {
			if acc.IsPrimary {
				return fmt.Errorf("cannot delete primary account %v", accountID)
			}

			nextBundle.Accounts = append(nextBundle.Accounts[:i], nextBundle.Accounts[i+1:]...)
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("account not found: %v", accountID)
	}
	return remote.Post(m.Ctx(), m.G(), nextBundle)
}

func GetCurrencySetting(mctx libkb.MetaContext, remoter remote.Remoter, accountID stellar1.AccountID) (res stellar1.CurrencyLocal, err error) {
	codeStr, err := remote.GetAccountDisplayCurrency(mctx.Ctx(), mctx.G(), accountID)
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

func accountIDFromSecretKey(skey stellar1.SecretKey) (stellar1.AccountID, error) {
	_, res, _, err := libkb.ParseStellarSecretKey(skey.SecureNoLogString())
	return res, err
}

func CreateNewAccount(m libkb.MetaContext, accountName string) (ret stellar1.AccountID, err error) {
	prevBundle, _, err := remote.Fetch(m.Ctx(), m.G())
	if err != nil {
		return ret, err
	}
	nextBundle := bundle.Advance(prevBundle)
	ret, err = bundle.CreateNewAccount(&nextBundle, accountName, false /* makePrimary */)
	if err != nil {
		return ret, err
	}
	return ret, remote.Post(m.Ctx(), m.G(), nextBundle)
}

func ChatSendPaymentMessage(m libkb.MetaContext, recipient stellarcommon.Recipient, kbTxID stellar1.KeybaseTransactionID) error {
	if recipient.User == nil {
		// only send if recipient is keybase username
		return nil
	}

	name := strings.Join([]string{m.CurrentUsername().String(), recipient.User.GetNormalizedName().String()}, ",")

	msg := chat1.MessageSendPayment{
		KbTxID: kbTxID.String(),
	}

	body := chat1.NewMessageBodyWithSendpayment(msg)

	// identify already performed, so skip here
	return m.G().ChatHelper.SendMsgByNameNonblock(m.Ctx(), name, nil, chat1.ConversationMembersType_IMPTEAMNATIVE, keybase1.TLFIdentifyBehavior_CHAT_SKIP, body, chat1.MessageType_SENDPAYMENT)
}
