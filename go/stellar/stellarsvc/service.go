package stellarsvc

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"sort"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/xdr"
)

type UISource interface {
	SecretUI(g *libkb.GlobalContext, sessionID int) libkb.SecretUI
	IdentifyUI(g *libkb.GlobalContext, sessionID int) libkb.IdentifyUI
	StellarUI() stellar1.UiInterface
}

type Server struct {
	libkb.Contextified
	uiSource    UISource
	remoter     remote.Remoter
	walletState *stellar.WalletState
}

func New(g *libkb.GlobalContext, uiSource UISource, walletState *stellar.WalletState) *Server {
	return &Server{
		Contextified: libkb.NewContextified(g),
		uiSource:     uiSource,
		remoter:      walletState,
		walletState:  walletState,
	}
}

func (s *Server) assertLoggedIn(mctx libkb.MetaContext) error {
	loggedIn := mctx.ActiveDevice().Valid()
	if !loggedIn {
		return libkb.LoginRequiredError{}
	}
	return nil
}

func (s *Server) logTag(ctx context.Context) context.Context {
	return libkb.WithLogTag(ctx, "WA")
}

type preambleArg struct {
	RPCName string
	// Pointer to the RPC's error return value.
	// Can be nil for RPCs that do not err.
	Err            *error
	RequireWallet  bool
	AllowLoggedOut bool
}

// Preamble
// Example usage:
//   ctx, err, fin := c.Preamble(...)
//   defer fin()
//   if err != nil { return err }
func (s *Server) Preamble(inCtx context.Context, opts preambleArg) (mctx libkb.MetaContext, fin func(), err error) {
	mctx = libkb.NewMetaContext(s.logTag(inCtx), s.G())
	getFinalErr := func() error {
		if opts.Err == nil {
			return nil
		}
		return *opts.Err
	}
	fin = mctx.TraceTimed("LRPC "+opts.RPCName, getFinalErr)
	if !opts.AllowLoggedOut {
		if err = s.assertLoggedIn(mctx); err != nil {
			return mctx, fin, err
		}
	}
	if opts.RequireWallet {
		cwg, err := stellar.CreateWalletGated(mctx)
		if err != nil {
			return mctx, fin, err
		}
		if !cwg.HasWallet {
			if !cwg.AcceptedDisclaimer {
				// Synthesize an AppStatusError so the CLI and GUI can match on these errors.
				err = libkb.NewAppStatusError(&libkb.AppStatus{
					Code: libkb.SCStellarNeedDisclaimer,
					Name: "STELLAR_NEED_DISCLAIMER",
					Desc: "user hasn't yet accepted the Stellar disclaimer",
				})
				return mctx, fin, err
			}
			return mctx, fin, errors.New("logged-in user does not have a wallet")
		}
	}
	return mctx, fin, nil
}

func (s *Server) BalancesLocal(ctx context.Context, accountID stellar1.AccountID) (ret []stellar1.Balance, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "BalancesLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return ret, err
	}

	return s.remoter.Balances(mctx.Ctx(), accountID)
}

func (s *Server) ImportSecretKeyLocal(ctx context.Context, arg stellar1.ImportSecretKeyLocalArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ImportSecretKeyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	return stellar.ImportSecretKey(mctx, arg.SecretKey, arg.MakePrimary, arg.Name)
}

func (s *Server) ExportSecretKeyLocal(ctx context.Context, accountID stellar1.AccountID) (res stellar1.SecretKey, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ExportSecretKeyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	// Prompt for passphrase
	username := s.G().GetEnv().GetUsername().String()
	arg := libkb.DefaultPassphrasePromptArg(mctx, username)
	arg.Prompt += " to export Stellar secret keys"
	secretUI := s.uiSource.SecretUI(s.G(), 0)
	ppRes, err := secretUI.GetPassphrase(arg, nil)
	if err != nil {
		return res, err
	}
	_, err = libkb.VerifyPassphraseForLoggedInUser(mctx, ppRes.Passphrase)
	if err != nil {
		return res, err
	}
	return stellar.ExportSecretKey(mctx, accountID)
}

