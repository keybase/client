package stellarsvc

import (
	"context"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/stretchr/testify/require"
)

func TestGetWalletAccountsLocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	accountID := tcs[0].Backend.AddAccount()

	err = tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   tcs[0].Backend.SecretKey(accountID),
		MakePrimary: true,
		Name:        "qq",
	})
	require.NoError(t, err)

	tcs[0].Backend.ImportAccountsForUser(tcs[0])

	accts, err := tcs[0].Srv.GetWalletAccountsLocal(context.Background(), 0)
	require.NoError(t, err)

	require.Len(t, accts, 2)
	require.Equal(t, accountID, accts[0].AccountID, accountID)
	require.True(t, accts[0].IsDefault)
	require.Equal(t, "qq", accts[0].Name)
	require.Equal(t, "10,000.00 XLM", accts[0].BalanceDescription)
	require.NotEmpty(t, accts[0].Seqno)

	require.False(t, accts[1].IsDefault)
	require.Equal(t, firstAccountName(t, tcs[0]), accts[1].Name)
	require.Equal(t, "0 XLM", accts[1].BalanceDescription)
	require.NotEmpty(t, accts[1].Seqno)

	// test the singular version as well
	argDetails := stellar1.GetWalletAccountLocalArg{AccountID: accountID}
	details, err := tcs[0].Srv.GetWalletAccountLocal(context.Background(), argDetails)
	require.NoError(t, err)
	require.Equal(t, "qq", accts[0].Name)
	require.True(t, details.IsDefault)
	require.Equal(t, "10,000.00 XLM", details.BalanceDescription)
	require.NotEmpty(t, details.Seqno)

	argDetails.AccountID = accts[1].AccountID
	details, err = tcs[0].Srv.GetWalletAccountLocal(context.Background(), argDetails)
	require.NoError(t, err)
	require.Equal(t, firstAccountName(t, tcs[0]), accts[1].Name)
	require.False(t, details.IsDefault)
	require.Equal(t, "0 XLM", details.BalanceDescription)
	require.NotEmpty(t, details.Seqno)
}

func TestGetAccountAssetsLocalWithBalance(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	accountID := tcs[0].Backend.AddAccount()

	err = tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   tcs[0].Backend.SecretKey(accountID),
		MakePrimary: true,
		Name:        "qq",
	})
	require.NoError(t, err)

	tcs[0].Backend.ImportAccountsForUser(tcs[0])

	assets, err := tcs[0].Srv.GetAccountAssetsLocal(context.Background(), stellar1.GetAccountAssetsLocalArg{AccountID: accountID})
	require.NoError(t, err)

	require.Len(t, assets, 1)
	require.Equal(t, "Lumens", assets[0].Name)
	require.Equal(t, "XLM", assets[0].AssetCode)
	require.Equal(t, "Stellar network", assets[0].IssuerName)
	require.Equal(t, "", assets[0].IssuerAccountID)
	require.Equal(t, "10,000.00", assets[0].BalanceTotal)
	require.Equal(t, "9,998.9999900", assets[0].BalanceAvailableToSend)
	require.Equal(t, "USD", assets[0].WorthCurrency)
	require.Equal(t, "$3,183.28", assets[0].Worth)
	require.Equal(t, "$3,182.96", assets[0].AvailableToSendWorth)
}

func TestGetAccountAssetsLocalEmptyBalance(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	tcs[0].Backend.ImportAccountsForUser(tcs[0])

	accounts, err := tcs[0].Srv.GetWalletAccountsLocal(context.Background(), 0)
	require.NoError(t, err)
	accountID := accounts[0].AccountID

	assets, err := tcs[0].Srv.GetAccountAssetsLocal(context.Background(), stellar1.GetAccountAssetsLocalArg{AccountID: accountID})
	require.NoError(t, err)

	require.Len(t, assets, 1)
	require.Equal(t, "Lumens", assets[0].Name)
	require.Equal(t, "XLM", assets[0].AssetCode)
	require.Equal(t, "Stellar network", assets[0].IssuerName)
	require.Equal(t, "", assets[0].IssuerAccountID)
	require.Equal(t, "0", assets[0].BalanceTotal)
	require.Equal(t, "0", assets[0].BalanceAvailableToSend)
	require.Equal(t, "USD", assets[0].WorthCurrency)
	require.Equal(t, "$0.00", assets[0].Worth)
	require.Equal(t, "$0.00", assets[0].AvailableToSendWorth)
}

func TestGetDisplayCurrenciesLocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	currencies, err := tcs[0].Srv.GetDisplayCurrenciesLocal(context.Background(), 0)
	require.NoError(t, err)

	require.Len(t, currencies, 32)
	// USD should go first.
	require.Equal(t, "USD ($)", currencies[0].Description)
	require.Equal(t, stellar1.OutsideCurrencyCode("USD"), currencies[0].Code)
	require.Equal(t, "$", currencies[0].Symbol)
	// Rest is in alphabetical order.
	require.Equal(t, "AUD ($)", currencies[1].Description)
	require.Equal(t, stellar1.OutsideCurrencyCode("AUD"), currencies[1].Code)
	require.Equal(t, "$", currencies[1].Symbol)
}

func TestValidateAccountID(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	units := []struct {
		s  string
		ok bool
	}{
		{"GCTXTGK45J3PAPOPK7XLZVZVJYAFTSTWRDWOCRPN5ICQWHQLTBLNN4AQ", true},
		{"gctxtgk45j3papopk7xlzvzvjyaftstwrdwocrpn5icqwhqltblnn4aq", true},
		{"GCTXTGK45J3PAPOPK7XLZVZVJYAFTSTWRDWOCRPN5ICQWHQLTBLNN4A", false},
		{"GCTXTGK45J3PAPOPK7XLZVZVJYAFTSTWRDWOCRPN5ICQWHQLTBLNN4AQQ", false},
		{"GCTXTGK45J3PAPOPK7XLZVZVJYAFTSTWRDWOCRPN5ICQWHQLTBLNN4AR", false},
		{"", false},
		{"a", false},
	}
	for _, u := range units {
		t.Logf("unit: %v", u)
		err := tcs[0].Srv.ValidateAccountIDLocal(context.Background(), stellar1.ValidateAccountIDLocalArg{AccountID: stellar1.AccountID(u.s)})
		if u.ok {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
		}
	}
}

func TestValidateSecretKey(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	units := []struct {
		s  string
		ok bool
	}{
		{"SDXUQS3V6JVO7IN6ZGYEGAUMHJBZK7O7644XIRSCSQ5PFONFK3LO2SCY", true},
		{"sdxuqs3v6jvo7in6zgyegaumhjbzk7o7644xirscsq5pfonfk3lo2scy", true},
		{"SDXUQS3V6JVO7IN6ZGYEGAUMHJBZK7O7644XIRSCSQ5PFONFK3LO2SC", false},
		{"SDXUQS3V6JVO7IN6ZGYEGAUMHJBZK7O7644XIRSCSQ5PFONFK3LO2SCYY", false},
		{"SDXUQS3V6JVO7IN6ZGYEGAUMHJBZK7O7644XIRSCSQ5PFONFK3LO2SCZ", false},
		{"", false},
		{"a", false},
	}
	for _, u := range units {
		t.Logf("unit: %v", u)
		err := tcs[0].Srv.ValidateSecretKeyLocal(context.Background(), stellar1.ValidateSecretKeyLocalArg{SecretKey: stellar1.SecretKey(u.s)})
		if u.ok {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
		}
	}
}

func TestChangeWalletName(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	tcs[0].Backend.ImportAccountsForUser(tcs[0])

	accs, err := tcs[0].Srv.WalletGetAccountsCLILocal(context.Background())
	require.NoError(t, err)
	require.Len(t, accs, 1)
	require.Equal(t, accs[0].Name, firstAccountName(t, tcs[0]))

	chk := func(name string, expected string) {
		err = tcs[0].Srv.ValidateAccountNameLocal(context.Background(), stellar1.ValidateAccountNameLocalArg{Name: name})
		if expected == "" {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
			require.Equal(t, expected, err.Error())
		}
	}

	chk("", "name required")
	chk("office lunch money", "")
	chk("savings", "")
	err = tcs[0].Srv.ChangeWalletAccountNameLocal(context.Background(), stellar1.ChangeWalletAccountNameLocalArg{
		AccountID: accs[0].AccountID,
		NewName:   "office lunch money",
	})
	require.NoError(t, err)
	chk("office lunch money", "you already have an account with that name")
	chk("career debter", "")

	accs, err = tcs[0].Srv.WalletGetAccountsCLILocal(context.Background())
	require.NoError(t, err)
	require.Len(t, accs, 1)
	require.Equal(t, accs[0].Name, "office lunch money")

	// Try invalid argument
	invalidAccID, _ := randomStellarKeypair()
	err = tcs[0].Srv.ChangeWalletAccountNameLocal(context.Background(), stellar1.ChangeWalletAccountNameLocalArg{
		AccountID: invalidAccID,
		NewName:   "savings",
	})
	require.Error(t, err)
	chk("savings", "")

	chk("an account used for savi", "")
	chk("an account used for savin", "account name can be 24 characters at the longest but was 25")
}

