package systests

import (
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

const retryCount = 5

type stellarRetryClient struct {
	cli stellar1.LocalClient
}

func newStellarRetryClient(cli *rpc.Client) *stellarRetryClient {
	return &stellarRetryClient{
		cli: stellar1.LocalClient{Cli: cli},
	}
}

func (s *stellarRetryClient) GetWalletAccountsLocal(ctx context.Context, sid int) (res []stellar1.WalletAccountLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetWalletAccountsLocal(ctx, sid)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetWalletAccountLocal(ctx context.Context, arg stellar1.GetWalletAccountLocalArg) (res stellar1.WalletAccountLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetWalletAccountLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetAccountAssetsLocal(ctx context.Context, arg stellar1.GetAccountAssetsLocalArg) (res []stellar1.AccountAssetLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetAccountAssetsLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetPaymentsLocal(ctx context.Context, arg stellar1.GetPaymentsLocalArg) (res stellar1.PaymentsPageLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetPaymentsLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetPendingPaymentsLocal(ctx context.Context, arg stellar1.GetPendingPaymentsLocalArg) (res []stellar1.PaymentOrErrorLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetPendingPaymentsLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetPaymentDetailsLocal(ctx context.Context, arg stellar1.GetPaymentDetailsLocalArg) (res stellar1.PaymentDetailsLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetPaymentDetailsLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetDisplayCurrenciesLocal(ctx context.Context, sid int) (res []stellar1.CurrencyLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetDisplayCurrenciesLocal(ctx, sid)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) ValidateAccountIDLocal(ctx context.Context, arg stellar1.ValidateAccountIDLocalArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.ValidateAccountIDLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) ValidateSecretKeyLocal(ctx context.Context, arg stellar1.ValidateSecretKeyLocalArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.ValidateSecretKeyLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) ValidateAccountNameLocal(ctx context.Context, arg stellar1.ValidateAccountNameLocalArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.ValidateAccountNameLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) ChangeWalletAccountNameLocal(ctx context.Context, arg stellar1.ChangeWalletAccountNameLocalArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.ChangeWalletAccountNameLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) SetWalletAccountAsDefaultLocal(ctx context.Context, arg stellar1.SetWalletAccountAsDefaultLocalArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.SetWalletAccountAsDefaultLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) DeleteWalletAccountLocal(ctx context.Context, arg stellar1.DeleteWalletAccountLocalArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.DeleteWalletAccountLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) LinkNewWalletAccountLocal(ctx context.Context, arg stellar1.LinkNewWalletAccountLocalArg) (res stellar1.AccountID, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.LinkNewWalletAccountLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) CreateWalletAccountLocal(ctx context.Context, arg stellar1.CreateWalletAccountLocalArg) (res stellar1.AccountID, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.CreateWalletAccountLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) ChangeDisplayCurrencyLocal(ctx context.Context, arg stellar1.ChangeDisplayCurrencyLocalArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.ChangeDisplayCurrencyLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) GetDisplayCurrencyLocal(ctx context.Context, arg stellar1.GetDisplayCurrencyLocalArg) (res stellar1.CurrencyLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetDisplayCurrencyLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) HasAcceptedDisclaimerLocal(ctx context.Context, sid int) (res bool, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.HasAcceptedDisclaimerLocal(ctx, sid)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) AcceptDisclaimerLocal(ctx context.Context, sid int) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.AcceptDisclaimerLocal(ctx, sid)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) GetWalletAccountPublicKeyLocal(ctx context.Context, arg stellar1.GetWalletAccountPublicKeyLocalArg) (res string, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetWalletAccountPublicKeyLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetWalletAccountSecretKeyLocal(ctx context.Context, arg stellar1.GetWalletAccountSecretKeyLocalArg) (res stellar1.SecretKey, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetWalletAccountSecretKeyLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetSendAssetChoicesLocal(ctx context.Context, arg stellar1.GetSendAssetChoicesLocalArg) (res []stellar1.SendAssetChoiceLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetSendAssetChoicesLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) BuildRequestLocal(ctx context.Context, arg stellar1.BuildRequestLocalArg) (res stellar1.BuildRequestResLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.BuildRequestLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err

}

func (s *stellarRetryClient) BuildPaymentLocal(ctx context.Context, arg stellar1.BuildPaymentLocalArg) (res stellar1.BuildPaymentResLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.BuildPaymentLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err

}

func (s *stellarRetryClient) SendPaymentLocal(ctx context.Context, arg stellar1.SendPaymentLocalArg) (res stellar1.SendPaymentResLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.SendPaymentLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetRequestDetailsLocal(ctx context.Context, arg stellar1.GetRequestDetailsLocalArg) (res stellar1.RequestDetailsLocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetRequestDetailsLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) CancelRequestLocal(ctx context.Context, arg stellar1.CancelRequestLocalArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.CancelRequestLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) CancelPaymentLocal(ctx context.Context, arg stellar1.CancelPaymentLocalArg) (res stellar1.RelayClaimResult, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.CancelPaymentLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) BalancesLocal(ctx context.Context, arg stellar1.AccountID) (res []stellar1.Balance, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.BalancesLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) SendCLILocal(ctx context.Context, arg stellar1.SendCLILocalArg) (res stellar1.SendResultCLILocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.SendCLILocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) ClaimCLILocal(ctx context.Context, arg stellar1.ClaimCLILocalArg) (res stellar1.RelayClaimResult, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.ClaimCLILocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) RecentPaymentsCLILocal(ctx context.Context, acctID *stellar1.AccountID) (res []stellar1.PaymentOrErrorCLILocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.RecentPaymentsCLILocal(ctx, acctID)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) PaymentDetailCLILocal(ctx context.Context, txID string) (res stellar1.PaymentCLILocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.PaymentDetailCLILocal(ctx, txID)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) WalletInitLocal(ctx context.Context) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.WalletInitLocal(ctx)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) WalletDumpLocal(ctx context.Context) (res stellar1.BundleRestricted, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.WalletDumpLocal(ctx)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) WalletGetAccountsCLILocal(ctx context.Context) (res []stellar1.OwnAccountCLILocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.WalletGetAccountsCLILocal(ctx)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) OwnAccountLocal(ctx context.Context, arg stellar1.AccountID) (res bool, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.OwnAccountLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) ImportSecretKeyLocal(ctx context.Context, arg stellar1.ImportSecretKeyLocalArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.ImportSecretKeyLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) ExportSecretKeyLocal(ctx context.Context, arg stellar1.AccountID) (res stellar1.SecretKey, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.ExportSecretKeyLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) SetDisplayCurrency(ctx context.Context, arg stellar1.SetDisplayCurrencyArg) (err error) {
	for i := 0; i < retryCount; i++ {
		err = s.cli.SetDisplayCurrency(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) ExchangeRateLocal(ctx context.Context, arg stellar1.OutsideCurrencyCode) (res stellar1.OutsideExchangeRate, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.ExchangeRateLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) GetAvailableLocalCurrencies(ctx context.Context) (res map[stellar1.OutsideCurrencyCode]stellar1.OutsideCurrencyDefinition, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.GetAvailableLocalCurrencies(ctx)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) FormatLocalCurrencyString(ctx context.Context, arg stellar1.FormatLocalCurrencyStringArg) (res string, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.FormatLocalCurrencyString(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) MakeRequestLocal(ctx context.Context, arg stellar1.MakeRequestLocalArg) (res stellar1.KeybaseRequestID, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.MakeRequestLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) MakeRequestCLILocal(ctx context.Context, arg stellar1.MakeRequestCLILocalArg) (res stellar1.KeybaseRequestID, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.MakeRequestCLILocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) LookupCLILocal(ctx context.Context, name string) (res stellar1.LookupResultCLILocal, err error) {
	for i := 0; i < retryCount; i++ {
		res, err = s.cli.LookupCLILocal(ctx, name)
		if err == nil {
			break
		}
	}
	return res, err
}

func (s *stellarRetryClient) MarkAsReadLocal(ctx context.Context, arg stellar1.MarkAsReadLocalArg) error {
	var err error
	for i := 0; i < retryCount; i++ {
		err = s.cli.MarkAsReadLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}

func (s *stellarRetryClient) IsAccountMobileOnlyLocal(ctx context.Context, arg stellar1.IsAccountMobileOnlyLocalArg) (bool, error) {
	var err error
	var mobileOnly bool
	for i := 0; i < retryCount; i++ {
		mobileOnly, err = s.cli.IsAccountMobileOnlyLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return mobileOnly, err
}

func (s *stellarRetryClient) SetAccountMobileOnlyLocal(ctx context.Context, arg stellar1.SetAccountMobileOnlyLocalArg) error {
	var err error
	for i := 0; i < retryCount; i++ {
		err = s.cli.SetAccountMobileOnlyLocal(ctx, arg)
		if err == nil {
			break
		}
	}
	return err
}
