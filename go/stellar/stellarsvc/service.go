package stellarsvc

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/stellarnet"
)

// Service handlers

// CreateWallet creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe to call even if the user has a bundle already.
func CreateWallet(ctx context.Context, g *libkb.GlobalContext) (created bool, err error) {
	return stellar.CreateWallet(ctx, g)
}

type balancesResult struct {
	Status   libkb.AppStatus    `json:"status"`
	Balances []stellar1.Balance `json:"balances"`
}

func (b *balancesResult) GetAppStatus() *libkb.AppStatus {
	return &b.Status
}

func Balances(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/balances",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		NetContext:  ctx,
	}

	var res balancesResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
		return nil, err
	}

	return res.Balances, nil
}

func balanceXLM(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (stellar1.Balance, error) {
	balances, err := Balances(ctx, g, accountID)
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

func lookupSenderPrimary(ctx context.Context, g *libkb.GlobalContext) (stellar1.BundleEntry, error) {
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

type Recipient struct {
	Input     string
	User      *libkb.User
	AccountID stellarnet.AddressStr
}

// TODO: actually lookup the recipient and handle
// 1. stellar addresses GXXXXX
// 2. stellar federation address rebecca*keybase.io
// 3. keybase username
// 4. keybase assertion
func lookupRecipient(ctx context.Context, g *libkb.GlobalContext, to string) (*Recipient, error) {
	r := Recipient{
		Input: to,
	}

	if to[0] == 'G' && len(to) > 16 {
		var err error
		r.AccountID, err = stellarnet.NewAddressStr(to)
		if err != nil {
			return nil, err
		}

		return &r, nil
	}

	user, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(g, to))
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

type submitResult struct {
	Status        libkb.AppStatus        `json:"status"`
	PaymentResult stellar1.PaymentResult `json:"payment_result"`
}

func (s *submitResult) GetAppStatus() *libkb.AppStatus {
	return &s.Status
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

func Send(ctx context.Context, g *libkb.GlobalContext, arg stellar1.SendLocalArg) (stellar1.PaymentResult, error) {
	// look up sender wallet
	primary, err := lookupSenderPrimary(ctx, g)
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
	recipient, err := lookupRecipient(ctx, g, arg.Recipient)
	if err != nil {
		return stellar1.PaymentResult{}, err
	}

	post := postFromCurrentUser(ctx, g, primaryAccountID, recipient)

	// Note:
	// CreateAccountXLMTransaction and PaymentXLMTransaction use horizon
	// to get the sequence number.  In the future we could provide an RPC
	// to get it instead of having the clients go direct to horizon.

	// check if recipient account exists
	_, err = balanceXLM(ctx, g, stellar1.AccountID(recipient.AccountID.String()))
	if err != nil {
		// if no balance, create_account operation
		// we could check here to make sure that amount is at least 1XLM
		// but for now, just let stellar-core tell us there was an error
		post.StellarAccountSeqno, post.SignedTransaction, err = senderAcct.CreateAccountXLMTransaction(primarySeed, recipient.AccountID, arg.Amount)
		if err != nil {
			return stellar1.PaymentResult{}, err
		}
	} else {
		// if balance, payment operation
		post.StellarAccountSeqno, post.SignedTransaction, err = senderAcct.PaymentXLMTransaction(primarySeed, recipient.AccountID, arg.Amount)
		if err != nil {
			return stellar1.PaymentResult{}, err
		}
	}

	// submit the transaction
	payload := make(libkb.JSONPayload)
	payload["payment"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitpayment",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
		NetContext:  ctx,
	}

	var res submitResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
		return stellar1.PaymentResult{}, err
	}

	return res.PaymentResult, nil
}