func TestSetAccountAsDefault(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)

	tcs[0].Backend.ImportAccountsForUser(tcs[0])

	accs, err := tcs[0].Srv.WalletGetAccountsCLILocal(context.Background())
	require.NoError(t, err)
	require.Len(t, accs, 1)

	require.True(t, accs[0].IsPrimary)

	// Should work for accounts that are already primary and not post
	// a bundle.
	err = tcs[0].Srv.SetWalletAccountAsDefaultLocal(context.Background(), stellar1.SetWalletAccountAsDefaultLocalArg{
		AccountID: accs[0].AccountID,
	})
	require.NoError(t, err)

	bundle, _, err := remote.Fetch(context.Background(), tcs[0].G)
	require.NoError(t, err)
	require.EqualValues(t, 1, bundle.Revision)

	// Test invalid arguments
	invalidAccID, _ := randomStellarKeypair()
	err = tcs[0].Srv.SetWalletAccountAsDefaultLocal(context.Background(), stellar1.SetWalletAccountAsDefaultLocalArg{
		AccountID: invalidAccID,
	})
	require.Error(t, err)

	err = tcs[0].Srv.SetWalletAccountAsDefaultLocal(context.Background(), stellar1.SetWalletAccountAsDefaultLocalArg{
		AccountID: stellar1.AccountID(""),
	})
	require.Error(t, err)

	additionalAccs := []stellar1.AccountID{
		tcs[0].Backend.AddAccountEmpty(t),
		tcs[0].Backend.AddAccountEmpty(t),
	}

	for _, v := range additionalAccs {
		err = tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
			SecretKey:   tcs[0].Backend.SecretKey(v),
			MakePrimary: false,
			Name:        "qq",
		})
		require.NoError(t, err)
	}

	for i := len(additionalAccs) - 1; i >= 0; i-- {
		v := additionalAccs[i]
		arg := stellar1.SetWalletAccountAsDefaultLocalArg{
			AccountID: v,
		}
		err := tcs[0].Srv.SetWalletAccountAsDefaultLocal(context.Background(), arg)
		require.NoError(t, err)

		accs, err := tcs[0].Srv.WalletGetAccountsCLILocal(context.Background())
		require.NoError(t, err)
		require.Len(t, accs, 3)
		for _, acc := range accs {
			require.Equal(t, acc.IsPrimary, acc.AccountID == v)
		}
	}

	// Expecting additionalAccs[0] to be default account. Lookup
	// public Stellar address as another user.
	u0, err := tcs[1].G.LoadUserByUID(tcs[0].Fu.User.GetUID())
	require.NoError(t, err)
	u0addr := u0.StellarAccountID()
	require.NotNil(t, u0addr)
	require.Equal(t, additionalAccs[0], *u0addr)
}

func testCreateOrLinkNewAccount(t *testing.T, create bool) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	// link a new account
	var accID stellar1.AccountID
	var err error
	accName := "my other account"
	if create {
		// create new account
		arg := stellar1.CreateWalletAccountLocalArg{
			Name: accName,
		}
		accID, err = tcs[0].Srv.CreateWalletAccountLocal(context.Background(), arg)
		require.NoError(t, err)
	} else {
		a1, s1 := randomStellarKeypair()
		arg := stellar1.LinkNewWalletAccountLocalArg{
			SecretKey: s1,
			Name:      accName,
		}
		accID, err = tcs[0].Srv.LinkNewWalletAccountLocal(context.Background(), arg)
		require.NoError(t, err)
		require.Equal(t, a1, accID)
	}

	tcs[0].Backend.ImportAccountsForUser(tcs[0])

	accts, err := tcs[0].Srv.GetWalletAccountsLocal(context.Background(), 0)
	require.NoError(t, err)

	require.Len(t, accts, 2)
	require.True(t, accts[0].IsDefault)
	require.Equal(t, firstAccountName(t, tcs[0]), accts[0].Name)
	require.Equal(t, "0 XLM", accts[0].BalanceDescription)
	require.False(t, accts[1].IsDefault)
	require.Equal(t, accID, accts[1].AccountID)
	require.Equal(t, accName, accts[1].Name)
	require.Equal(t, "0 XLM", accts[1].BalanceDescription)
}

func TestLinkNewWalletAccountLocal(t *testing.T) {
	testCreateOrLinkNewAccount(t, false /* create */)
}

func TestCreateNewWalletAccountLocal(t *testing.T) {
	testCreateOrLinkNewAccount(t, true /* create */)
}

func TestDeleteWallet(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	stellar.CreateWallet(context.Background(), tcs[0].G)
	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	accID := getPrimaryAccountID(tcs[0])

	// Cannot delete the only account (also primary).
	err := tcs[0].Srv.DeleteWalletAccountLocal(context.Background(), stellar1.DeleteWalletAccountLocalArg{
		AccountID:        accID,
		UserAcknowledged: "yes",
	})
	require.Error(t, err)

	// Cannot delete account that doesnt exist.
	invalidAccID, _ := randomStellarKeypair()
	err = tcs[0].Srv.DeleteWalletAccountLocal(context.Background(), stellar1.DeleteWalletAccountLocalArg{
		AccountID:        invalidAccID,
		UserAcknowledged: "yes",
	})
	require.Error(t, err)

	// Add new account, make it primary, now first account should be
	// deletable.
	accID2 := tcs[0].Backend.AddAccountEmpty(t)
	err = tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   tcs[0].Backend.SecretKey(accID2),
		MakePrimary: true,
		Name:        "qq",
	})
	require.NoError(t, err)

	// First try without `UserAcknowledged`.
	err = tcs[0].Srv.DeleteWalletAccountLocal(context.Background(), stellar1.DeleteWalletAccountLocalArg{
		AccountID: accID,
	})
	require.Error(t, err)

	err = tcs[0].Srv.DeleteWalletAccountLocal(context.Background(), stellar1.DeleteWalletAccountLocalArg{
		AccountID:        accID,
		UserAcknowledged: "yes",
	})
	require.NoError(t, err)

	accs, err := tcs[0].Srv.WalletGetAccountsCLILocal(context.Background())
	require.NoError(t, err)
	require.Len(t, accs, 1)
	require.Equal(t, accs[0].AccountID, accID2)
	require.True(t, accs[0].IsPrimary)
}

