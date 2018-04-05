package stellar

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/bundle"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
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

// InitWalletSoft creates a user's initial wallet if they don't already have one.
// Does not get in the way of intentional user actions.
func InitWalletSoft(ctx context.Context, g *libkb.GlobalContext) {
	var err error
	defer g.CTraceTimed(ctx, "InitWalletSoft", func() error { return err })()
	if !g.LocalSigchainGuard().IsAvailable(ctx, "InitWalletSoft") {
		err = fmt.Errorf("yielding to guard")
		return
	}
	_, err = CreateWalletGated(ctx, g)
	return
}

// Upkeep makes sure the bundle is encrypted for the user's latest PUK.
func Upkeep(ctx context.Context, g *libkb.GlobalContext) (err error) {
	defer g.CTraceTimed(ctx, "Stellar.Upkeep", func() error { return err })()
	pukring, err := g.GetPerUserKeyring()
	if err != nil {
		return err
	}
	err = pukring.Sync(ctx)
	if err != nil {
		return err
	}
	prevBundle, prevPukGen, err := remote.Fetch(ctx, g)
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

func BalanceXLM(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (stellar1.Balance, error) {
	balances, err := remote.Balances(ctx, g, accountID)
	if err != nil {
		return stellar1.Balance{}, err
	}

	for _, b := range balances {
		if b.Asset.Type == "native" {
			return b, nil
		}
	}

	return stellar1.Balance{}, errors.New("no native balance")
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
	Input     RecipientInput
	User      *libkb.User
	AccountID stellarnet.AddressStr
}

// TODO: handle stellar federation address rebecca*keybase.io (or rebecca*anything.wow)
func LookupRecipient(ctx context.Context, g *libkb.GlobalContext, to RecipientInput) (*Recipient, error) {
	r := Recipient{
		Input: to,
	}

	if to[0] == 'G' && len(to) > 16 {
		var err error
		r.AccountID, err = stellarnet.NewAddressStr(string(to))
		if err != nil {
			return nil, err
		}

		return &r, nil
	}

	user, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(g, string(to)))
	if err != nil {
		return nil, err
	}
	accountID := user.StellarWalletAddress()
	if accountID == nil {
		return nil, fmt.Errorf("keybase user %s does not have a stellar wallet", to)
	}
	r.AccountID, err = stellarnet.NewAddressStr(accountID.String())
	if err != nil {
		return nil, err
	}
	r.User = user

	return &r, nil
}

func postFromCurrentUser(ctx context.Context, g *libkb.GlobalContext, acctID stellarnet.AddressStr, recipient *Recipient) stellar1.PaymentPost {
	uid, deviceID, _, _, _ := g.ActiveDevice.AllFields()
	post := stellar1.PaymentPost{
		Members: stellar1.Members{
			FromStellar:  stellar1.AccountID(acctID.String()),
			FromKeybase:  g.Env.GetUsername().String(),
			FromUID:      uid,
			FromDeviceID: deviceID,
		},
	}

	if recipient != nil {
		post.Members.ToStellar = stellar1.AccountID(recipient.AccountID.String())
		if recipient.User != nil {
			post.Members.ToUID = recipient.User.GetUID()
			post.Members.ToKeybase = recipient.User.GetName()
		}
	}

	return post
}

func SendPayment(ctx context.Context, g *libkb.GlobalContext, to RecipientInput, amount string) (stellar1.PaymentResult, error) {
	// look up sender wallet
	primary, err := LookupSenderPrimary(ctx, g)
	if err != nil {
		return stellar1.PaymentResult{}, err
	}
	primaryAccountID, err := stellarnet.NewAddressStr(primary.AccountID.String())
	if err != nil {
		return stellar1.PaymentResult{}, err
	}
	primarySeed, err := stellarnet.NewSeedStr(primary.Signers[0].SecureNoLogString())
	if err != nil {
		return stellar1.PaymentResult{}, err
	}
	senderAcct := stellarnet.NewAccount(primaryAccountID)

	// look up recipient
	recipient, err := LookupRecipient(ctx, g, to)
	if err != nil {
		return stellar1.PaymentResult{}, err
	}

	post := postFromCurrentUser(ctx, g, primaryAccountID, recipient)

	sp := NewSeqnoProvider(ctx, g)

	// check if recipient account exists
	_, err = BalanceXLM(ctx, g, stellar1.AccountID(recipient.AccountID.String()))
	if err != nil {
		// if no balance, create_account operation
		// we could check here to make sure that amount is at least 1XLM
		// but for now, just let stellar-core tell us there was an error
		post.StellarAccountSeqno, post.SignedTransaction, err = senderAcct.CreateAccountXLMTransaction(primarySeed, recipient.AccountID, amount, sp)
		if err != nil {
			return stellar1.PaymentResult{}, err
		}
	} else {
		// if balance, payment operation
		post.StellarAccountSeqno, post.SignedTransaction, err = senderAcct.PaymentXLMTransaction(primarySeed, recipient.AccountID, amount, sp)
		if err != nil {
			return stellar1.PaymentResult{}, err
		}
	}

	// submit the transaction
	payload := make(libkb.JSONPayload)
	payload["payment"] = post
	return remote.SubmitTransaction(ctx, g, payload)
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