func (s *Server) OwnAccountLocal(ctx context.Context, accountID stellar1.AccountID) (isOwn bool, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ExportSecretKeyLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return isOwn, err
	}
	isOwn, _, err = stellar.OwnAccount(mctx, accountID)
	return isOwn, err
}

func (s *Server) SendCLILocal(ctx context.Context, arg stellar1.SendCLILocalArg) (res stellar1.SendResultCLILocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "SendCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	if !arg.Asset.IsNativeXLM() {
		return res, fmt.Errorf("sending non-XLM assets is not supported")
	}

	// make sure that the xlm amount is close to the display amount the
	// user thinks they are sending.
	if err = s.checkDisplayAmount(mctx.Ctx(), arg); err != nil {
		return res, err
	}

	displayBalance := stellar.DisplayBalance{
		Amount:   arg.DisplayAmount,
		Currency: arg.DisplayCurrency,
	}
	uis := libkb.UIs{
		IdentifyUI: s.uiSource.IdentifyUI(s.G(), 0),
	}
	mctx = mctx.WithUIs(uis)

	sendRes, err := stellar.SendPaymentCLI(mctx, s.walletState, stellar.SendPaymentArg{
		From:           arg.FromAccountID,
		To:             stellarcommon.RecipientInput(arg.Recipient),
		Amount:         arg.Amount,
		DisplayBalance: displayBalance,
		SecretNote:     arg.Note,
		ForceRelay:     arg.ForceRelay,
		QuickReturn:    false,
		PublicMemo:     stellarnet.NewMemoText(arg.PublicNote),
	})
	if err != nil {
		return res, err
	}
	return stellar1.SendResultCLILocal{
		KbTxID: sendRes.KbTxID,
		TxID:   sendRes.TxID,
	}, nil
}

func (s *Server) SendPathCLILocal(ctx context.Context, arg stellar1.SendPathCLILocalArg) (res stellar1.SendResultCLILocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "SendPathCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	uis := libkb.UIs{
		IdentifyUI: s.uiSource.IdentifyUI(s.G(), 0),
	}
	mctx = mctx.WithUIs(uis)

	sendRes, err := stellar.SendPathPaymentCLI(mctx, s.walletState, stellar.SendPathPaymentArg{
		From:        arg.Source,
		To:          stellarcommon.RecipientInput(arg.Recipient),
		Path:        arg.Path,
		SecretNote:  arg.Note,
		PublicMemo:  stellarnet.NewMemoText(arg.PublicNote),
		QuickReturn: false,
	})
	if err != nil {
		return res, err
	}
	return stellar1.SendResultCLILocal{
		KbTxID: sendRes.KbTxID,
		TxID:   sendRes.TxID,
	}, nil
}

func (s *Server) ClaimCLILocal(ctx context.Context, arg stellar1.ClaimCLILocalArg) (res stellar1.RelayClaimResult, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "ClaimCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	var into stellar1.AccountID
	if arg.Into != nil {
		into = *arg.Into
	} else {
		// Default to claiming into the user's primary wallet.
		into, err = stellar.GetOwnPrimaryAccountID(mctx)
		if err != nil {
			return res, err
		}
	}
	return stellar.Claim(mctx, s.walletState, arg.TxID, into, nil, nil)
}

func (s *Server) RecentPaymentsCLILocal(ctx context.Context, accountID *stellar1.AccountID) (res []stellar1.PaymentOrErrorCLILocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "RecentPaymentsCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return nil, err
	}

	var selectAccountID stellar1.AccountID
	if accountID == nil {
		selectAccountID, err = stellar.GetOwnPrimaryAccountID(mctx)
		if err != nil {
			return nil, err
		}
	} else {
		selectAccountID = *accountID
	}
	return stellar.RecentPaymentsCLILocal(mctx, s.remoter, selectAccountID)
}

func (s *Server) PaymentDetailCLILocal(ctx context.Context, txID string) (res stellar1.PaymentCLILocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "PaymentDetailCLILocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	return stellar.PaymentDetailCLILocal(mctx.Ctx(), s.G(), s.remoter, txID)
}