func TestChangeDisplayCurrency(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	stellar.CreateWallet(context.Background(), tcs[0].G)
	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	accID := getPrimaryAccountID(tcs[0])

	// Try invalid currency first.
	err := tcs[0].Srv.ChangeDisplayCurrencyLocal(context.Background(), stellar1.ChangeDisplayCurrencyLocalArg{
		AccountID: accID,
		Currency:  stellar1.OutsideCurrencyCode("ZZZ"),
	})
	require.Error(t, err)

	// Try empty account id.
	err = tcs[0].Srv.ChangeDisplayCurrencyLocal(context.Background(), stellar1.ChangeDisplayCurrencyLocalArg{
		AccountID: stellar1.AccountID(""),
		Currency:  stellar1.OutsideCurrencyCode("USD"),
	})
	require.Error(t, err)

	// Try non-existant account id.
	invalidAccID, _ := randomStellarKeypair()
	err = tcs[0].Srv.ChangeDisplayCurrencyLocal(context.Background(), stellar1.ChangeDisplayCurrencyLocalArg{
		AccountID: invalidAccID,
		Currency:  stellar1.OutsideCurrencyCode("USD"),
	})
	require.Error(t, err)

	// Make wallet as other user, and try to change the currency as
	// first user.
	stellar.CreateWallet(context.Background(), tcs[1].G)
	tcs[1].Backend.ImportAccountsForUser(tcs[1])
	accID2 := getPrimaryAccountID(tcs[1])
	err = tcs[0].Srv.ChangeDisplayCurrencyLocal(context.Background(), stellar1.ChangeDisplayCurrencyLocalArg{
		AccountID: accID2,
		Currency:  stellar1.OutsideCurrencyCode("EUR"),
	})
	require.Error(t, err)

	// Finally, a happy path.
	err = tcs[0].Srv.ChangeDisplayCurrencyLocal(context.Background(), stellar1.ChangeDisplayCurrencyLocalArg{
		AccountID: accID,
		Currency:  stellar1.OutsideCurrencyCode("EUR"),
	})
	require.NoError(t, err)

	// Check both CLI and Frontend RPCs.
	accs, err := tcs[0].Srv.WalletGetAccountsCLILocal(context.Background())
	require.NoError(t, err)
	require.Len(t, accs, 1)
	require.NotNil(t, accs[0].ExchangeRate)
	require.EqualValues(t, "EUR", accs[0].ExchangeRate.Currency)

	balances, err := tcs[0].Srv.GetAccountAssetsLocal(context.Background(), stellar1.GetAccountAssetsLocalArg{
		AccountID: accID,
	})
	require.NoError(t, err)
	require.Len(t, balances, 1)
	require.EqualValues(t, "EUR", balances[0].WorthCurrency)
}

func TestGetWalletSettingsNoAccount(t *testing.T) {
	tcs, cleanup := setupTestsWithSettings(t, []usetting{usettingWalletless})
	defer cleanup()

	ret, err := tcs[0].Srv.GetWalletSettingsLocal(context.Background(), 0)
	require.NoError(t, err)
	require.Equal(t, false, ret.AcceptedDisclaimer)
}

func TestGetWalletSettings(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	ret, err := tcs[0].Srv.GetWalletSettingsLocal(context.Background(), 0)
	require.NoError(t, err)
	require.Equal(t, false, ret.AcceptedDisclaimer)
}

func TestSetAcceptedDisclaimer(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	us, err := tcs[0].Srv.GetWalletSettingsLocal(context.Background(), 0)
	require.NoError(t, err)
	require.Equal(t, false, us.AcceptedDisclaimer)

	err = tcs[0].Srv.SetAcceptedDisclaimerLocal(context.Background(), 0)
	require.NoError(t, err)

	us, err = tcs[0].Srv.GetWalletSettingsLocal(context.Background(), 0)
	require.NoError(t, err)
	require.Equal(t, true, us.AcceptedDisclaimer)
}

func TestPublicKeyExporting(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	stellar.CreateWallet(context.Background(), tcs[0].G)
	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	accID := getPrimaryAccountID(tcs[0])

	// Try empty argument.
	_, err := tcs[0].Srv.GetWalletAccountPublicKeyLocal(context.Background(), stellar1.GetWalletAccountPublicKeyLocalArg{
		AccountID: stellar1.AccountID(""),
	})
	require.Error(t, err)

	// Anything should work - even accounts that don't exist or are
	// not ours.
	randomAccID, _ := randomStellarKeypair()
	pubKey, err := tcs[0].Srv.GetWalletAccountPublicKeyLocal(context.Background(), stellar1.GetWalletAccountPublicKeyLocalArg{
		AccountID: randomAccID,
	})
	require.NoError(t, err)
	require.EqualValues(t, randomAccID, pubKey)

	// Try account of our own.
	pubKey, err = tcs[0].Srv.GetWalletAccountPublicKeyLocal(context.Background(), stellar1.GetWalletAccountPublicKeyLocalArg{
		AccountID: accID,
	})
	require.NoError(t, err)
	require.EqualValues(t, accID, pubKey)
}

func TestPrivateKeyExporting(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	stellar.CreateWallet(context.Background(), tcs[0].G)
	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	accID := getPrimaryAccountID(tcs[0])

	// Try empty argument.
	_, err := tcs[0].Srv.GetWalletAccountSecretKeyLocal(context.Background(), stellar1.GetWalletAccountSecretKeyLocalArg{
		AccountID: stellar1.AccountID(""),
	})
	require.Error(t, err)

	// Try random account ID.
	randomAccID, _ := randomStellarKeypair()
	_, err = tcs[0].Srv.GetWalletAccountSecretKeyLocal(context.Background(), stellar1.GetWalletAccountSecretKeyLocalArg{
		AccountID: randomAccID,
	})
	require.Error(t, err)

	// Happy path.
	privKey, err := tcs[0].Srv.GetWalletAccountSecretKeyLocal(context.Background(), stellar1.GetWalletAccountSecretKeyLocalArg{
		AccountID: accID,
	})
	require.NoError(t, err)
	require.EqualValues(t, tcs[0].Backend.SecretKey(accID), privKey)
}

func TestGetPaymentsLocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	_, err = stellar.CreateWallet(context.Background(), tcs[1].G)
	require.NoError(t, err)

	srvSender := tcs[0].Srv
	rm := tcs[0].Backend
	accountIDSender := rm.AddAccount()
	accountIDRecip := rm.AddAccount()
	accountIDRecip2 := rm.AddAccount()

	srvRecip := tcs[1].Srv

	err = srvSender.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountIDSender),
		MakePrimary: true,
		Name:        "qq",
	})
	require.NoError(t, err)

	err = srvSender.ChangeWalletAccountNameLocal(context.Background(), stellar1.ChangeWalletAccountNameLocalArg{
		AccountID: accountIDSender,
		NewName:   "office lunch money",
	})
	require.NoError(t, err)

	err = srvRecip.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountIDRecip),
		MakePrimary: true,
		Name:        "uu",
	})
	require.NoError(t, err)

	err = srvRecip.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountIDRecip2),
		MakePrimary: false,
		Name:        "vv",
	})
	require.NoError(t, err)

	// Try some payments that should fail locally
	{
		_, err := srvSender.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
			From:          accountIDRecip, // From the wrong account
			To:            tcs[1].Fu.Username,
			ToIsAccountID: false,
			Amount:        "1011.123",
			Asset:         stellar1.AssetNative(),
			WorthAmount:   "321.87",
			WorthCurrency: &usd,
			SecretNote:    "here you go",
			PublicMemo:    "public note",
		})
		require.Error(t, err)
		require.Equal(t, "Sender account not found", err.Error())

		_, err = srvSender.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
			From:          accountIDSender,
			To:            tcs[1].Fu.Username,
			ToIsAccountID: true, // fail to parse account ID
			Amount:        "1011.123",
			Asset:         stellar1.AssetNative(),
			WorthAmount:   "321.87",
			WorthCurrency: &usd,
			SecretNote:    "here you go",
			PublicMemo:    "public note",
		})
		require.Error(t, err)
		require.Equal(t, "recipient: Stellar account ID must be 56 chars long: was 15", err.Error())
	}

	// set up notification listeners
	listenerSender := newChatListener()
	listenerRecip := newChatListener()
	tcs[0].G.NotifyRouter.SetListener(listenerSender)
	tcs[1].G.NotifyRouter.SetListener(listenerRecip)

	sendRes, err := srvSender.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
		From:          accountIDSender,
		To:            tcs[1].Fu.Username,
		ToIsAccountID: false,
		Amount:        "1011.123",
		Asset:         stellar1.AssetNative(),
		WorthAmount:   "321.87",
		WorthCurrency: &usd,
		SecretNote:    "here you go",
		PublicMemo:    "public note",
	})
	require.NoError(t, err)
	require.Len(t, sendRes.KbTxID, 32)
	require.False(t, sendRes.Pending)

	// simulate exchange rate changing
	tcs[0].Backend.UseAlternateExchangeRate()

	checkPayment := func(p stellar1.PaymentLocal, sender bool) {
		require.NotEmpty(t, p.Id)
		require.NotZero(t, p.Time)
		require.Equal(t, stellar1.PaymentStatus_COMPLETED, p.StatusSimplified)
		require.Equal(t, "completed", p.StatusDescription)
		require.Empty(t, p.StatusDetail)
		if sender {
			require.Equal(t, "1,011.1230000 XLM", p.AmountDescription, "Amount")
			require.Equal(t, stellar1.BalanceDelta_DECREASE, p.Delta)
		} else {
			require.Equal(t, "1,011.1230000 XLM", p.AmountDescription, "Amount")
			require.Equal(t, stellar1.BalanceDelta_INCREASE, p.Delta)
		}
		require.Equal(t, "$321.87", p.Worth, "Worth")
		require.Equal(t, "USD", p.WorthCurrency, "WorthCurrency")
		require.Equal(t, "$214.49", p.CurrentWorth, "CurrentWorth")
		require.Equal(t, "USD", p.CurrentWorthCurrency, "CurrentWorthCurrency")

		require.Equal(t, stellar1.ParticipantType_KEYBASE, p.FromType)
		require.Equal(t, accountIDSender, p.FromAccountID)
		var fromAccountName string
		if sender {
			fromAccountName = "office lunch money"
		}
		require.Equal(t, fromAccountName, p.FromAccountName, "FromAccountName")
		require.Equal(t, tcs[0].Fu.Username, p.FromUsername)
		require.Equal(t, stellar1.ParticipantType_KEYBASE, p.ToType)
		require.Equal(t, accountIDRecip, *p.ToAccountID)
		var toAccountName string
		if !sender {
			toAccountName = "uu"
		}
		require.Equal(t, toAccountName, p.ToAccountName, "ToAccountName")
		require.Equal(t, tcs[1].Fu.Username, p.ToUsername)
		require.Equal(t, "", p.ToAssertion)

		require.Equal(t, "here you go", p.Note)
		require.Empty(t, p.NoteErr)
	}
	senderPaymentsPage, err := srvSender.GetPaymentsLocal(context.Background(), stellar1.GetPaymentsLocalArg{AccountID: accountIDSender})
	require.NoError(t, err)
	senderPayments := senderPaymentsPage.Payments
	require.Len(t, senderPayments, 1)
	t.Logf("senderPayments: %v", spew.Sdump(senderPayments))
	if senderPayments[0].Err != nil {
		t.Logf("senderPayments error: %+v", *senderPayments[0].Err)
	}
	require.NotNil(t, senderPayments[0].Payment)
	checkPayment(*senderPayments[0].Payment, true)

	recipPaymentsPage, err := srvRecip.GetPaymentsLocal(context.Background(), stellar1.GetPaymentsLocalArg{AccountID: accountIDRecip})
	require.NoError(t, err)
	recipPayments := recipPaymentsPage.Payments
	require.Len(t, recipPayments, 1)
	require.NotNil(t, recipPayments[0].Payment)
	checkPayment(*recipPayments[0].Payment, false)

	// pretend that the chat message was unboxed and call the payment loader to load the info:
	loader := stellar.DefaultLoader(tcs[0].G)
	convID := chat1.ConversationID("abcd")
	msgID := chat1.MessageID(987)
	loader.LoadPayment(context.Background(), convID, msgID, tcs[0].Fu.Username, senderPayments[0].Payment.Id)

	// for the recipient too
	recipLoader := stellar.NewLoader(tcs[1].G)
	recipLoader.LoadPayment(context.Background(), convID, msgID, tcs[0].Fu.Username, senderPayments[0].Payment.Id)

	// check the sender chat notification
	select {
	case info := <-listenerSender.paymentInfos:
		t.Logf("info from listener: %+v", info)
		require.NotNil(t, info)
		require.Equal(t, info.Uid, tcs[0].Fu.User.GetUID())
		require.Equal(t, info.MsgID, msgID)
		require.True(t, info.ConvID.Eq(convID))
		require.Equal(t, info.Info.AmountDescription, "1,011.1230000 XLM")
		require.Equal(t, stellar1.BalanceDelta_DECREASE, info.Info.Delta)
		require.Equal(t, info.Info.Worth, "$321.87")
		require.Equal(t, info.Info.Note, "here you go")
		require.Equal(t, info.Info.Status, stellar1.PaymentStatus_COMPLETED)
		require.Equal(t, info.Info.StatusDescription, "completed")
	case <-time.After(20 * time.Second):
		t.Fatal("timed out waiting for chat payment info notification to sender")
	}

	// check the recipient chat notification
	select {
	case info := <-listenerRecip.paymentInfos:
		t.Logf("info from listener: %+v", info)
		require.NotNil(t, info)
		require.Equal(t, info.Uid, tcs[1].Fu.User.GetUID())
		require.Equal(t, info.MsgID, msgID)
		require.True(t, info.ConvID.Eq(convID))
		require.Equal(t, info.Info.AmountDescription, "1,011.1230000 XLM")
		require.Equal(t, info.Info.Delta, stellar1.BalanceDelta_INCREASE)
		require.Equal(t, info.Info.Worth, "$321.87")
		require.Equal(t, info.Info.Note, "here you go")
		require.Equal(t, info.Info.Status, stellar1.PaymentStatus_COMPLETED)
		require.Equal(t, info.Info.StatusDescription, "completed")
	case <-time.After(20 * time.Second):
		t.Fatal("timed out waiting for chat payment info notification to sender")
	}

	// check the details
	checkPaymentDetails := func(p stellar1.PaymentDetailsLocal, sender bool) {
		require.NotEmpty(t, p.Id)
		require.NotZero(t, p.Time)
		require.Equal(t, stellar1.PaymentStatus_COMPLETED, p.StatusSimplified)
		require.Equal(t, "completed", p.StatusDescription)
		require.Empty(t, p.StatusDetail)
		if sender {
			require.Equal(t, "1,011.1230000 XLM", p.AmountDescription, "Amount")
			require.Equal(t, stellar1.BalanceDelta_DECREASE, p.Delta)
		} else {
			require.Equal(t, "1,011.1230000 XLM", p.AmountDescription, "Amount")
			require.Equal(t, stellar1.BalanceDelta_INCREASE, p.Delta)
		}
		require.Equal(t, "$321.87", p.Worth, "Worth")
		require.Equal(t, "USD", p.WorthCurrency, "WorthCurrency")
		require.Equal(t, "$214.49", p.CurrentWorth, "CurrentWorth")
		require.Equal(t, "USD", p.CurrentWorthCurrency, "CurrentWorthCurrency")

		require.Equal(t, stellar1.ParticipantType_KEYBASE, p.FromType)
		require.Equal(t, accountIDSender, p.FromAccountID)
		var fromAccountName string
		if sender {
			fromAccountName = "office lunch money"
		}
		require.Equal(t, fromAccountName, p.FromAccountName)
		require.Equal(t, tcs[0].Fu.Username, p.FromUsername)
		require.Equal(t, stellar1.ParticipantType_KEYBASE, p.ToType)
		require.Equal(t, accountIDRecip, *p.ToAccountID)
		var toAccountName string
		if !sender {
			toAccountName = "uu"
		}
		require.Equal(t, toAccountName, p.ToAccountName)
		require.Equal(t, tcs[1].Fu.Username, p.ToUsername)
		require.Equal(t, "", p.ToAssertion)

		require.Equal(t, "here you go", p.Note)
		require.Empty(t, p.NoteErr)
		require.Equal(t, "public note", p.PublicNote)
		require.Equal(t, "text", p.PublicNoteType)
	}
	details, err := srvSender.GetPaymentDetailsLocal(context.Background(), stellar1.GetPaymentDetailsLocalArg{
		Id:        senderPayments[0].Payment.Id,
		AccountID: &accountIDSender,
	})
	require.NoError(t, err)
	checkPaymentDetails(details, true)

	details, err = srvRecip.GetPaymentDetailsLocal(context.Background(), stellar1.GetPaymentDetailsLocalArg{
		Id:        recipPayments[0].Payment.Id,
		AccountID: &accountIDRecip,
	})
	require.NoError(t, err)
	checkPaymentDetails(details, false)

	// use default exchange rate again since about to send new payments.
	tcs[0].Backend.UseDefaultExchangeRate()

	// Send again with FromSeqno set.
	// Does not test whether it has any effect.
	_, err = srvSender.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
		From:          accountIDSender,
		FromSeqno:     "1928401923",
		To:            tcs[1].Fu.Username,
		ToIsAccountID: false,
		Amount:        "1011.123",
		Asset:         stellar1.AssetNative(),
		WorthAmount:   "321.87",
		WorthCurrency: &usd,
		SecretNote:    "here you go",
		PublicMemo:    "public note",
	})
	require.NoError(t, err)

	// send to stellar account ID to check target in PaymentLocal
	sendRes, err = srvSender.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
		From: accountIDSender,
		// Use a secondary account so that LookupRecipient can't resolve it to the user
		To:            accountIDRecip2.String(),
		ToIsAccountID: true,
		Amount:        "101.456",
		Asset:         stellar1.AssetNative(),
		WorthAmount:   "321.87",
		WorthCurrency: &usd,
		SecretNote:    "here you go",
		PublicMemo:    "public note",
	})
	require.NoError(t, err)
	require.Len(t, sendRes.KbTxID, 32)
	require.False(t, sendRes.Pending)
	senderPaymentsPage, err = srvSender.GetPaymentsLocal(context.Background(), stellar1.GetPaymentsLocalArg{AccountID: accountIDSender})
	require.NoError(t, err)
	senderPayments = senderPaymentsPage.Payments
	require.Len(t, senderPayments, 3)
	t.Logf("senderPayments: %+v", senderPayments)
	if senderPayments[0].Err != nil {
		t.Logf("senderPayments error: %+v", *senderPayments[0].Err)
	}
	p := senderPayments[0].Payment
	require.NotNil(t, p)
	require.Equal(t, stellar1.ParticipantType_KEYBASE, p.FromType)
	require.Equal(t, accountIDSender, p.FromAccountID)
	require.Equal(t, "office lunch money", p.FromAccountName)
	require.Equal(t, tcs[0].Fu.Username, p.FromUsername)
	require.Equal(t, stellar1.ParticipantType_STELLAR, p.ToType)
	require.Equal(t, accountIDRecip2, *p.ToAccountID)
	require.Equal(t, "", p.ToAccountName)
	require.Equal(t, "", p.ToUsername)
	require.Equal(t, "", p.ToAssertion)

	recipPaymentsPage, err = srvRecip.GetPaymentsLocal(context.Background(), stellar1.GetPaymentsLocalArg{AccountID: accountIDRecip2})
	require.NoError(t, err)
	recipPayments = recipPaymentsPage.Payments
	require.Len(t, recipPayments, 1)
	t.Logf("recipPayments: %+v", recipPayments)
	p = recipPayments[0].Payment
	require.NotNil(t, p)
	require.Equal(t, stellar1.ParticipantType_KEYBASE, p.FromType)
	require.Equal(t, accountIDSender, p.FromAccountID)
	require.Equal(t, tcs[0].Fu.Username, p.FromUsername)
	require.Equal(t, "", p.FromAccountName)
	require.Equal(t, stellar1.ParticipantType_STELLAR, p.ToType)
	require.Equal(t, accountIDRecip2, *p.ToAccountID)
	require.Equal(t, "vv", p.ToAccountName)
	require.Equal(t, "", p.ToUsername)
	require.Equal(t, "", p.ToAssertion)
	require.NotEmpty(t, p.NoteErr) // can't send encrypted note to stellar address
}

