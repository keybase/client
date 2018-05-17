package stellar

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/keybase/client/go/stellar/relays"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/amount"
)

// CreateWallet creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe to call even if the user has a bundle already.
func CreateWallet(m libkb.MetaContext) (created bool, err error) {
	defer m.CTraceTimed("Stellar.CreateWallet", func() error { return err })()
	// TODO: short-circuit if the user has a bundle already
	clearBundle, err := bundle.NewInitialBundle()
	if err != nil {
		return created, err
	}
	err = remote.PostWithChainlink(m.Ctx(), m.G(), clearBundle)
	switch e := err.(type) {
	case nil:
		// ok
	case libkb.AppStatusError:
		switch keybase1.StatusCode(e.Code) {
		case keybase1.StatusCode_SCStellarWrongRevision:
			// Assume this happened because a bundle already existed.
			// And suppress the error.
			m.CDebugf("suppressing error: %v", err)
			return false, nil
		}
		return false, err
	default:
		return false, err
	}
	return true, err
}

func CreateWalletGated(m libkb.MetaContext) (created bool, err error) {
	defer m.CTraceTimed("Stellar.CreateWalletGated", func() error { return err })()
	// TODO: short-circuit if the user has a bundle already
	if !m.G().Env.GetAutoWallet() {
		m.CDebugf("CreateWalletGated disabled by env setting")
		return false, nil
	}
	should, err := remote.ShouldCreate(m.Ctx(), m.G())
	if err != nil {
		return false, err
	}
	if !should {
		m.CDebugf("server did not recommend wallet creation")
		return false, nil
	}
	return CreateWallet(m)
}

// CreateWalletSoft creates a user's initial wallet if they don't already have one.
// Does not get in the way of intentional user actions.
func CreateWalletSoft(m libkb.MetaContext) {
	var err error
	defer m.CTraceTimed("CreateWalletSoft", func() error { return err })()
	if !m.G().LocalSigchainGuard().IsAvailable(m.Ctx(), "CreateWalletSoft") {
		err = fmt.Errorf("yielding to guard")
		return
	}
	_, err = CreateWalletGated(m)
	return
}

// Upkeep makes sure the bundle is encrypted for the user's latest PUK.
func Upkeep(m libkb.MetaContext) (err error) {
	defer m.CTraceTimed("Stellar.Upkeep", func() error { return err })()
	prevBundle, prevPukGen, err := remote.Fetch(m.Ctx(), m.G())
	if err != nil {
		return err
	}
	pukring, err := m.G().GetPerUserKeyring()
	if err != nil {
		return err
	}
	err = pukring.Sync(m)
	if err != nil {
		return err
	}
	pukGen := pukring.CurrentGeneration()
	if pukGen <= prevPukGen {
		m.CDebugf("Stellar.Upkeep: early out prevPukGen:%v < pukGen:%v", prevPukGen, pukGen)
		return nil
	}
	nextBundle := bundle.Advance(prevBundle)
	return remote.Post(m.Ctx(), m.G(), nextBundle)
}

func ImportSecretKey(ctx context.Context, g *libkb.GlobalContext, secretKey stellar1.SecretKey, makePrimary bool) (err error) {
	prevBundle, _, err := remote.Fetch(ctx, g)
	if err != nil {
		return err
	}
	nextBundle := bundle.Advance(prevBundle)
	err = bundle.AddAccount(&nextBundle, secretKey, "", makePrimary)
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

func LookupSenderPrimary(ctx context.Context, g *libkb.GlobalContext) (stellar1.BundleEntry, error) {
	bundle, _, err := remote.Fetch(ctx, g)
	if err != nil {
		return stellar1.BundleEntry{}, err
	}

	primary, err := bundle.PrimaryAccount()
	if err != nil {
		return stellar1.BundleEntry{}, err
	}
	if len(primary.Signers) == 0 {
		return stellar1.BundleEntry{}, errors.New("no signer for primary bundle")
	}
	if len(primary.Signers) > 1 {
		return stellar1.BundleEntry{}, errors.New("only single signer supported")
	}

	return primary, nil
}

// TODO: handle stellar federation address rebecca*keybase.io (or rebecca*anything.wow)
func LookupRecipient(m libkb.MetaContext, to stellarcommon.RecipientInput) (stellarcommon.Recipient, error) {
	res := stellarcommon.Recipient{
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
			return res, fmt.Errorf("invalid recipient %q: %s", to, err)
		}
		res.Assertion = &social
		return res, nil
	}

	username := idRes.User.Username

	// load the user to get its wallet
	user, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(m.G(), username).WithNetContext(m.Ctx()))
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