// WalletInitLocal creates and posts an initial stellar bundle for a user.
// Only succeeds if they do not already have one.
// Safe to call even if the user has a bundle already.
func (s *Server) WalletInitLocal(ctx context.Context) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "WalletInitLocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return err
	}

	_, err = stellar.CreateWallet(mctx)
	return err
}

func (s *Server) SetDisplayCurrency(ctx context.Context, arg stellar1.SetDisplayCurrencyArg) (err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       fmt.Sprintf("SetDisplayCurrency(%s, %s)", arg.AccountID, arg.Currency),
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return err
	}

	return remote.SetAccountDefaultCurrency(mctx.Ctx(), s.G(), arg.AccountID, arg.Currency)
}

type exchangeRateMap map[string]stellar1.OutsideExchangeRate

// getLocalCurrencyAndExchangeRate gets display currency setting
// for accountID and fetches exchange rate is set.
//
// Arguments `account` and `exchangeRates` may end up mutated.
func getLocalCurrencyAndExchangeRate(mctx libkb.MetaContext, remoter remote.Remoter, account *stellar1.OwnAccountCLILocal, exchangeRates exchangeRateMap) error {
	displayCurrency, err := stellar.GetAccountDisplayCurrency(mctx, account.AccountID)
	if err != nil {
		return err
	}
	rate, ok := exchangeRates[displayCurrency]
	if !ok {
		var err error
		rate, err = remoter.ExchangeRate(mctx.Ctx(), displayCurrency)
		if err != nil {
			return err
		}
		exchangeRates[displayCurrency] = rate
	}
	account.ExchangeRate = &rate
	return nil
}

func (s *Server) WalletGetAccountsCLILocal(ctx context.Context) (ret []stellar1.OwnAccountCLILocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "WalletGetAccountsCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return ret, err
	}

	currentBundle, err := remote.FetchSecretlessBundle(mctx)
	if err != nil {
		return nil, err
	}

	var accountError error
	exchangeRates := make(exchangeRateMap)
	for _, account := range currentBundle.Accounts {
		accID := account.AccountID
		acc := stellar1.OwnAccountCLILocal{
			AccountID:   accID,
			IsPrimary:   account.IsPrimary,
			Name:        account.Name,
			AccountMode: account.Mode,
		}

		balances, err := s.remoter.Balances(ctx, accID)
		if err != nil {
			accountError = err
			s.G().Log.Warning("Could not load balance for %q", accID)
			continue
		}

		acc.Balance = balances

		if err := getLocalCurrencyAndExchangeRate(mctx, s.remoter, &acc, exchangeRates); err != nil {
			s.G().Log.Warning("Could not load local currency exchange rate for %q", accID)
		}

		ret = append(ret, acc)
	}

	// Put the primary account first, then sort by name, then by account ID
	sort.SliceStable(ret, func(i, j int) bool {
		if ret[i].IsPrimary {
			return true
		}
		if ret[j].IsPrimary {
			return false
		}
		if ret[i].Name == ret[j].Name {
			return ret[i].AccountID < ret[j].AccountID
		}
		return ret[i].Name < ret[j].Name
	})

	return ret, accountError
}

func (s *Server) ExchangeRateLocal(ctx context.Context, currency stellar1.OutsideCurrencyCode) (res stellar1.OutsideExchangeRate, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:        fmt.Sprintf("ExchangeRateLocal(%s)", string(currency)),
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	return s.remoter.ExchangeRate(mctx.Ctx(), string(currency))
}

func (s *Server) GetAvailableLocalCurrencies(ctx context.Context) (ret map[stellar1.OutsideCurrencyCode]stellar1.OutsideCurrencyDefinition, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:        "GetAvailableLocalCurrencies",
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return ret, err
	}

	conf, err := s.G().GetStellar().GetServerDefinitions(mctx.Ctx())
	if err != nil {
		return ret, err
	}
	return conf.Currencies, nil
}