func TestSendToSelf(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	rm := tcs[0].Backend
	accountID1 := rm.AddAccount()
	accountID2 := rm.AddAccount()

	err := tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey:   rm.SecretKey(accountID1),
		MakePrimary: true,
		Name:        "qq",
	})
	require.NoError(t, err)

	err = tcs[0].Srv.ChangeWalletAccountNameLocal(context.Background(), stellar1.ChangeWalletAccountNameLocalArg{
		AccountID: accountID1,
		NewName:   "office lunch money",
	})
	require.NoError(t, err)

	err = tcs[0].Srv.ImportSecretKeyLocal(context.Background(), stellar1.ImportSecretKeyLocalArg{
		SecretKey: rm.SecretKey(accountID2),
		Name:      "uu",
	})
	require.NoError(t, err)

	err = tcs[0].Srv.ChangeWalletAccountNameLocal(context.Background(), stellar1.ChangeWalletAccountNameLocalArg{
		AccountID: accountID2,
		NewName:   "savings",
	})
	require.NoError(t, err)

	t.Logf("Send to the same account")
	_, err = tcs[0].Srv.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
		From:          accountID1,
		To:            accountID1.String(),
		ToIsAccountID: true,
		Amount:        "100",
		Asset:         stellar1.AssetNative(),
	})
	require.NoError(t, err)

	t.Logf("Send to another of the same user's account")
	_, err = tcs[0].Srv.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
		From:          accountID1,
		To:            accountID2.String(),
		ToIsAccountID: true,
		Amount:        "200",
		Asset:         stellar1.AssetNative(),
	})
	require.NoError(t, err)

	t.Logf("Send from another of the same user's account")
	_, err = tcs[0].Srv.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
		From:          accountID2,
		To:            accountID1.String(),
		ToIsAccountID: true,
		Amount:        "300",
		Asset:         stellar1.AssetNative(),
	})
	require.NoError(t, err)

	page, err := tcs[0].Srv.GetPaymentsLocal(context.Background(), stellar1.GetPaymentsLocalArg{AccountID: accountID1})
	require.NoError(t, err)
	t.Logf("%v", spew.Sdump(page))
	require.Len(t, page.Payments, 3)

	p := page.Payments[2].Payment
	require.Equal(t, "100 XLM", p.AmountDescription)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, p.FromType)
	require.Equal(t, accountID1, p.FromAccountID)
	require.Equal(t, "office lunch money", p.FromAccountName)
	require.Equal(t, tcs[0].Fu.Username, p.FromUsername)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, p.ToType)
	require.Equal(t, accountID1, *p.ToAccountID)
	require.Equal(t, "office lunch money", p.ToAccountName)
	require.Equal(t, tcs[0].Fu.Username, p.ToUsername)
	require.Equal(t, "", p.ToAssertion)

	p = page.Payments[1].Payment
	require.Equal(t, "200 XLM", p.AmountDescription)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, p.FromType)
	require.Equal(t, accountID1, p.FromAccountID)
	require.Equal(t, "office lunch money", p.FromAccountName)
	require.Equal(t, tcs[0].Fu.Username, p.FromUsername)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, p.ToType)
	require.Equal(t, accountID2, *p.ToAccountID)
	require.Equal(t, "savings", p.ToAccountName)
	require.Equal(t, "", p.ToUsername)
	require.Equal(t, "", p.ToAssertion)

	p = page.Payments[0].Payment
	require.Equal(t, "300 XLM", p.AmountDescription)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, p.FromType)
	require.Equal(t, accountID2, p.FromAccountID)
	require.Equal(t, "savings", p.FromAccountName)
	require.Equal(t, tcs[0].Fu.Username, p.FromUsername)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, p.ToType)
	require.Equal(t, accountID1, *p.ToAccountID)
	require.Equal(t, "office lunch money", p.ToAccountName)
	require.Equal(t, tcs[0].Fu.Username, p.ToUsername) // the sender resolved the username before sending, so it's recorded
	require.Equal(t, "", p.ToAssertion)

	pd, err := tcs[0].Srv.GetPaymentDetailsLocal(context.Background(), stellar1.GetPaymentDetailsLocalArg{
		Id:        page.Payments[2].Payment.Id,
		AccountID: &accountID1,
	})
	require.NoError(t, err)
	require.Equal(t, "100 XLM", pd.AmountDescription)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, pd.FromType)
	require.Equal(t, accountID1, pd.FromAccountID)
	require.Equal(t, "office lunch money", pd.FromAccountName)
	require.Equal(t, tcs[0].Fu.Username, pd.FromUsername)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, pd.ToType)
	require.Equal(t, accountID1, *pd.ToAccountID)
	require.Equal(t, "office lunch money", pd.ToAccountName)
	require.Equal(t, tcs[0].Fu.Username, pd.ToUsername)
	require.Equal(t, "", pd.ToAssertion)

	pd, err = tcs[0].Srv.GetPaymentDetailsLocal(context.Background(), stellar1.GetPaymentDetailsLocalArg{
		Id:        page.Payments[1].Payment.Id,
		AccountID: &accountID1,
	})
	require.NoError(t, err)
	require.Equal(t, "200 XLM", pd.AmountDescription)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, pd.FromType)
	require.Equal(t, accountID1, pd.FromAccountID)
	require.Equal(t, "office lunch money", pd.FromAccountName)
	require.Equal(t, tcs[0].Fu.Username, pd.FromUsername)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, pd.ToType)
	require.Equal(t, accountID2, *pd.ToAccountID)
	require.Equal(t, "savings", pd.ToAccountName)
	require.Equal(t, "", pd.ToUsername)
	require.Equal(t, "", pd.ToAssertion)

	pd, err = tcs[0].Srv.GetPaymentDetailsLocal(context.Background(), stellar1.GetPaymentDetailsLocalArg{
		Id:        page.Payments[0].Payment.Id,
		AccountID: &accountID2,
	})
	require.NoError(t, err)
	require.Equal(t, "300 XLM", pd.AmountDescription)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, pd.FromType)
	require.Equal(t, accountID2, pd.FromAccountID)
	require.Equal(t, "savings", pd.FromAccountName)
	require.Equal(t, tcs[0].Fu.Username, pd.FromUsername)
	require.Equal(t, stellar1.ParticipantType_OWNACCOUNT, pd.ToType)
	require.Equal(t, accountID1, *pd.ToAccountID)
	require.Equal(t, "office lunch money", pd.ToAccountName)
	require.Equal(t, tcs[0].Fu.Username, pd.ToUsername)
	require.Equal(t, "", pd.ToAssertion)
}

