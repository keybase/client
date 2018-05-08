package stellar

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/amount"
)

// CreateWallet creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe to call even if the user has a bundle already.
func CreateWallet(ctx context.Context, g *libkb.GlobalContext) (created bool, err error) {
	defer g.CTraceTimed(ctx, "Stellar.CreateWallet", func() error { return err })()
	// TODO: short-circuit if the user has a bundle already
	clearBundle, err := bundle.NewInitialBundle()
	if err != nil {
		return created, err
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
	return true, err
}

func CreateWalletGated(ctx context.Context, g *libkb.GlobalContext) (created bool, err error) {
	defer g.CTraceTimed(ctx, "Stellar.CreateWalletGated", func() error { return err })()
	// TODO: short-circuit if the user has a bundle already
	if !g.Env.GetAutoWallet() {
		g.Log.CDebugf(ctx, "CreateWalletGated disabled by env setting")
		return false, nil
	}
	should, err := remote.ShouldCreate(ctx, g)
	if err != nil {
		return false, err
	}
	if !should {
		g.Log.CDebugf(ctx, "server did not recommend wallet creation")
		return false, nil
	}
	return CreateWallet(ctx, g)
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
	_, err = CreateWalletGated(ctx, g)
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

type RecipientInput string

type Recipient struct {
	Input RecipientInput
	// These 3 fields are nullable.
	User      *libkb.User
	Assertion *keybase1.SocialAssertion
	// Recipient may not have a stellar wallet ready to receive
	AccountID *stellarnet.AddressStr // User entered G... OR target has receiving address
}

// TODO: handle stellar federation address rebecca*keybase.io (or rebecca*anything.wow)
func LookupRecipient(ctx context.Context, g *libkb.GlobalContext, to RecipientInput) (Recipient, error) {
	res := Recipient{
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

	expr, err := externals.AssertionParse(string(to))
	if err != nil {
		g.Log.CDebugf(ctx, "error parsing assertion")
		return res, fmt.Errorf("invalid recipient '%v': %v", to, err)
	}
	socExpr, err := expr.ToSocialAssertion()
	if err == nil {
		res.Assertion = &socExpr
	}
	username := string(to)
	switch expr := expr.(type) {
	case libkb.AssertionKeybase:
		k, v, err := expr.ToLookup()
		if !(err == nil && k == "username") {
			g.Log.CDebugf(ctx, "error unpacking keybase assertion: key:'%v' err:%v", k, err)
			return res, fmt.Errorf("invalid recipient '%v'", to)
		}
		username = v
	default:
		// TODO CORE-7781 support resolving non-keybase assertions
		//                If expr does not resolve use it as SBS.
		//                If expr resolves and verifies use the user.
		//                If expr resolves but fails verification ERROR OUT. Do not use as SBS.
		//                   We don't want to cause impteam conflicts and confusion.
		g.Log.CDebugf(ctx, "non-keybase resolution %T", expr)
		return res, fmt.Errorf("invalid recipient '%v'", to)
	}

	user, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(g, username).WithNetContext(ctx))
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

// SendPayment sends XLM
// `note` is optional. An empty string will not attach a note.
// Recipient:
// Stellar address        : Standard payment
// User with wallet ready : Standard payment
// User without a wallet  : Relay payment
// Unresolved assertion   : Relay payment
func SendPayment(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter, to RecipientInput, amount string, note string) (stellar1.PaymentResult, error) {
	var err error
	defer g.CTraceTimed(ctx, "Stellar.SendPayment", func() error { return err })()
	// look up sender wallet
	primary, err := LookupSenderPrimary(ctx, g)
	if err != nil {
		return stellar1.PaymentResult{}, err
	}
	primarySeed := primary.Signers[0]
	// look up recipient
	recipient, err := LookupRecipient(ctx, g, to)
	if err != nil {
		return stellar1.PaymentResult{}, err
	}

	if recipient.AccountID == nil {
		return sendRelayPayment(ctx, g, remoter, primarySeed, recipient, amount, note)
	}

	primarySeed2, err := stellarnet.NewSeedStr(primarySeed.SecureNoLogString())
	if err != nil {
		return stellar1.PaymentResult{}, err
	}

	post := stellar1.PaymentDirectPost{
		FromDeviceID: g.ActiveDevice.DeviceID(),
	}
	if recipient.User != nil {
		tmp := recipient.User.ToUserVersion()
		post.To = &tmp
	}

	sp := NewSeqnoProvider(ctx, remoter)

	// check if recipient account exists
	var txID string
	funded, err := isAccountFunded(ctx, remoter, stellar1.AccountID(recipient.AccountID.String()))
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
		post.NoteB64, err = NoteEncryptB64(ctx, g, noteClear, recipientUv)
		if err != nil {
			return stellar1.PaymentResult{}, fmt.Errorf("error encrypting note: %v", err)
		}
	}

	// submit the transaction
	return remoter.SubmitPayment(ctx, post)
}

// sendRelayPayment sends XLM through a relay account.
// The balance of the relay account can be claimed by either party.
func sendRelayPayment(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter,
	from stellar1.SecretKey, recipient Recipient, amount, note string) (res stellar1.PaymentResult, err error) {
	defer g.CTraceTimed(ctx, "Stellar.sendRelayPayment", func() error { return err })()
	appKey, teamID, err := RelayTransferKey(ctx, g, recipient)
	if err != nil {
		return res, err
	}
	relay, err := CreateRelayTransfer(RelayPaymentInput{
		From:          from,
		AmountXLM:     amount,
		Note:          note,
		EncryptFor:    appKey,
		SeqnoProvider: NewSeqnoProvider(ctx, remoter),
	})
	if err != nil {
		return res, err
	}
	post := stellar1.PaymentRelayPost{
		FromDeviceID:      g.ActiveDevice.DeviceID(),
		ToAssertion:       string(recipient.Input),
		RelayAccount:      relay.RelayAccountID,
		TeamID:            teamID,
		BoxB64:            relay.EncryptedB64,
		SignedTransaction: relay.FundTx.Signed,
	}
	if recipient.User != nil {
		tmp := recipient.User.ToUserVersion()
		post.To = &tmp
	}
	return remoter.SubmitRelayPayment(ctx, post)
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

func RecentPaymentsCLILocal(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter, accountID stellar1.AccountID) (res []stellar1.PaymentCLILocal, err error) {
	defer g.CTraceTimed(ctx, "Stellar.RecentPaymentsCLILocal", func() error { return err })()
	payments, err := remoter.RecentPayments(ctx, accountID, 0)
	if err != nil {
		return nil, err
	}
	for _, p := range payments {
		res = append(res, localizePayment(ctx, g, p))
	}
	return res, nil
}

func PaymentDetailCLILocal(ctx context.Context, g *libkb.GlobalContext, remoter remote.Remoter, txID string) (res stellar1.PaymentCLILocal, err error) {
	defer g.CTraceTimed(ctx, "Stellar.PaymentDetailCLILocal", func() error { return err })()
	payment, err := remoter.PaymentDetail(ctx, txID)
	if err != nil {
		return res, err
	}
	return localizePayment(ctx, g, payment), nil
}

func localizePayment(ctx context.Context, g *libkb.GlobalContext, x stellar1.PaymentSummary) stellar1.PaymentCLILocal {
	y := stellar1.PaymentCLILocal{
		StellarTxID: x.StellarTxID,
		Status:      "pending",
		Amount:      x.Amount,
		Asset:       x.Asset,
		FromStellar: x.From,
		ToStellar:   x.To,
	}
	if x.Stellar != nil {
		y.Status = "completed"
	}
	if x.Keybase != nil {
		y.Time = x.Keybase.Ctime
		switch x.Keybase.Status {
		case stellar1.TransactionStatus_PENDING:
			y.Status = "pending"
		case stellar1.TransactionStatus_SUCCESS:
			y.Status = "completed"
		case stellar1.TransactionStatus_ERROR_TRANSIENT:
			y.Status = "error"
			y.StatusDetail = x.Keybase.SubmitErrMsg
		case stellar1.TransactionStatus_ERROR_PERMANENT:
			y.Status = "error"
			y.StatusDetail = x.Keybase.SubmitErrMsg
		default:
			y.Status = "unknown"
			y.StatusDetail = x.Keybase.SubmitErrMsg
		}
		y.DisplayAmount = x.Keybase.DisplayAmount
		y.DisplayCurrency = x.Keybase.DisplayCurrency
		fromUsername, err := g.GetUPAKLoader().LookupUsername(ctx, x.Keybase.From.Uid)
		if err == nil {
			tmp := fromUsername.String()
			y.FromUsername = &tmp
		}
		if x.Keybase.To != nil {
			toUsername, err := g.GetUPAKLoader().LookupUsername(ctx, x.Keybase.To.Uid)
			if err == nil {
				tmp := toUsername.String()
				y.ToUsername = &tmp
			}
		}
		if len(x.Keybase.NoteB64) > 0 {
			note, err := NoteDecryptB64(ctx, g, x.Keybase.NoteB64)
			if err != nil {
				y.NoteErr = fmt.Sprintf("failed to decrypt payment note: %v", err)
			} else {
				if note.StellarID != x.StellarTxID {
					y.NoteErr = "discarded note for wrong txid"
				} else {
					y.Note = note.Note
				}
			}
			if len(y.NoteErr) > 0 {
				g.Log.CWarningf(ctx, y.NoteErr)
			}
		}
	}
	if x.Stellar != nil {
		y.Time = x.Stellar.Ctime
	}
	return y
}