func (s *Server) FormatLocalCurrencyString(ctx context.Context, arg stellar1.FormatLocalCurrencyStringArg) (res string, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:        "FormatLocalCurrencyString",
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	return stellar.FormatCurrency(mctx, arg.Amount, arg.Code, stellarnet.Round)
}

// check that the display amount is within 1% of current exchange rates
func (s *Server) checkDisplayAmount(ctx context.Context, arg stellar1.SendCLILocalArg) error {
	if arg.DisplayAmount == "" {
		return nil
	}

	exchangeRate, err := s.remoter.ExchangeRate(ctx, arg.DisplayCurrency)
	if err != nil {
		return err
	}

	xlmAmount, err := stellarnet.ConvertOutsideToXLM(arg.DisplayAmount, exchangeRate.Rate)
	if err != nil {
		return err
	}

	currentAmt, err := stellarnet.ParseStellarAmount(xlmAmount)
	if err != nil {
		return err
	}

	argAmt, err := stellarnet.ParseStellarAmount(arg.Amount)
	if err != nil {
		return err
	}

	if percentageAmountChange(currentAmt, argAmt) > 1.0 {
		s.G().Log.CDebugf(ctx, "large exchange rate delta: argAmt: %d, currentAmt: %d", argAmt, currentAmt)
		return errors.New("current exchange rates have changed more than 1%")
	}

	return nil
}

func (s *Server) MakeRequestCLILocal(ctx context.Context, arg stellar1.MakeRequestCLILocalArg) (res stellar1.KeybaseRequestID, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "MakeRequestCLILocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return "", err
	}

	uis := libkb.UIs{
		IdentifyUI: s.uiSource.IdentifyUI(s.G(), 0),
	}
	mctx = mctx.WithUIs(uis)

	return stellar.MakeRequestCLI(mctx, s.remoter, stellar.MakeRequestArg{
		To:       stellarcommon.RecipientInput(arg.Recipient),
		Amount:   arg.Amount,
		Asset:    arg.Asset,
		Currency: arg.Currency,
		Note:     arg.Note,
	})
}

func (s *Server) LookupCLILocal(ctx context.Context, arg string) (res stellar1.LookupResultCLILocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:        "LookupCLILocal",
		Err:            &err,
		RequireWallet:  false,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	uis := libkb.UIs{
		IdentifyUI: s.uiSource.IdentifyUI(s.G(), 0),
	}
	mctx = mctx.WithUIs(uis)

	recipient, err := stellar.LookupRecipient(mctx, stellarcommon.RecipientInput(arg), true)
	if err != nil {
		return res, err
	}
	if recipient.AccountID != nil {
		// Lookup Account ID -> User
		uv, username, err := stellar.LookupUserByAccountID(mctx, stellar1.AccountID(recipient.AccountID.String()))
		if err == nil {
			recipient.User = &stellarcommon.User{
				UV:       uv,
				Username: username,
			}
		}
	}
	if recipient.AccountID == nil {
		if recipient.User != nil {
			return res, fmt.Errorf("Keybase user %q does not have a Stellar account", recipient.User.Username)
		} else if recipient.Assertion != nil {
			return res, fmt.Errorf("Could not resolve assertion %q", *recipient.Assertion)
		}
		return res, fmt.Errorf("Could not find a Stellar account for %q", recipient.Input)
	}
	res.AccountID = stellar1.AccountID(*recipient.AccountID)
	if recipient.User != nil {
		u := recipient.User.Username.String()
		res.Username = &u
	}
	return res, nil
}

func (s *Server) BatchLocal(ctx context.Context, arg stellar1.BatchLocalArg) (res stellar1.BatchResultLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:        "BatchLocal",
		Err:            &err,
		RequireWallet:  true,
		AllowLoggedOut: false,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	if arg.UseMulti {
		return stellar.BatchMulti(mctx, s.walletState, arg)
	}

	return stellar.Batch(mctx, s.walletState, arg)
}