// SendPayment sends XLM
// `note` is optional. An empty string will not attach a note.
// Recipient:
// Stellar address        : Standard payment
// User with wallet ready : Standard payment
// User without a wallet  : Relay payment
// Unresolved assertion   : Relay payment
func SendPayment(m libkb.MetaContext, remoter remote.Remoter, to stellarcommon.RecipientInput, amount string, note string, displayBalance DisplayBalance) (stellar1.PaymentResult, error) {
	var err error
	defer m.CTraceTimed("Stellar.SendPayment", func() error { return err })()
	// look up sender wallet
	primary, err := LookupSenderPrimary(m.Ctx(), m.G())
	if err != nil {
		return stellar1.PaymentResult{}, err
	}
	primarySeed := primary.Signers[0]
	// look up recipient
	recipient, err := LookupRecipient(m, to)
	if err != nil {
		return stellar1.PaymentResult{}, err
	}

	if recipient.AccountID == nil {
		return sendRelayPayment(m, remoter, primarySeed, recipient, amount, note, displayBalance)
	}

	primarySeed2, err := stellarnet.NewSeedStr(primarySeed.SecureNoLogString())
	if err != nil {
		return stellar1.PaymentResult{}, err
	}

	post := stellar1.PaymentDirectPost{
		FromDeviceID:    m.G().ActiveDevice.DeviceID(),
		DisplayAmount:   displayBalance.Amount,
		DisplayCurrency: displayBalance.Currency,
	}
	if recipient.User != nil {
		tmp := recipient.User.ToUserVersion()
		post.To = &tmp
	}

	sp := NewSeqnoProvider(m.Ctx(), remoter)

	// check if recipient account exists
	var txID string
	funded, err := isAccountFunded(m.Ctx(), remoter, stellar1.AccountID(recipient.AccountID.String()))
	if err != nil {
		return stellar1.PaymentResult{}, fmt.Errorf("error checking destination account balance: %v", err)
	}
	if !funded {
		// if no balance, create_account operation
		// we could check here to make sure that amount is at least 1XLM
		// but for now, just let stellar-core tell us there was an error
		sig, err := stellarnet.CreateAccountXLMTransaction(primarySeed2, *recipient.AccountID, amount, sp)
		if err != nil {
			return stellar1.PaymentResult{}, err
		}
		post.SignedTransaction = sig.Signed
		txID = sig.TxHash
	} else {
		// if balance, payment operation
		sig, err := stellarnet.PaymentXLMTransaction(primarySeed2, *recipient.AccountID, amount, sp)
		if err != nil {
			return stellar1.PaymentResult{}, err
		}
		post.SignedTransaction = sig.Signed
		txID = sig.TxHash
	}

	if len(note) > 0 {
		noteClear := stellar1.NoteContents{
			Note:      note,
			StellarID: stellar1.TransactionID(txID),
		}
		var recipientUv *keybase1.UserVersion
		if recipient.User != nil {
			tmp := recipient.User.ToUserVersion()
			recipientUv = &tmp
		}
		post.NoteB64, err = NoteEncryptB64(m.Ctx(), m.G(), noteClear, recipientUv)
		if err != nil {
			return stellar1.PaymentResult{}, fmt.Errorf("error encrypting note: %v", err)
		}
	}

	// submit the transaction
	return remoter.SubmitPayment(m.Ctx(), post)
}

