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
	"github.com/stellar/go/xdr"
)

type UISource interface {
	SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI
}

type Server struct {
	libkb.Contextified
	uiSource UISource
}

func New(g *libkb.GlobalContext, uiSource UISource) *Server {
	return &Server{
		Contextified: libkb.NewContextified(g),
		uiSource:     uiSource,
	}
}

func (s *Server) assertLoggedIn(ctx context.Context) error {
	loggedIn := s.G().ActiveDevice.Valid()
	if !loggedIn {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func (s *Server) logTag(ctx context.Context) context.Context {
	return libkb.WithLogTag(ctx, "WA")
}

func (s *Server) BalancesLocal(ctx context.Context, accountID stellar1.AccountID) ([]stellar1.Balance, error) {
	var err error
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "BalancesLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return nil, err
	}

	return remote.Balances(ctx, s.G(), accountID)
}

func (s *Server) ImportSecretKeyLocal(ctx context.Context, arg stellar1.ImportSecretKeyLocalArg) (err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "ImportSecretKeyLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return err
	}
	return stellar.ImportSecretKey(ctx, s.G(), arg.SecretKey, arg.MakePrimary)
}

func (s *Server) OwnAccountLocal(ctx context.Context, accountID stellar1.AccountID) (isOwn bool, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "OwnAccountLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return false, err
	}

	bundle, _, err := remote.Fetch(ctx, s.G())
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

func (s *Server) SendLocal(ctx context.Context, arg stellar1.SendLocalArg) (stellar1.PaymentResult, error) {
	var err error
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "SendLocal", func() error { return err })()
	if err = s.assertLoggedIn(ctx); err != nil {
		return stellar1.PaymentResult{}, err
	}

	return Send(ctx, s.G(), arg)
}

func (s *Server) WalletDumpLocal(ctx context.Context) (dump stellar1.Bundle, err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "WalletDumpLocal", func() error { return err })()
	if s.G().Env.GetRunMode() != libkb.DevelRunMode {
		return dump, errors.New("WalletDump only supported in devel run mode")
	}

	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "WalletDump", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return dump, err
	}

	// verify passphrase
	username := s.G().GetEnv().GetUsername().String()

	arg := libkb.DefaultPassphrasePromptArg(s.G(), username)
	secretUI := s.uiSource.SecretUI(s.G(), 0)
	res, err := secretUI.GetPassphrase(arg, nil)
	if err != nil {
		return dump, err
	}
	pwdOk := false
	_, err = s.G().LoginState().VerifyPlaintextPassphrase(res.Passphrase, func(lctx libkb.LoginContext) error {
		pwdOk = true

		return nil
	})
	if err != nil {
		return dump, err
	}
	if !pwdOk {
		return dump, libkb.PassphraseError{}
	}

	dump, _, err = remote.Fetch(ctx, s.G())

	return dump, err
}

// WalletInitLocal creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe to call even if the user has a bundle already.
func (s *Server) WalletInitLocal(ctx context.Context) (err error) {
	ctx = s.logTag(ctx)
	defer s.G().CTraceTimed(ctx, "WalletInitLocal", func() error { return err })()
	err = s.assertLoggedIn(ctx)
	if err != nil {
		return err
	}
	_, err = stellar.CreateWallet(ctx, s.G())
	return err
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

// TODO: handle stellar federation address rebecca*keybase.io (or rebecca*anything.wow)
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

type seqnoProv struct {
	ctx context.Context
	g   *libkb.GlobalContext
}

// SequenceForAccount implements build.SequenceProvider
func (s *seqnoProv) SequenceForAccount(aid string) (xdr.SequenceNumber, error) {
	seqno, err := remote.AccountSeqno(s.ctx, s.g, stellar1.AccountID(aid))
	if err != nil {
		return 0, err
	}

	s.g.Log.Warning("%s sequence number: %d", aid, seqno)

	return xdr.SequenceNumber(seqno), nil
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

	sp := &seqnoProv{
		ctx: ctx,
		g:   g,
	}

	// check if recipient account exists
	_, err = stellar.BalanceXLM(ctx, g, stellar1.AccountID(recipient.AccountID.String()))
	if err != nil {
		// if no balance, create_account operation
		// we could check here to make sure that amount is at least 1XLM
		// but for now, just let stellar-core tell us there was an error
		post.StellarAccountSeqno, post.SignedTransaction, err = senderAcct.CreateAccountXLMTransaction(primarySeed, recipient.AccountID, arg.Amount, sp)
		if err != nil {
			return stellar1.PaymentResult{}, err
		}
	} else {
		// if balance, payment operation
		post.StellarAccountSeqno, post.SignedTransaction, err = senderAcct.PaymentXLMTransaction(primarySeed, recipient.AccountID, arg.Amount, sp)
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