func (s *Server) ValidateStellarURILocal(ctx context.Context, arg stellar1.ValidateStellarURILocalArg) (res stellar1.ValidateStellarURIResultLocal, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "ValidateStellarURILocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return stellar1.ValidateStellarURIResultLocal{}, err
	}

	vp, _, err := s.validateStellarURI(mctx, arg.InputURI, http.DefaultClient)
	if err != nil {
		return stellar1.ValidateStellarURIResultLocal{}, err
	}
	return *vp, nil
}

const zeroSourceAccount = "00000000000000000000000000000000000000000000000000000000"

func (s *Server) validateStellarURI(mctx libkb.MetaContext, uri string, getter stellarnet.HTTPGetter) (*stellar1.ValidateStellarURIResultLocal, *stellarnet.ValidatedStellarURI, error) {
	validated, err := stellarnet.ValidateStellarURI(uri, getter)
	if err != nil {
		switch err.(type) {
		case stellarnet.ErrNetworkWellKnownOrigin, stellarnet.ErrInvalidWellKnownOrigin:
			// format these errors a little nicer for frontend to use directly
			domain, xerr := stellarnet.UnvalidatedStellarURIOriginDomain(uri)
			if xerr == nil {
				return nil, nil, fmt.Errorf("This Stellar link claims to be signed by %s, but the Keybase app cannot currently verify the signature came from %s. Sorry, there's nothing you can do with this Stellar link.", domain, domain)
			}
		}
		return nil, nil, err
	}

	local := stellar1.ValidateStellarURIResultLocal{
		Operation:    validated.Operation,
		OriginDomain: validated.OriginDomain,
		Message:      validated.Message,
		CallbackURL:  validated.CallbackURL,
		Xdr:          validated.XDR,
		Recipient:    validated.Recipient,
		Amount:       validated.Amount,
		AssetCode:    validated.AssetCode,
		AssetIssuer:  validated.AssetIssuer,
		Memo:         validated.Memo,
		MemoType:     validated.MemoType,
		Signed:       validated.Signed,
	}

	if validated.AssetCode == "" {
		accountID, err := stellar.GetOwnPrimaryAccountID(mctx)
		if err != nil {
			return nil, nil, err
		}
		displayCurrency, err := stellar.GetAccountDisplayCurrency(mctx, accountID)
		if err != nil {
			return nil, nil, err
		}
		rate, err := s.remoter.ExchangeRate(mctx.Ctx(), displayCurrency)
		if err != nil {
			return nil, nil, err
		}

		if validated.Amount != "" {
			// show how much validate.Amount XLM is in the user's display currency
			outsideAmount, err := stellarnet.ConvertXLMToOutside(validated.Amount, rate.Rate)
			if err != nil {
				return nil, nil, err
			}
			fmtWorth, err := stellar.FormatCurrencyWithCodeSuffix(mctx, outsideAmount, rate.Currency, stellarnet.Round)
			if err != nil {
				return nil, nil, err
			}
			local.DisplayAmountFiat = fmtWorth
		}

		// include user's XLM available to send
		details, err := s.remoter.Details(mctx.Ctx(), accountID)
		if err != nil {
			return nil, nil, err
		}
		availableXLM := details.Available
		if availableXLM == "" {
			availableXLM = "0"
		}
		fmtAvailableAmountXLM, err := stellar.FormatAmount(mctx, availableXLM, false, stellarnet.Round)
		if err != nil {
			return nil, nil, err
		}
		availableAmount, err := stellarnet.ConvertXLMToOutside(availableXLM, rate.Rate)
		if err != nil {
			return nil, nil, err
		}
		fmtAvailableWorth, err := stellar.FormatCurrencyWithCodeSuffix(mctx, availableAmount, rate.Currency, stellarnet.Round)
		if err != nil {
			return nil, nil, err
		}
		local.AvailableToSendNative = fmtAvailableAmountXLM + " XLM"
		local.AvailableToSendFiat = fmtAvailableWorth
	}

	if validated.TxEnv != nil {
		tx := validated.TxEnv.Tx
		if tx.SourceAccount.Address() != "" && tx.SourceAccount.Address() != zeroSourceAccount {
			local.Summary.Source = stellar1.AccountID(tx.SourceAccount.Address())
		}
		local.Summary.Fee = int(tx.Fee)
		local.Summary.Memo, local.Summary.MemoType, err = memoStrings(tx.Memo)
		if err != nil {
			return nil, nil, err
		}
		local.Summary.Operations = make([]string, len(tx.Operations))
		for i, op := range tx.Operations {
			const pastTense = false
			local.Summary.Operations[i] = stellarnet.OpSummary(op, pastTense)
		}
	}

	return &local, validated, nil
}