func TestPaymentDetailsEmptyAccId(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	backend := tcs[0].Backend
	backend.ImportAccountsForUser(tcs[0])
	backend.ImportAccountsForUser(tcs[1])

	accID := getPrimaryAccountID(tcs[0])
	backend.accounts[accID].AddBalance("1000")

	const secretNote string = "pleasure doing business 🤔"

	_, err := tcs[0].Srv.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
		From:          accID,
		To:            tcs[1].Fu.Username,
		ToIsAccountID: false,
		Amount:        "505.612",
		Asset:         stellar1.AssetNative(),
		WorthAmount:   "160.93",
		WorthCurrency: &usd,
		SecretNote:    secretNote,
		PublicMemo:    "",
	})
	require.NoError(t, err)

	senderMsgs := kbtest.MockSentMessages(tcs[0].G, tcs[0].T)
	require.Len(t, senderMsgs, 1)
	require.Equal(t, senderMsgs[0].MsgType, chat1.MessageType_SENDPAYMENT)

	// Imagine this is the receiver reading chat.
	paymentID := senderMsgs[0].Body.Sendpayment().PaymentID

	detailsRes, err := tcs[0].Srv.GetPaymentDetailsLocal(context.Background(), stellar1.GetPaymentDetailsLocalArg{
		// Chat uses nil AccountID because it does not know it. It
		// derives delta and formatting (whether it's a debit or
		// credit) by checking chat message sender and receiver.
		AccountID: nil,
		Id:        paymentID,
	})
	require.NoError(t, err)
	require.Equal(t, stellar1.BalanceDelta_NONE, detailsRes.Delta)
	require.Equal(t, "505.6120000 XLM", detailsRes.AmountDescription)
	require.Equal(t, "$160.93", detailsRes.Worth)
	require.Equal(t, "USD", detailsRes.WorthCurrency)
	require.Empty(t, detailsRes.CurrentWorth)
	require.Empty(t, detailsRes.CurrentWorthCurrency)
	require.Equal(t, secretNote, detailsRes.Note)
	require.Equal(t, "", detailsRes.NoteErr)
}

func TestBuildRequestLocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	worthInfo := "$1.00 = 3.1414139 XLM\nSource: coinmarketcap.com"

	bres, err := tcs[0].Srv.BuildRequestLocal(context.Background(), stellar1.BuildRequestLocalArg{
		To: tcs[1].Fu.Username,
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToRequest)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "$0.00", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{})

	bres, err = tcs[0].Srv.BuildRequestLocal(context.Background(), stellar1.BuildRequestLocalArg{
		To:     tcs[1].Fu.Username,
		Amount: "-1",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToRequest)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "Invalid amount.", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.WorthDescription)
	require.Equal(t, "", bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{})

	bres, err = tcs[0].Srv.BuildRequestLocal(context.Background(), stellar1.BuildRequestLocalArg{
		To:     tcs[1].Fu.Username,
		Amount: "15",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, true, bres.ReadyToRequest)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "$4.77", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{})

	t.Logf("requesting in amount composed in USD")
	bres, err = tcs[0].Srv.BuildRequestLocal(context.Background(), stellar1.BuildRequestLocalArg{
		To:       tcs[1].Fu.Username,
		Amount:   "8.50",
		Currency: &usd,
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, true, bres.ReadyToRequest)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "26.7020180 XLM", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{})

}