// sendRelayPayment sends XLM through a relay account.
// The balance of the relay account can be claimed by either party.
func sendRelayPayment(m libkb.MetaContext, remoter remote.Remoter,
	from stellar1.SecretKey, recipient stellarcommon.Recipient, amount, note string, displayBalance DisplayBalance) (res stellar1.PaymentResult, err error) {
	defer m.CTraceTimed("Stellar.sendRelayPayment", func() error { return err })()
	appKey, teamID, err := relays.GetKey(m.Ctx(), m.G(), recipient)
	if err != nil {
		return res, err
	}
	relay, err := relays.Create(relays.Input{
		From:          from,
		AmountXLM:     amount,
		Note:          note,
		EncryptFor:    appKey,
		SeqnoProvider: NewSeqnoProvider(m.Ctx(), remoter),
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
	}
	if recipient.User != nil {
		tmp := recipient.User.ToUserVersion()
		post.To = &tmp
	}
	return remoter.SubmitRelayPayment(m.Ctx(), post)
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

func RecentPaymentsCLILocal(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter, accountID stellar1.AccountID) (res []stellar1.PaymentCLIOptionLocal, err error) {
	defer g.CTraceTimed(ctx, "Stellar.RecentPaymentsCLILocal", func() error { return err })()
	payments, err := remoter.RecentPayments(ctx, accountID, 0)
	if err != nil {
		return nil, err
	}
	for _, p := range payments {
		lp, err := localizePayment(ctx, g, p)
		if err == nil {
			res = append(res, stellar1.PaymentCLIOptionLocal{
				Payment: &lp,
			})
		} else {
			res = append(res, stellar1.PaymentCLIOptionLocal{
				Err: err.Error(),
			})
		}
	}
	return res, nil
}

func PaymentDetailCLILocal(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter, txID string) (res stellar1.PaymentCLILocal, err error) {
	defer g.CTraceTimed(ctx, "Stellar.PaymentDetailCLILocal", func() error { return err })()
	payment, err := remoter.PaymentDetail(ctx, txID)
	if err != nil {
		return res, err
	}
	return localizePayment(ctx, g, payment)
}

func localizePayment(ctx context.Context, g *libkb.GlobalContext, p stellar1.PaymentSummary) (res stellar1.PaymentCLILocal, err error) {
	typ, err := p.Typ()
	if err != nil {
		return res, fmt.Errorf("malformed payment summary: %v", err)
	}
	status := func(txStatus stellar1.TransactionStatus, txErrMsg string) (status, statusDetail string) {
		switch txStatus {
		case stellar1.TransactionStatus_PENDING:
			status = "pending"
		case stellar1.TransactionStatus_SUCCESS:
			status = "completed"
		case stellar1.TransactionStatus_ERROR_TRANSIENT, stellar1.TransactionStatus_ERROR_PERMANENT:
			status = "error"
			statusDetail = txErrMsg
		default:
			status = "unknown"
			statusDetail = txErrMsg
		}
		return status, statusDetail
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
			Status:      "completed",
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
		res.Status, res.StatusDetail = status(p.TxStatus, p.TxErrMsg)
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
			res.Status, res.StatusDetail = status(p.TxStatus, p.TxErrMsg)
		} else {
			res.Status = "claimable"
			res.StatusDetail = "Waiting for the recipient to open the app to claim, or the sender to yank."
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
		// Override status with claim status
		if p.Claim != nil {
			if p.Claim.TxStatus == stellar1.TransactionStatus_SUCCESS {
				// If the claim succeeded, the relay payment is done.
				res.Status = "completed"
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
				res.Status, res.StatusDetail = status(p.Claim.TxStatus, p.Claim.TxErrMsg)
				res.Status = fmt.Sprintf("funded. Claim by %v is: %v", claimantUsername, res.Status)
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