func (s *Server) ApproveTxURILocal(ctx context.Context, arg stellar1.ApproveTxURILocalArg) (txID stellar1.TransactionID, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "ApproveTxURILocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return "", err
	}

	// revalidate the URI
	vp, validated, err := s.validateStellarURI(mctx, arg.InputURI, http.DefaultClient)
	if err != nil {
		return "", err
	}

	txEnv := validated.TxEnv
	if txEnv == nil {
		return "", errors.New("no tx envelope in URI")
	}

	if vp.Summary.Source == "" {
		// need to fill in SourceAccount
		accountID, err := stellar.GetOwnPrimaryAccountID(mctx)
		if err != nil {
			return "", err
		}
		address, err := stellarnet.NewAddressStr(accountID.String())
		if err != nil {
			return "", err
		}
		txEnv.Tx.SourceAccount, err = address.AccountID()
		if err != nil {
			return "", err
		}
	}

	if txEnv.Tx.SeqNum == 0 {
		// need to fill in SeqNum
		sp, unlock := stellar.NewSeqnoProvider(mctx, s.walletState)
		defer unlock()

		txEnv.Tx.SeqNum, err = sp.SequenceForAccount(txEnv.Tx.SourceAccount.Address())
		if err != nil {
			return "", err
		}
	}

	// sign it
	_, seed, err := stellar.LookupSenderSeed(mctx)
	if err != nil {
		return "", err
	}
	sig, err := stellarnet.SignEnvelope(seed, *txEnv)
	if err != nil {
		return "", err
	}

	if vp.CallbackURL == "" {
		_, err := stellarnet.Submit(sig.Signed)
		if err != nil {
			return "", err
		}
	} else if err := postXDRToCallback(sig.Signed, vp.CallbackURL); err != nil {
		return "", err
	}

	return stellar1.TransactionID(sig.TxHash), nil
}

func (s *Server) ApprovePayURILocal(ctx context.Context, arg stellar1.ApprovePayURILocalArg) (txID stellar1.TransactionID, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "ApprovePayURILocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return "", err
	}

	// revalidate the URI
	vp, validated, err := s.validateStellarURI(mctx, arg.InputURI, http.DefaultClient)
	if err != nil {
		return "", err
	}

	if vp.AssetCode != "" || vp.AssetIssuer != "" {
		return "", errors.New("URI is requesting a path payment, not an XLM pay operation")
	}

	if vp.Amount == "" {
		vp.Amount = arg.Amount
	}
	memo, err := validated.MemoExport()
	if err != nil {
		return "", err
	}

	if vp.CallbackURL != "" {
		recipient, err := stellar.LookupRecipient(mctx, stellarcommon.RecipientInput(vp.Recipient), arg.FromCLI)
		if err != nil {
			return "", err
		}
		if recipient.AccountID == nil {
			return "", errors.New("recipient lookup failed to find an account")
		}
		recipientAddr, err := stellarnet.NewAddressStr(recipient.AccountID.String())
		if err != nil {
			return "", err
		}

		_, senderSeed, err := stellar.LookupSenderSeed(mctx)
		if err != nil {
			return "", err
		}

		sp, unlock := stellar.NewSeqnoProvider(mctx, s.walletState)
		defer unlock()

		baseFee := s.walletState.BaseFee(mctx)

		sig, err := stellarnet.PaymentXLMTransactionWithMemo(senderSeed, recipientAddr, vp.Amount, memo, sp, nil, baseFee)
		if err != nil {
			return "", err
		}
		if err := postXDRToCallback(sig.Signed, vp.CallbackURL); err != nil {
			return "", err
		}
		return stellar1.TransactionID(sig.TxHash), nil
	}

	sendArg := stellar.SendPaymentArg{
		To:         stellarcommon.RecipientInput(vp.Recipient),
		Amount:     vp.Amount,
		PublicMemo: memo,
	}

	var res stellar.SendPaymentResult
	if arg.FromCLI {
		sendArg.QuickReturn = false
		res, err = stellar.SendPaymentCLI(mctx, s.walletState, sendArg)
	} else {
		sendArg.QuickReturn = true
		res, err = stellar.SendPaymentGUI(mctx, s.walletState, sendArg)
	}
	if err != nil {
		return "", err
	}

	// TODO: handle callback path

	return res.TxID, nil
}