func TestBuildPaymentLocal(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	senderAccountID, err := stellar.GetOwnPrimaryAccountID(context.Background(), tcs[0].G)
	require.NoError(t, err)

	worthInfo := "$1.00 = 3.1414139 XLM\nSource: coinmarketcap.com"

	for _, toIsAccountID := range []bool{false, true} {
		t.Logf("toIsAccountID: %v", toIsAccountID)
		bres, err := tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
			From:          senderAccountID,
			ToIsAccountID: toIsAccountID,
		})
		require.NoError(t, err)
		t.Logf(spew.Sdump(bres))
		require.Equal(t, false, bres.ReadyToSend)
		require.Equal(t, "", bres.ToErrMsg)
		require.Equal(t, "", bres.AmountErrMsg)
		require.Equal(t, "", bres.SecretNoteErrMsg)
		require.Equal(t, "", bres.PublicMemoErrMsg)
		require.Equal(t, "$0.00", bres.WorthDescription)
		require.Equal(t, worthInfo, bres.WorthInfo)
		requireBannerSet(t, bres.DeepCopy().Banners, nil)
	}

	bres, err := tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From: senderAccountID,
		To:   tcs[1].Fu.Username,
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "$0.00", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{{
		Level:   "info",
		Message: fmt.Sprintf("Because it's %v's first transaction, you must send at least 1 XLM.", tcs[1].Fu.Username),
	}})

	recipientAccountID := getPrimaryAccountID(tcs[1])
	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:          senderAccountID,
		To:            recipientAccountID.String(),
		ToIsAccountID: true,
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "$0.00", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{{
		Level:   "info",
		Message: fmt.Sprintf("Because it's %v's first transaction, you must send at least 1 XLM.", tcs[1].Fu.Username),
	}})

	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:   senderAccountID,
		To:     tcs[1].Fu.Username,
		Amount: "-1",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "Invalid amount.", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "", bres.WorthDescription)
	require.Equal(t, "", bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{{
		Level:   "info",
		Message: fmt.Sprintf("Because it's %v's first transaction, you must send at least 1 XLM.", tcs[1].Fu.Username),
	}})

	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:   senderAccountID,
		To:     tcs[1].Fu.Username,
		Amount: "30",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "Your available to send is *0 XLM*.", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "$9.55", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{{
		Level:   "info",
		Message: fmt.Sprintf("Because it's %v's first transaction, you must send at least 1 XLM.", tcs[1].Fu.Username),
	}})

	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	tcs[0].Backend.Gift(senderAccountID, "20")

	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:   senderAccountID,
		To:     tcs[1].Fu.Username,
		Amount: "30",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "Your available to send is *18.9999900 XLM*.", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "$9.55", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{{
		Level:   "info",
		Message: fmt.Sprintf("Because it's %v's first transaction, you must send at least 1 XLM.", tcs[1].Fu.Username),
	}})

	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:          senderAccountID,
		To:            recipientAccountID.String(),
		ToIsAccountID: true,
		Amount:        "0.01",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "You must send at least *1* XLM", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "$0.00", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{{
		Level:   "info",
		Message: fmt.Sprintf("Because it's %v's first transaction, you must send at least 1 XLM.", tcs[1].Fu.Username),
	}})

	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:   senderAccountID,
		To:     tcs[1].Fu.Username,
		Amount: "15",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, true, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "$4.77", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{{
		Level:   "info",
		Message: fmt.Sprintf("Because it's %v's first transaction, you must send at least 1 XLM.", tcs[1].Fu.Username),
	}})

	_, err = tcs[0].Srv.SendPaymentLocal(context.Background(), stellar1.SendPaymentLocalArg{
		From:   senderAccountID,
		To:     tcs[1].Fu.Username,
		Amount: "15",
		Asset:  stellar1.AssetNative(),
	})
	require.NoError(t, err)

	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:       senderAccountID,
		To:         tcs[1].Fu.Username,
		Amount:     "15",
		PublicMemo: "🥔🥔🥔🥔🥔🥔🥔🥔",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "Your available to send is *3.9999800 XLM*.", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "Memo is too long.", bres.PublicMemoErrMsg) // too many potatoes
	require.Equal(t, "$4.77", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{}) // recipient is funded so banner's gone

	// Send an amount so close to available to send that the fee would push it it over the edge.
	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:   senderAccountID,
		To:     tcs[1].Fu.Username,
		Amount: "3.99999900",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "Your available to send is *3.9999800 XLM*.", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "$1.27", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{})

	t.Logf("using FromSeqno")
	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:       senderAccountID,
		FromSeqno:  "12",
		To:         tcs[1].Fu.Username,
		Amount:     "3",
		PublicMemo: "🥔🥔🥔🥔🥔🥔🥔🥔",
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, false, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "Memo is too long.", bres.PublicMemoErrMsg)
	require.Equal(t, "$0.95", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{{
		Level:   "error",
		Message: "Activity on account since initiating send. Take another look at account history.",
	}})

	tcs[0].Backend.Gift(senderAccountID, "30")

	t.Logf("sending in amount composed in USD")
	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:     senderAccountID,
		To:       tcs[1].Fu.Username,
		Amount:   "8.50",
		Currency: &usd,
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, true, bres.ReadyToSend)
	require.Equal(t, senderAccountID, bres.From)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "26.7020180 XLM", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{})

	t.Logf("using `fromDefaultAccount`")
	for _, x := range []string{"blank", "match", "wrong"} {
		var from stellar1.AccountID
		var fromRes stellar1.AccountID
		shouldFail := false
		switch x {
		case "blank":
			fromRes = senderAccountID
		case "match":
			from = senderAccountID
			fromRes = senderAccountID
			shouldFail = true
		case "wrong":
			otherAccountID, _ := randomStellarKeypair()
			from = otherAccountID
			shouldFail = true
		default:
			panic("bad case")
		}
		bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
			From:               from,
			FromPrimaryAccount: true,
			To:                 tcs[1].Fu.Username,
			Amount:             "8.50",
			Currency:           &usd,
		})
		if shouldFail {
			require.Error(t, err)
			require.Equal(t, "invalid build payment parameters", err.Error())
		} else {
			require.NoError(t, err)
			t.Logf(spew.Sdump(bres))
			require.Equal(t, true, bres.ReadyToSend)
			require.Equal(t, fromRes, bres.From, x)
			require.Equal(t, "", bres.ToErrMsg)
			require.Equal(t, "", bres.AmountErrMsg)
			require.Equal(t, "", bres.SecretNoteErrMsg)
			require.Equal(t, "", bres.PublicMemoErrMsg)
			require.Equal(t, "26.7020180 XLM", bres.WorthDescription)
			require.Equal(t, worthInfo, bres.WorthInfo)
			requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{})
		}
	}

	t.Logf("sending to account ID")
	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:          senderAccountID,
		To:            "GBJCIIIWEP2ZIKSNY3AP5GJ5OHNSN6Y4W5K4IVIY4VSQF5QLVE27GADK",
		ToIsAccountID: true,
		Amount:        "8.50",
		Currency:      &usd,
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, true, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, "", bres.ToUsername) // account does not resolve to keybase user
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "26.7020180 XLM", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{{
		Level:   "info",
		Message: "Because it's their first transaction, you must send at least 1 XLM.",
	}})

	t.Logf("sending to account ID that resolves")
	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:          senderAccountID,
		To:            senderAccountID.String(),
		ToIsAccountID: true,
		Amount:        "8.50",
		Currency:      &usd,
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, true, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, tcs[0].Fu.Username, bres.ToUsername) // account resolves to self
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "26.7020180 XLM", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{})

	upak, _, err := tcs[0].G.GetUPAKLoader().LoadV2(
		libkb.NewLoadUserArgWithMetaContext(tcs[0].MetaContext()).WithPublicKeyOptional().
			WithUID(tcs[1].Fu.User.GetUID()).WithForcePoll(true))
	require.NoError(t, err)
	require.NotNil(t, upak.Current.StellarAccountID)

	t.Logf("sending to account ID that resolves")
	bres, err = tcs[0].Srv.BuildPaymentLocal(context.Background(), stellar1.BuildPaymentLocalArg{
		From:          senderAccountID,
		To:            *upak.Current.StellarAccountID,
		ToIsAccountID: true,
		Amount:        "8.50",
		Currency:      &usd,
	})
	require.NoError(t, err)
	t.Logf(spew.Sdump(bres))
	require.Equal(t, true, bres.ReadyToSend)
	require.Equal(t, "", bres.ToErrMsg)
	require.Equal(t, tcs[1].Fu.Username, bres.ToUsername) // account resolves to other
	require.Equal(t, "", bres.AmountErrMsg)
	require.Equal(t, "", bres.SecretNoteErrMsg)
	require.Equal(t, "", bres.PublicMemoErrMsg)
	require.Equal(t, "26.7020180 XLM", bres.WorthDescription)
	require.Equal(t, worthInfo, bres.WorthInfo)
	requireBannerSet(t, bres.DeepCopy().Banners, []stellar1.SendBannerLocal{})
}

// modifies `expected`
func requireBannerSet(t testing.TB, got []stellar1.SendBannerLocal, expected []stellar1.SendBannerLocal) {
	if len(got) != len(expected) {
		t.Logf("%s", spew.Sdump(got))
		require.Len(t, got, len(expected))
	}
	sort.Slice(got, func(i, j int) bool {
		return got[i].Message < got[j].Message
	})
	sort.Slice(expected, func(i, j int) bool {
		return expected[i].Message < expected[j].Message
	})
	for i := range expected {
		require.Equal(t, expected[i], got[i])
	}
}

var usd = stellar1.OutsideCurrencyCode("USD")

func TestGetSendAssetChoices(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	fakeAccts := tcs[0].Backend.ImportAccountsForUser(tcs[0])
	fakeAccts2 := tcs[1].Backend.ImportAccountsForUser(tcs[1])

	// Empty account (not even on the network), expecting to see 0
	// other assets here.
	choices, err := tcs[0].Srv.GetSendAssetChoicesLocal(context.Background(), stellar1.GetSendAssetChoicesLocalArg{
		From: fakeAccts[0].accountID,
	})
	require.NoError(t, err)
	require.Len(t, choices, 0)

	// Same with `To` argument.
	choices, err = tcs[0].Srv.GetSendAssetChoicesLocal(context.Background(), stellar1.GetSendAssetChoicesLocalArg{
		From: fakeAccts[0].accountID,
		To:   tcs[1].Fu.Username,
	})
	require.NoError(t, err)
	require.Len(t, choices, 0)

	// Test assets
	keys := tcs[0].Backend.CreateFakeAsset("KEYS")
	astro := tcs[0].Backend.CreateFakeAsset("AstroDollars")

	// Adjust balance with 0 adds empty balance of given asset (mock
	// "open a trustline").
	fakeAccts[0].AdjustAssetBalance(0, keys)
	fakeAccts[0].AdjustAssetBalance(0, astro)

	// New asset choices should be visible
	choices, err = tcs[0].Srv.GetSendAssetChoicesLocal(context.Background(), stellar1.GetSendAssetChoicesLocalArg{
		From: fakeAccts[0].accountID,
	})
	require.NoError(t, err)
	require.Len(t, choices, 2)
	require.True(t, choices[0].Asset.Eq(keys))
	require.True(t, choices[1].Asset.Eq(astro))
	for _, v := range choices {
		require.Equal(t, v.Asset.Code, v.Left)
		require.Equal(t, v.Asset.Issuer, v.Right)
		require.True(t, v.Enabled)
	}

	// We should see the same choices, but all disabled because the
	// recipient does not accept them.
	choices2, err := tcs[0].Srv.GetSendAssetChoicesLocal(context.Background(), stellar1.GetSendAssetChoicesLocalArg{
		From: fakeAccts[0].accountID,
		To:   tcs[1].Fu.Username,
	})
	require.NoError(t, err)
	require.Len(t, choices2, len(choices))
	for i, v := range choices2 {
		require.True(t, v.Asset.Eq(choices[i].Asset))
		require.Equal(t, v.Asset.Code, v.Left)
		require.Equal(t, v.Asset.Issuer, v.Right)
		require.False(t, v.Enabled)
		require.Contains(t, v.Subtext, tcs[1].Fu.Username)
		require.Contains(t, v.Subtext, "does not accept")
		require.Contains(t, v.Subtext, v.Asset.Code)
	}

	// Open AstroDollars for tcs[1]
	fakeAccts2[0].AdjustAssetBalance(0, astro)

	choices2, err = tcs[0].Srv.GetSendAssetChoicesLocal(context.Background(), stellar1.GetSendAssetChoicesLocalArg{
		From: fakeAccts[0].accountID,
		To:   fakeAccts2[0].accountID.String(), // this time use account ID as `To` argument
	})
	require.NoError(t, err)
	require.Len(t, choices2, len(choices))

	require.True(t, choices2[0].Asset.Eq(keys))
	require.False(t, choices2[0].Enabled)
	// Using AccountID should still resolve to user and we should see
	// "*username* does not accept ..." subtext.
	require.Contains(t, choices2[0].Subtext, tcs[1].Fu.Username)
	require.Contains(t, choices2[0].Subtext, "does not accept")
	require.Contains(t, choices2[0].Subtext, choices2[0].Asset.Code)

	require.True(t, choices2[1].Asset.Eq(astro))
	require.True(t, choices2[1].Enabled)

	// Try with arg.To AccountID not in the system.
	externalAcc := tcs[0].Backend.AddAccount()
	choices3, err := tcs[0].Srv.GetSendAssetChoicesLocal(context.Background(), stellar1.GetSendAssetChoicesLocalArg{
		From: fakeAccts[0].accountID,
		To:   externalAcc.String(),
	})
	require.NoError(t, err)
	require.Len(t, choices3, len(choices))
	for _, v := range choices3 {
		require.False(t, v.Enabled)
		require.Contains(t, v.Subtext, "Recipient does not accept")
	}
}