func (s *Server) GetPartnerUrlsLocal(ctx context.Context, sessionID int) (res []stellar1.PartnerUrl, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:        "GetPartnerUrlsLocal",
		Err:            &err,
		AllowLoggedOut: true,
	})
	defer fin()
	if err != nil {
		return nil, err
	}
	// Pull back all of the external_urls, but only look at the partner_urls.
	// To ensure we have flexibility in the future, only type check the objects
	// under the key we care about here.
	entry, err := s.G().GetExternalURLStore().GetLatestEntry(mctx)
	if err != nil {
		return nil, err
	}
	var externalURLs map[string]map[string][]interface{}
	if err := json.Unmarshal([]byte(entry.Entry), &externalURLs); err != nil {
		return nil, err
	}
	externalURLGroups, ok := externalURLs[libkb.ExternalURLsBaseKey]
	if !ok {
		return nil, fmt.Errorf("no external URLs to parse")
	}
	userIsKeybaseAdmin := s.G().Env.GetFeatureFlags().Admin(s.G().GetMyUID())
	for _, asInterface := range externalURLGroups[libkb.ExternalURLsStellarPartners] {
		asData, err := json.Marshal(asInterface)
		if err != nil {
			return nil, err
		}
		var partnerURL stellar1.PartnerUrl
		err = json.Unmarshal(asData, &partnerURL)
		if err != nil {
			return nil, err
		}
		if partnerURL.AdminOnly && !userIsKeybaseAdmin {
			// this external url is intended only to be seen by admins for now
			continue
		}
		res = append(res, partnerURL)
	}
	return res, nil
}

func (s *Server) ApprovePathURILocal(ctx context.Context, arg stellar1.ApprovePathURILocalArg) (txID stellar1.TransactionID, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName: "ApprovePathURILocal",
		Err:     &err,
	})
	defer fin()
	if err != nil {
		return "", err
	}

	// revalidate the URI
	vp, validated, err := s.validateStellarURI(mctx, arg.InputURI, http.DefaultClient)
	if err != nil {
		return "", err
	}

	memo, err := validated.MemoExport()
	if err != nil {
		return "", err
	}

	sendArg := stellar.SendPathPaymentArg{
		To:         stellarcommon.RecipientInput(vp.Recipient),
		Path:       arg.FullPath,
		PublicMemo: memo,
	}

	if vp.CallbackURL != "" {
		sig, _, _, err := stellar.PathPaymentTx(mctx, s.walletState, sendArg)
		if err != nil {
			return "", err
		}
		if err := postXDRToCallback(sig.Signed, vp.CallbackURL); err != nil {
			return "", err
		}
		return stellar1.TransactionID(sig.TxHash), nil
	}

	var res stellar.SendPaymentResult
	if arg.FromCLI {
		sendArg.QuickReturn = false
		res, err = stellar.SendPathPaymentCLI(mctx, s.walletState, sendArg)
	} else {
		sendArg.QuickReturn = true
		res, err = stellar.SendPathPaymentGUI(mctx, s.walletState, sendArg)
	}
	if err != nil {
		return "", err
	}

	return res.TxID, nil
}