func TestMakeRequestLocalBasics(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	xlm := stellar1.AssetNative()
	_, err := tcs[0].Srv.MakeRequestLocal(context.Background(), stellar1.MakeRequestLocalArg{
		Recipient: tcs[1].Fu.Username,
		Asset:     &xlm,
	})
	require.Error(t, err)

	_, err = tcs[0].Srv.MakeRequestLocal(context.Background(), stellar1.MakeRequestLocalArg{
		Recipient: tcs[1].Fu.Username,
		Asset:     &xlm,
		Amount:    "0",
	})
	require.Error(t, err)

	_, err = tcs[0].Srv.MakeRequestLocal(context.Background(), stellar1.MakeRequestLocalArg{
		Recipient: tcs[1].Fu.Username,
		Asset:     &xlm,
		Amount:    "-1.2345",
	})
	require.Error(t, err)

	reqID, err := tcs[0].Srv.MakeRequestLocal(context.Background(), stellar1.MakeRequestLocalArg{
		Recipient: tcs[1].Fu.Username,
		Asset:     &xlm,
		Amount:    "1.2345",
	})
	require.NoError(t, err)
	require.NotEmpty(t, reqID)
}

func TestMakeRequestLocalNotifications(t *testing.T) {
	tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	// set up notification listeners
	listenerSender := newChatListener()
	listenerRecip := newChatListener()
	tcs[0].G.NotifyRouter.SetListener(listenerSender)
	tcs[1].G.NotifyRouter.SetListener(listenerRecip)

	xlm := stellar1.AssetNative()
	reqID, err := tcs[0].Srv.MakeRequestLocal(context.Background(), stellar1.MakeRequestLocalArg{
		Recipient: tcs[1].Fu.Username,
		Asset:     &xlm,
		Amount:    "1.2345",
	})
	require.NoError(t, err)
	require.NotEmpty(t, reqID)

	// pretend that the chat message was unboxed and call the request loader to load the info:
	loaderSender := stellar.DefaultLoader(tcs[0].G)
	convID := chat1.ConversationID("efef")
	msgID := chat1.MessageID(654)
	loaderSender.LoadRequest(context.Background(), convID, msgID, tcs[0].Fu.Username, reqID)

	loaderRecip := stellar.NewLoader(tcs[1].G)
	loaderRecip.LoadRequest(context.Background(), convID, msgID, tcs[0].Fu.Username, reqID)

	// check the sender chat notification
	select {
	case info := <-listenerSender.requestInfos:
		require.NotNil(t, info)
		require.Equal(t, tcs[0].Fu.User.GetUID(), info.Uid)
		require.Equal(t, convID, info.ConvID)
		require.Equal(t, msgID, info.MsgID)
		require.Equal(t, "1.2345", info.Info.Amount)
		require.Equal(t, "1.2345 XLM", info.Info.AmountDescription)
		require.NotNil(t, info.Info.Asset)
		require.Equal(t, "native", info.Info.Asset.Type)
		require.Nil(t, info.Info.Currency)
		require.Equal(t, stellar1.RequestStatus_OK, info.Info.Status)
	case <-time.After(20 * time.Second):
		t.Fatal("timed out waiting for chat request info notification to sender")
	}

	// check the recipient chat notification
	select {
	case info := <-listenerRecip.requestInfos:
		require.NotNil(t, info)
		require.Equal(t, tcs[1].Fu.User.GetUID(), info.Uid)
		require.Equal(t, convID, info.ConvID)
		require.Equal(t, msgID, info.MsgID)
		require.Equal(t, "1.2345", info.Info.Amount)
		require.Equal(t, "1.2345 XLM", info.Info.AmountDescription)
		require.NotNil(t, info.Info.Asset)
		require.Equal(t, "native", info.Info.Asset.Type)
		require.Nil(t, info.Info.Currency)
		require.Equal(t, stellar1.RequestStatus_OK, info.Info.Status)
	case <-time.After(20 * time.Second):
		t.Fatal("timed out waiting for chat request info notification to sender")
	}

	// load it again, should not get another notification
	loaderRecip.LoadRequest(context.Background(), convID, msgID, tcs[0].Fu.Username, reqID)
	select {
	case info := <-listenerRecip.requestInfos:
		t.Fatalf("received request notification on second load: %+v", info)
	case <-time.After(100 * time.Millisecond):
	}

}

func TestSetMobileOnly(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	_, err := stellar.CreateWallet(context.Background(), tcs[0].G)
	require.NoError(t, err)
	tcs[0].Backend.ImportAccountsForUser(tcs[0])
	accountID := getPrimaryAccountID(tcs[0])

	mobileOnly, err := tcs[0].Srv.IsAccountMobileOnlyLocal(context.Background(), stellar1.IsAccountMobileOnlyLocalArg{AccountID: accountID})
	require.NoError(t, err)
	require.False(t, mobileOnly)

	err = tcs[0].Srv.SetAccountMobileOnlyLocal(context.Background(), stellar1.SetAccountMobileOnlyLocalArg{AccountID: accountID})
	require.NoError(t, err)

	mobileOnly, err = tcs[0].Srv.IsAccountMobileOnlyLocal(context.Background(), stellar1.IsAccountMobileOnlyLocalArg{AccountID: accountID})
	require.NoError(t, err)
	require.True(t, mobileOnly)

	// XXX note that the real test here will be that the secret bundle does not come
	// back for desktop devices or mobile devices that are less than 7d old.
	// This is just a basic test at this point...
}

type chatListener struct {
	libkb.NoopNotifyListener

	paymentInfos chan chat1.ChatPaymentInfoArg
	requestInfos chan chat1.ChatRequestInfoArg
}

func newChatListener() *chatListener {
	x := &chatListener{
		paymentInfos: make(chan chat1.ChatPaymentInfoArg, 1),
		requestInfos: make(chan chat1.ChatRequestInfoArg, 1),
	}
	return x
}

func (c *chatListener) ChatPaymentInfo(uid keybase1.UID, convID chat1.ConversationID, msgID chat1.MessageID, info chat1.UIPaymentInfo) {
	c.paymentInfos <- chat1.ChatPaymentInfoArg{Uid: uid, ConvID: convID, MsgID: msgID, Info: info}
}

func (c *chatListener) ChatRequestInfo(uid keybase1.UID, convID chat1.ConversationID, msgID chat1.MessageID, info chat1.UIRequestInfo) {
	c.requestInfos <- chat1.ChatRequestInfoArg{Uid: uid, ConvID: convID, MsgID: msgID, Info: info}
}

func firstAccountName(t testing.TB, tc *TestContext) string {
	loggedInUsername := tc.G.ActiveDevice.Username(libkb.NewMetaContextForTest(tc.TestContext))
	require.True(t, loggedInUsername.IsValid())
	return fmt.Sprintf("%v's account", loggedInUsername)
}