func (s *Server) SignTransactionXdrLocal(ctx context.Context, arg stellar1.SignTransactionXdrLocalArg) (res stellar1.SignXdrResult, err error) {
	mctx, fin, err := s.Preamble(ctx, preambleArg{
		RPCName:       "SignTransactionXdrLocal",
		Err:           &err,
		RequireWallet: true,
	})
	defer fin()
	if err != nil {
		return res, err
	}

	unpackedTx, txIDPrecalc, err := unpackTx(arg.EnvelopeXdr)
	if err != nil {
		return res, err
	}

	var accountID stellar1.AccountID
	if arg.AccountID == nil {
		// Derive signer account id from transaction's sourceAccount.
		accountID = stellar1.AccountID(unpackedTx.Tx.SourceAccount.Address())
		mctx.Debug("Trying to sign with SourceAccount: %s", accountID.String())
	} else {
		// We were provided with specific AccountID we want to sign with.
		accountID = *arg.AccountID
		mctx.Debug("Trying to sign with (passed as argument): %s", accountID.String())
	}

	_, acctBundle, err := stellar.LookupSender(mctx, accountID)
	if err != nil {
		return res, err
	}

	senderSeed, err := stellarnet.NewSeedStr(acctBundle.Signers[0].SecureNoLogString())
	if err != nil {
		return res, err
	}

	signRes, err := stellarnet.SignEnvelope(senderSeed, unpackedTx)
	if err != nil {
		return res, err
	}

	res.SingedTx = signRes.Signed
	res.AccountID = accountID

	if arg.Submit {
		submitErr := s.remoter.PostAnyTransaction(mctx, signRes.Signed)
		if submitErr != nil {
			errStr := submitErr.Error()
			mctx.Debug("Submit failed with: %s\n", errStr)
			res.SubmitErr = &errStr
		} else {
			txID := stellar1.TransactionID(txIDPrecalc)
			mctx.Debug("Submit successful. Tx ID is: %s", txID.String())
			res.SubmitTxID = &txID
		}
	}

	return res, nil
}

func postXDRToCallback(signed, callbackURL string) error {
	u, err := url.Parse(callbackURL)
	if err != nil {
		return err
	}

	// take any values that are in the URL
	values := u.Query()
	// remove the RawQuery so we can POST them all as a form
	u.RawQuery = ""

	// put the signed tx in the values
	values.Set("xdr", signed)

	// POST it
	_, err = http.PostForm(callbackURL, values)
	return err
}

func percentageAmountChange(a, b int64) float64 {
	if a == 0 && b == 0 {
		return 0.0
	}
	mid := 0.5 * float64(a+b)
	return math.Abs(100.0 * float64(a-b) / mid)
}

func memoStrings(x xdr.Memo) (string, string, error) {
	switch x.Type {
	case xdr.MemoTypeMemoNone:
		return "", "MEMO_NONE", nil
	case xdr.MemoTypeMemoText:
		return x.MustText(), "MEMO_TEXT", nil
	case xdr.MemoTypeMemoId:
		return fmt.Sprintf("%d", x.MustId()), "MEMO_ID", nil
	case xdr.MemoTypeMemoHash:
		hash := x.MustHash()
		return base64.StdEncoding.EncodeToString(hash[:]), "MEMO_HASH", nil
	case xdr.MemoTypeMemoReturn:
		hash := x.MustRetHash()
		return base64.StdEncoding.EncodeToString(hash[:]), "MEMO_RETURN", nil
	default:
		return "", "", errors.New("invalid memo type")
	}
}

func unpackTx(envelopeXdr string) (unpackedTx xdr.TransactionEnvelope, txIDPrecalc string, err error) {
	err = xdr.SafeUnmarshalBase64(envelopeXdr, &unpackedTx)
	if err != nil {
		return unpackedTx, txIDPrecalc, fmt.Errorf("decoding tx: %v", err)
	}
	txIDPrecalc, err = stellarnet.HashTx(unpackedTx.Tx)
	return unpackedTx, txIDPrecalc, err
}
