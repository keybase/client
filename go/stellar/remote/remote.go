package remote

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/acctbundle"
	"github.com/keybase/client/go/stellar/bundle"
)

type shouldCreateRes struct {
	libkb.AppStatusEmbed
	ShouldCreateResult
}

type ShouldCreateResult struct {
	ShouldCreate       bool `json:"shouldcreate"`
	HasWallet          bool `json:"haswallet"`
	AcceptedDisclaimer bool `json:"accepteddisclaimer"`
}

// ShouldCreate asks the server whether to create this user's initial wallet.
func ShouldCreate(ctx context.Context, g *libkb.GlobalContext) (res ShouldCreateResult, err error) {
	defer g.CTraceTimed(ctx, "Stellar.ShouldCreate", func() error { return err })()
	defer func() {
		g.Log.CDebugf(ctx, "Stellar.ShouldCreate: (res:%+v, err:%v)", res, err != nil)
	}()
	arg := libkb.NewAPIArgWithNetContext(ctx, "stellar/shouldcreate")
	arg.RetryCount = 3
	arg.SessionType = libkb.APISessionTypeREQUIRED
	var apiRes shouldCreateRes
	err = g.API.GetDecode(arg, &apiRes)
	return apiRes.ShouldCreateResult, err
}

func AcctBundlesEnabled(m libkb.MetaContext) bool {
	enabled := m.G().FeatureFlags.Enabled(m, libkb.FeatureStellarAcctBundles)
	if enabled {
		m.CDebugf("stellar account bundles enabled")
	}
	return enabled
}

func buildV2ChainLinkPayload(m libkb.MetaContext, bundle stellar1.BundleRestricted, me *libkb.User, pukGen keybase1.PerUserKeyGeneration, pukSeed libkb.PerUserKeySeed, deviceSigKey libkb.GenericKey) (*libkb.JSONPayload, error) {
	err := bundle.CheckInvariants()
	if err != nil {
		return nil, err
	}
	if len(bundle.Accounts) < 1 {
		return nil, errors.New("stellar bundle has no accounts")
	}
	// Find the new primary account for the chain link.
	stellarAccount, err := bundle.PrimaryAccount()
	if err != nil {
		return nil, err
	}
	stellarAccountBundle, ok := bundle.AccountBundles[stellarAccount.AccountID]
	if !ok {
		return nil, errors.New("stellar primary account has no account bundle")
	}
	if len(stellarAccountBundle.Signers) < 1 {
		return nil, errors.New("stellar bundle has no signers")
	}
	if !stellarAccount.IsPrimary {
		return nil, errors.New("initial stellar account is not primary")
	}
	m.CDebugf("Stellar.PostWithChainLink: revision:%v accountID:%v pukGen:%v", bundle.Revision, stellarAccount.AccountID, pukGen)

	boxed, err := acctbundle.BoxAndEncode(&bundle, pukGen, pukSeed)
	if err != nil {
		return nil, err
	}

	m.CDebugf("Stellar.PostWithChainLink: make sigs")

	sig, err := libkb.StellarProofReverseSigned(m, me, stellarAccount.AccountID, stellarAccountBundle.Signers[0], deviceSigKey)
	if err != nil {
		return nil, err
	}

	var sigsList []libkb.JSONPayload
	sigsList = append(sigsList, sig)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList
	section := make(libkb.JSONPayload)
	section["encrypted_parent"] = boxed.EncParentB64
	section["visible_parent"] = boxed.VisParentB64
	section["version_parent"] = boxed.FormatVersionParent
	section["account_bundles"] = boxed.AcctBundles
	payload["stellar"] = section

	return &payload, nil
}

func buildV1ChainLinkPayload(m libkb.MetaContext, bundleRestricted stellar1.BundleRestricted, me *libkb.User, pukGen keybase1.PerUserKeyGeneration, pukSeed libkb.PerUserKeySeed, deviceSigKey libkb.GenericKey) (*libkb.JSONPayload, error) {
	v1Bundle, err := acctbundle.BundleFromBundleRestricted(bundleRestricted)
	if err != nil {
		return nil, err
	}

	err = v1Bundle.CheckInvariants()
	if err != nil {
		return nil, err
	}
	// Find the new primary account for the chain link.
	if len(v1Bundle.Accounts) < 1 {
		return nil, errors.New("stellar bundle has no accounts")
	}
	stellarAccount, err := v1Bundle.PrimaryAccount()
	if err != nil {
		return nil, err
	}
	if len(stellarAccount.Signers) < 1 {
		return nil, errors.New("stellar bundle has no signers")
	}
	if !stellarAccount.IsPrimary {
		return nil, errors.New("initial stellar account is not primary")
	}
	m.CDebugf("Stellar.PostWithChainLink: revision:%v accountID:%v pukGen:%v", v1Bundle.Revision, stellarAccount.AccountID, pukGen)
	boxed, err := bundle.Box(*v1Bundle, pukGen, pukSeed)
	if err != nil {
		return nil, err
	}

	m.CDebugf("Stellar.PostWithChainLink: make sigs")

	sig, err := libkb.StellarProofReverseSigned(m, me, stellarAccount.AccountID, stellarAccount.Signers[0], deviceSigKey)
	if err != nil {
		return nil, err
	}

	var sigsList []libkb.JSONPayload
	sigsList = append(sigsList, sig)

	payload := make(libkb.JSONPayload)
	payload["sigs"] = sigsList
	section := make(libkb.JSONPayload)
	section["encrypted"] = boxed.EncB64
	section["visible"] = boxed.VisB64
	section["version"] = int(boxed.FormatVersion)
	section["miniversion"] = 2
	payload["stellar"] = section

	return &payload, nil
}

// Post a bundle to the server with a chainlink.
func PostWithChainlink(ctx context.Context, g *libkb.GlobalContext, clearBundle stellar1.BundleRestricted, v2Link bool) (err error) {
	defer g.CTraceTimed(ctx, "Stellar.PostWithChainlink", func() error { return err })()

	m := libkb.NewMetaContext(ctx, g)
	uid := m.G().ActiveDevice.UID()
	if uid.IsNil() {
		return libkb.NoUIDError{}
	}
	m.CDebugf("Stellar.PostWithChainLink: load self")
	loadMeArg := libkb.NewLoadUserArg(g).
		WithNetContext(ctx).
		WithUID(uid).
		WithSelf(true).
		WithPublicKeyOptional()
	me, err := libkb.LoadUser(loadMeArg)
	if err != nil {
		return err
	}

	deviceSigKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return fmt.Errorf("signing key not found: (%v)", err)
	}
	pukGen, pukSeed, err := getLatestPuk(ctx, g)
	if err != nil {
		return err
	}

	var payload *libkb.JSONPayload
	if v2Link {
		payload, err = buildV2ChainLinkPayload(m, clearBundle, me, pukGen, pukSeed, deviceSigKey)
		if err != nil {
			return err
		}
	} else {
		payload, err = buildV1ChainLinkPayload(m, clearBundle, me, pukGen, pukSeed, deviceSigKey)
		if err != nil {
			return err
		}
	}

	m.CDebugf("Stellar.PostWithChainLink: post")
	_, err = m.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: *payload,
		MetaContext: m,
	})
	if err != nil {
		return err
	}

	m.G().UserChanged(uid)
	return nil
}

func PostV1Bundle(ctx context.Context, g *libkb.GlobalContext, v1Bundle stellar1.Bundle) (err error) {
	pukGen, pukSeed, err := getLatestPuk(ctx, g)
	if err != nil {
		return err
	}
	err = v1Bundle.CheckInvariants()
	if err != nil {
		return err
	}
	g.Log.CDebugf(ctx, "Stellar.Post: revision:%v", v1Bundle.Revision)
	boxed, err := bundle.Box(v1Bundle, pukGen, pukSeed)
	if err != nil {
		return err
	}
	payload := make(libkb.JSONPayload)
	section := make(libkb.JSONPayload)
	section["encrypted"] = boxed.EncB64
	section["visible"] = boxed.VisB64
	section["version"] = int(boxed.FormatVersion)
	section["miniversion"] = 2
	payload["stellar"] = section

	g.Log.CDebugf(ctx, "Stellar.Post: post")
	_, err = g.API.PostJSON(libkb.APIArg{
		Endpoint:    "stellar/bundle",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	return err
}

// Post a bundle to the server.
func Post(ctx context.Context, g *libkb.GlobalContext, clearBundle stellar1.BundleRestricted, version stellar1.BundleVersion) (err error) {
	defer g.CTraceTimed(ctx, "Stellar.Post", func() error { return err })()
	if version == stellar1.BundleVersion_V1 {
		v1Bundle, err := acctbundle.BundleFromBundleRestricted(clearBundle)
		if err != nil {
			return err
		}
		return PostV1Bundle(ctx, g, *v1Bundle)
	}
	return postV2Bundle(ctx, g, &clearBundle)
}

type AlreadyMigratedError struct{}

func (e AlreadyMigratedError) Error() string {
	return fmt.Sprintf("this bundle is already accessible from v2 endpoints")
}

func alreadyMigratedError(inputError error) bool {
	if inputError == nil {
		return false
	}
	_, alreadyMigrated := inputError.(AlreadyMigratedError)
	return alreadyMigrated
}

type MissingFeatureFlagMigrationError struct{}

func (e MissingFeatureFlagMigrationError) Error() string {
	return fmt.Sprintf("need FeatureStellarAcctBundles to migrate")
}

func preMigrationChecks(m libkb.MetaContext) error {
	// verify that the feature flag is enabled
	if !AcctBundlesEnabled(m) {
		return MissingFeatureFlagMigrationError{}
	}

	// verify that fetching a v2 bundle raises an incompatibility error
	// because there is a bundle to fetch but it has not been migrated
	// this is what we're expecting for an account that has not yet
	// been migrated
	existingBundle, _, _, err := FetchV2BundleForAccount(m.Ctx(), m.G(), nil)
	expectedErrorStatus := keybase1.StatusCode_SCStellarIncompatibleVersion
	if err == nil {
		return AlreadyMigratedError{}
	}
	if appStatusError, ok := err.(libkb.AppStatusError); ok {
		actualErrorStatus := keybase1.StatusCode(appStatusError.Code)
		if actualErrorStatus != expectedErrorStatus {
			return err
		}
	} else {
		return err
	}
	if existingBundle != nil {
		// this should never happen
		return errors.New("non null v2 bundle accessible before migrating")
	}
	return nil
}

func postMigrationChecks(m libkb.MetaContext, preMigrationBundle stellar1.Bundle) (err error) {
	defer m.CTrace(fmt.Sprintf("Stellar postMigrationChecks"), func() error { return err })()

	// verify that the post-migration account bundle matches the
	// pre-migration bundle for each account
	for _, preMigrationAcct := range preMigrationBundle.Accounts {
		acctBundle, _, _, err := FetchAccountBundle(m.Ctx(), m.G(), preMigrationAcct.AccountID)
		if err != nil {
			return err
		}
		var postMigrationAcct stellar1.BundleEntryRestricted
		for _, acct := range acctBundle.Accounts {
			if acct.AccountID == preMigrationAcct.AccountID {
				postMigrationAcct = acct
			}
		}
		if postMigrationAcct.AccountID != preMigrationAcct.AccountID {
			err = fmt.Errorf("account_id mismatch. pre (%v) isnt post (%v)", preMigrationAcct.AccountID, postMigrationAcct.AccountID)
			m.CErrorf("post migration check:", err)
			return err
		}
		if postMigrationAcct.Mode != preMigrationAcct.Mode {
			err = fmt.Errorf("mode mismatch for %v. pre (%v) isnt post (%v)", preMigrationAcct.AccountID, preMigrationAcct.Mode, postMigrationAcct.Mode)
			m.CErrorf("post migration check:", err)
			return err
		}
		if postMigrationAcct.Name != preMigrationAcct.Name {
			err = fmt.Errorf("name mismatch for %v. pre (%v) isnt post (%v)", preMigrationAcct.AccountID, preMigrationAcct.Name, postMigrationAcct.Name)
			m.CErrorf("post migration check:", err)
			return err
		}
		postMigrationSigners := acctBundle.AccountBundles[postMigrationAcct.AccountID].Signers
		if len(postMigrationSigners) != len(preMigrationAcct.Signers) {
			err = fmt.Errorf("signers mismatch for %v", preMigrationAcct.AccountID)
			m.CErrorf("post migration check:", err)
			return err
		}
		for i, s := range postMigrationSigners {
			if preMigrationAcct.Signers[i] != s {
				err = fmt.Errorf("signers mismatch for %v", preMigrationAcct.AccountID)
				m.CErrorf("post migration check:", err)
				return err
			}
		}
	}

	// verify that fetching a v1 bundle raises an incompatibility error
	_, _, _, err = FetchV1Bundle(m.Ctx(), m.G())
	expectedErrorStatus := keybase1.StatusCode_SCStellarIncompatibleVersion
	if err == nil {
		err = fmt.Errorf("expected v1 endpoints to be inaccessible")
		m.CErrorf("post migration check:", err)
		return err
	}
	if appStatusError, ok := err.(libkb.AppStatusError); ok {
		actualErrorStatus := keybase1.StatusCode(appStatusError.Code)
		if actualErrorStatus != expectedErrorStatus {
			m.CErrorf("post migration check fetching the v1 bundle:", err)
			return err
		}
	} else {
		m.CErrorf("post migration check fetching the v1 bundle:", err)
		return err
	}
	return nil
}

// MigrateBundleToAccountBundles migrates the existing stellar bundle that
// contains all secrets to separate account bundles for each account.
func MigrateBundleToAccountBundles(m libkb.MetaContext) (err error) {
	defer m.CTrace(fmt.Sprintf("Stellar MigrateBundleToAccountBundles"), func() error { return err })()

	defer m.G().GetStellar().GetMigrationLock().Unlock()
	m.G().GetStellar().GetMigrationLock().Lock()
	m.CDebugf("| Acquired Stellar Bundle Migration mutex")

	if err = preMigrationChecks(m); err != nil {
		m.CErrorf("MIGRATION FAILED: failed premigration checks: %v\n", err)
		return err
	}
	// fetch the v1 bundle
	v1Bundle, _, _, err := FetchV1Bundle(m.Ctx(), m.G())
	if err != nil {
		m.CErrorf("MIGRATION FAILED: failed to fetch v1Bundle", err)
		return err
	}
	m.CDebugf("fetched v1 bundle with %v accounts", len(v1Bundle.Accounts))

	err = v1Bundle.CheckInvariants()
	if err != nil {
		m.CErrorf("MIGRATION FAILED: v1Bundle failed invariant checks", err)
		return err
	}
	m.CDebugf("v1 bundle passed basic invariant check")

	// convert it to a v2 bundle
	// since this is an initial conversion, all of the accounts
	// in this bundle should have signers
	v2BundlePrev, err := acctbundle.NewFromBundle(v1Bundle)
	if err != nil {
		return err
	}
	m.CDebugf("v1 bundle mutated into v2 bundle with %v accounts", len(v2BundlePrev.Accounts))
	err = v2BundlePrev.CheckInvariants()
	if err != nil {
		m.CErrorf("MIGRATION FAILED: v2BundlePrev failed invariant checks", err)
		return err
	}
	m.CDebugf("v2 bundle passed basic invariant check")

	// verify that all of the signers are part of this migratable bundle
	for _, acct := range v2BundlePrev.Accounts {
		accBundle, ok := v2BundlePrev.AccountBundles[acct.AccountID]
		if !ok {
			err = fmt.Errorf("in local conversion to a v2 bundle, account %v not found in account bundle map", acct.AccountID)
			m.CErrorf("MIGRATION FAILED: %v\n", err)
			return err
		}
		secretKey := accBundle.Signers[0]
		if len(secretKey) == 0 {
			err = fmt.Errorf("in local conversion to a v2 bundle, account %v missing signers", acct.AccountID)
			m.CErrorf("MIGRATION FAILED: %v\n", err)
			return err
		}
	}
	m.CDebugf("v2 bundle passed other checks")

	v2Bundle := acctbundle.AdvanceBundle(*v2BundlePrev)
	err = v2Bundle.CheckInvariants()
	if err != nil {
		m.CErrorf("MIGRATION FAILED: v2Bundle failed invariant checks", err)
		return err
	}
	m.CInfof("Passed all premigration checks. Posting the migrated bundle...")

	err = postV2Bundle(m.Ctx(), m.G(), &v2Bundle)
	if err != nil {
		m.CErrorf("MIGRATION FAILED: posting v2 bundle %v\n", err)
		return err
	}
	m.CInfof("v2 bundle has been posted and the migration might not be retryable")

	// check if all the account bundles match the bundle entries
	if err := postMigrationChecks(m, v1Bundle); err != nil {
		m.CErrorf("MIGRATION FAILED: %v\n", err)
		return err
	}
	m.CInfof("Passed all post-migration checks")

	return nil
}

// postV2Bundle encrypts and uploads a restricted bundle to the server.
func postV2Bundle(ctx context.Context, g *libkb.GlobalContext, bundle *stellar1.BundleRestricted) (err error) {
	defer g.CTraceTimed(ctx, "Stellar.postV2Bundle", func() error { return err })()

	pukGen, pukSeed, err := getLatestPuk(ctx, g)
	if err != nil {
		return err
	}

	boxed, err := acctbundle.BoxAndEncode(bundle, pukGen, pukSeed)
	if err != nil {
		return err
	}

	payload := make(libkb.JSONPayload)
	section := make(libkb.JSONPayload)
	section["encrypted_parent"] = boxed.EncParentB64
	section["visible_parent"] = boxed.VisParentB64
	section["version_parent"] = boxed.FormatVersionParent
	section["account_bundles"] = boxed.AcctBundles
	payload["stellar"] = section
	_, err = g.API.PostJSON(libkb.APIArg{
		Endpoint:    "stellar/acctbundle",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	return err
}

func FetchV2BundleForAccount(ctx context.Context, g *libkb.GlobalContext, accountID *stellar1.AccountID) (acctBundle *stellar1.BundleRestricted, version stellar1.BundleVersion, pukGen keybase1.PerUserKeyGeneration, err error) {
	defer g.CTraceTimed(ctx, "Stellar.FetchV2BundleForAccount", func() error { return err })()

	fetchArgs := libkb.HTTPArgs{}
	if accountID != nil {
		fetchArgs = libkb.HTTPArgs{"account_id": libkb.S{Val: string(*accountID)}}
	}
	apiArg := libkb.APIArg{
		Endpoint:       "stellar/acctbundle",
		SessionType:    libkb.APISessionTypeREQUIRED,
		Args:           fetchArgs,
		NetContext:     ctx,
		RetryCount:     3,
		InitialTimeout: 10 * time.Second,
	}
	var apiRes fetchAcctRes
	if err = g.API.GetDecode(apiArg, &apiRes); err != nil {
		return nil, 0, 0, err
	}
	m := libkb.NewMetaContext(ctx, g)
	finder := &pukFinder{}
	return acctbundle.DecodeAndUnbox(m, finder, apiRes.BundleEncoded)
}

func incompatibleVersionError(inputError error) bool {
	if inputError == nil {
		return false
	}
	aerr, isAppError := inputError.(libkb.AppStatusError)
	if !isAppError {
		return false
	}
	return keybase1.StatusCode(aerr.Code) == keybase1.StatusCode_SCStellarIncompatibleVersion
}

// FetchSecretlessBundle gets an account bundle from the server and decrypts it
// but without any specified AccountID and therefore no secrets (signers).
// This method is safe to call by any of a user's devices even if one or more of
// the accounts is marked as being mobile only. If the FeatureStellarAcctBundles
// is true and the user is still on a v1 bundle, this method will call
// `MigrateBundleToAccountBundles` and then fetch again.
func FetchSecretlessBundle(mctx libkb.MetaContext) (acctBundle *stellar1.BundleRestricted, version stellar1.BundleVersion, pukGen keybase1.PerUserKeyGeneration, err error) {
	defer mctx.CTraceTimed("Stellar.FetchSecretlessBundle", func() error { return err })()

	acctBundle, version, pukGen, err = FetchV2BundleForAccount(mctx.Ctx(), mctx.G(), nil)
	if err != nil && incompatibleVersionError(err) {
		mctx.CDebugf("requested v2 secretless bundle but not migrated yet.")
		hasFeatureFlagForMigration := AcctBundlesEnabled(mctx)
		if hasFeatureFlagForMigration {
			mctx.CDebugf("has feature flag. kicking off migration now.")
			err := MigrateBundleToAccountBundles(mctx)
			if err != nil && !alreadyMigratedError(err) {
				mctx.CDebugf("migration failed. suggest turning off the feature flag and investigating.")
				return nil, 0, 0, err
			}
			return FetchV2BundleForAccount(mctx.Ctx(), mctx.G(), nil)
		}

		acctBundle, version, pukGen, err = fetchV1BundleAsV2Bundle(mctx.Ctx(), mctx.G())
		if err != nil {
			return nil, 0, 0, err
		}
		// strip the signers out of the bundle
		newAccountBundles := make(map[stellar1.AccountID]stellar1.AccountBundle)
		for accountID, ab := range acctBundle.AccountBundles {
			newAb := ab.DeepCopy()
			newAb.Signers = nil
			newAccountBundles[accountID] = newAb
		}
		acctBundle.AccountBundles = newAccountBundles
	}
	return acctBundle, version, pukGen, err
}

// FetchWholeBundle gets the secretless bundle and loops through the accountIDs
// to get the signers for each of them and build a single, full bundle with all
// of the information. This will error from any device that does not have access
// to all of the accounts (e.g. a desktop after mobile-only)
func FetchWholeBundle(ctx context.Context, g *libkb.GlobalContext) (acctBundle *stellar1.BundleRestricted, version stellar1.BundleVersion, pukGen keybase1.PerUserKeyGeneration, err error) {
	defer g.CTraceTimed(ctx, "Stellar.FetchWholeBundle", func() error { return err })()

	mctx := libkb.NewMetaContext(ctx, g)
	bundle, version, pukGen, err := FetchSecretlessBundle(mctx)
	if err != nil {
		return nil, 0, 0, err
	}
	newAccBundles := make(map[stellar1.AccountID]stellar1.AccountBundle)
	for _, acct := range bundle.Accounts {
		singleBundle, _, _, err := FetchAccountBundle(ctx, g, acct.AccountID)
		if err != nil {
			return nil, 0, 0, err
		}
		accBundle := singleBundle.AccountBundles[acct.AccountID]
		newAccBundles[acct.AccountID] = accBundle
	}
	bundle.AccountBundles = newAccBundles
	return bundle, version, pukGen, nil
}

// FetchAccountBundle gets an account bundle from the server and decrypts it.
// this method will bubble up an error if it's called by a Desktop device for
// an account that is mobile only. If you don't need the secrets, use
// FetchSecretlessBundle instead.
func FetchAccountBundle(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (acctBundle *stellar1.BundleRestricted, version stellar1.BundleVersion, pukGen keybase1.PerUserKeyGeneration, err error) {
	defer g.CTraceTimed(ctx, "Stellar.FetchAccountBundle", func() error { return err })()

	acctBundle, version, pukGen, err = FetchV2BundleForAccount(ctx, g, &accountID)
	if err != nil && incompatibleVersionError(err) {
		g.Log.CDebugf(ctx, "requested v2 account bundle but not migrated yet. replacing with v1.")
		acctBundle, version, pukGen, err = fetchV1BundleAsV2Bundle(ctx, g)
		if err != nil {
			return nil, 0, 0, err
		}
	}
	return acctBundle, version, pukGen, err
}

func getLatestPuk(ctx context.Context, g *libkb.GlobalContext) (pukGen keybase1.PerUserKeyGeneration, pukSeed libkb.PerUserKeySeed, err error) {
	pukring, err := g.GetPerUserKeyring(ctx)
	if err != nil {
		return pukGen, pukSeed, err
	}
	m := libkb.NewMetaContext(ctx, g)
	err = pukring.Sync(m)
	if err != nil {
		return pukGen, pukSeed, err
	}
	pukGen = pukring.CurrentGeneration()
	pukSeed, err = pukring.GetSeedByGeneration(m, pukGen)
	return pukGen, pukSeed, err
}

type UserHasNoAccountsError struct{}

func (e UserHasNoAccountsError) Error() string {
	return "logged-in user has no wallet accounts"
}

type fetchRes struct {
	libkb.AppStatusEmbed
	EncryptedB64 string `json:"encrypted"`
	VisibleB64   string `json:"visible"`
}

type fetchAcctRes struct {
	libkb.AppStatusEmbed
	acctbundle.BundleEncoded
}

func FetchV1Bundle(ctx context.Context, g *libkb.GlobalContext) (res stellar1.Bundle, version stellar1.BundleVersion, pukGen keybase1.PerUserKeyGeneration, err error) {
	arg := libkb.NewAPIArgWithNetContext(ctx, "stellar/bundle")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	var apiRes fetchRes
	if g.API == nil {
		return res, 0, 0, errors.New("global API not configured yet")
	}
	err = g.API.GetDecode(arg, &apiRes)
	switch err := err.(type) {
	case nil:
	case libkb.AppStatusError:
		switch keybase1.StatusCode(err.Code) {
		case keybase1.StatusCode_SCNotFound:
			g.Log.CDebugf(ctx, "replacing error: %v", err)
			return res, 0, 0, UserHasNoAccountsError{}
		default:
			return res, 0, 0, err
		}
	default:
		return res, 0, 0, err
	}
	decodeRes, err := bundle.Decode(apiRes.EncryptedB64)
	if err != nil {
		return res, 0, 0, err
	}
	pukring, err := g.GetPerUserKeyring(ctx)
	if err != nil {
		return res, 0, 0, err
	}
	m := libkb.NewMetaContext(ctx, g)
	puk, err := pukring.GetSeedByGenerationOrSync(m, decodeRes.Enc.Gen)
	if err != nil {
		return res, 0, 0, err
	}
	v1Bundle, version, err := bundle.Unbox(g, decodeRes, apiRes.VisibleB64, puk)
	if err != nil {
		return res, 0, 0, err
	}
	return v1Bundle, version, decodeRes.Enc.Gen, err
}

func fetchV1BundleAsV2Bundle(ctx context.Context, g *libkb.GlobalContext) (res *stellar1.BundleRestricted, version stellar1.BundleVersion, pukGen keybase1.PerUserKeyGeneration, err error) {
	v1Bundle, version, pukGen, err := FetchV1Bundle(ctx, g)
	if err != nil {
		return res, 0, 0, err
	}
	accountBundle, err := acctbundle.NewFromBundle(v1Bundle)
	if err != nil {
		return res, 0, 0, err
	}
	return accountBundle, version, pukGen, nil
}

type seqnoResult struct {
	libkb.AppStatusEmbed
	AccountSeqno string `json:"seqno"`
}

func AccountSeqno(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (uint64, error) {
	apiArg := libkb.APIArg{
		Endpoint:        "stellar/accountseqno",
		SessionType:     libkb.APISessionTypeREQUIRED,
		Args:            libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		NetContext:      ctx,
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	var res seqnoResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
		return 0, err
	}

	seqno, err := strconv.ParseUint(res.AccountSeqno, 10, 64)
	if err != nil {
		return 0, err
	}

	return seqno, nil
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
		Endpoint:        "stellar/balances",
		SessionType:     libkb.APISessionTypeREQUIRED,
		Args:            libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		NetContext:      ctx,
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	var res balancesResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
		return nil, err
	}

	return res.Balances, nil
}

type detailsResult struct {
	Status  libkb.AppStatus         `json:"status"`
	Details stellar1.AccountDetails `json:"details"`
}

func (b *detailsResult) GetAppStatus() *libkb.AppStatus {
	return &b.Status
}

func Details(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (stellar1.AccountDetails, error) {
	apiArg := libkb.APIArg{
		Endpoint:        "stellar/details",
		SessionType:     libkb.APISessionTypeREQUIRED,
		Args:            libkb.HTTPArgs{"account_id": libkb.S{Val: string(accountID)}},
		NetContext:      ctx,
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	var res detailsResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
		return stellar1.AccountDetails{}, err
	}
	res.Details.SetDefaultDisplayCurrency()

	return res.Details, nil
}

type submitResult struct {
	libkb.AppStatusEmbed
	PaymentResult stellar1.PaymentResult `json:"payment_result"`
}

func SubmitPayment(ctx context.Context, g *libkb.GlobalContext, post stellar1.PaymentDirectPost) (stellar1.PaymentResult, error) {
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

func SubmitRelayPayment(ctx context.Context, g *libkb.GlobalContext, post stellar1.PaymentRelayPost) (stellar1.PaymentResult, error) {
	payload := make(libkb.JSONPayload)
	payload["payment"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitrelaypayment",
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

type submitClaimResult struct {
	libkb.AppStatusEmbed
	RelayClaimResult stellar1.RelayClaimResult `json:"claim_result"`
}

func SubmitRelayClaim(ctx context.Context, g *libkb.GlobalContext, post stellar1.RelayClaimPost) (stellar1.RelayClaimResult, error) {
	payload := make(libkb.JSONPayload)
	payload["claim"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitrelayclaim",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
		NetContext:  ctx,
	}
	var res submitClaimResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
		return stellar1.RelayClaimResult{}, err
	}
	return res.RelayClaimResult, nil
}

type acquireAutoClaimLockResult struct {
	libkb.AppStatusEmbed
	Result string `json:"result"`
}

func AcquireAutoClaimLock(ctx context.Context, g *libkb.GlobalContext) (string, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/acquireautoclaimlock",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
	}
	var res acquireAutoClaimLockResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
		return "", err
	}
	return res.Result, nil
}

func ReleaseAutoClaimLock(ctx context.Context, g *libkb.GlobalContext, token string) error {
	payload := make(libkb.JSONPayload)
	payload["token"] = token
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/releaseautoclaimlock",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
		NetContext:  ctx,
	}
	var res libkb.AppStatusEmbed
	return g.API.PostDecode(apiArg, &res)
}

type nextAutoClaimResult struct {
	libkb.AppStatusEmbed
	Result *stellar1.AutoClaim `json:"result"`
}

func NextAutoClaim(ctx context.Context, g *libkb.GlobalContext) (*stellar1.AutoClaim, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/nextautoclaim",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
	}
	var res nextAutoClaimResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
		return nil, err
	}
	return res.Result, nil
}

type recentPaymentsResult struct {
	libkb.AppStatusEmbed
	Result stellar1.PaymentsPage `json:"res"`
}

func RecentPayments(ctx context.Context, g *libkb.GlobalContext,
	accountID stellar1.AccountID, cursor *stellar1.PageCursor, limit int, skipPending bool) (stellar1.PaymentsPage, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/recentpayments",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id":   libkb.S{Val: accountID.String()},
			"limit":        libkb.I{Val: limit},
			"skip_pending": libkb.B{Val: skipPending},
		},
		NetContext:      ctx,
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	if cursor != nil {
		apiArg.Args["horizon_cursor"] = libkb.S{Val: cursor.HorizonCursor}
		apiArg.Args["direct_cursor"] = libkb.S{Val: cursor.DirectCursor}
		apiArg.Args["relay_cursor"] = libkb.S{Val: cursor.RelayCursor}
	}

	var apiRes recentPaymentsResult
	err := g.API.GetDecode(apiArg, &apiRes)
	return apiRes.Result, err
}

type pendingPaymentsResult struct {
	libkb.AppStatusEmbed
	Result []stellar1.PaymentSummary `json:"res"`
}

func PendingPayments(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID, limit int) ([]stellar1.PaymentSummary, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/pendingpayments",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: accountID.String()},
			"limit":      libkb.I{Val: limit},
		},
		NetContext:      ctx,
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}

	var apiRes pendingPaymentsResult
	err := g.API.GetDecode(apiArg, &apiRes)
	return apiRes.Result, err
}

type paymentDetailResult struct {
	libkb.AppStatusEmbed
	Result stellar1.PaymentDetails `json:"res"`
}

func PaymentDetails(ctx context.Context, g *libkb.GlobalContext, txID string) (res stellar1.PaymentDetails, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/paymentdetail",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"txID": libkb.S{Val: txID},
		},
		NetContext:      ctx,
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}
	var apiRes paymentDetailResult
	err = g.API.GetDecode(apiArg, &apiRes)
	return apiRes.Result, err
}

type tickerResult struct {
	libkb.AppStatusEmbed
	Price      string        `json:"price"`
	PriceInBTC string        `json:"xlm_btc"`
	CachedAt   keybase1.Time `json:"cached_at"`
	URL        string        `json:"url"`
	Currency   string        `json:"currency"`
}

func ExchangeRate(ctx context.Context, g *libkb.GlobalContext, currency string) (stellar1.OutsideExchangeRate, error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/ticker",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"currency": libkb.S{Val: currency},
		},
		NetContext:      ctx,
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}
	var apiRes tickerResult
	if err := g.API.GetDecode(apiArg, &apiRes); err != nil {
		return stellar1.OutsideExchangeRate{}, err
	}
	return stellar1.OutsideExchangeRate{
		Currency: stellar1.OutsideCurrencyCode(apiRes.Currency),
		Rate:     apiRes.Price,
	}, nil
}

type accountCurrencyResult struct {
	libkb.AppStatusEmbed
	CurrencyDisplayPreference string `json:"currency_display_preference"`
}

func GetAccountDisplayCurrency(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (string, error) {
	// NOTE: If you are calling this, you might want to call
	// stellar.GetAccountDisplayCurrency instead which checks for
	// NULLs and returns a sane default ("USD").
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/accountcurrency",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: string(accountID)},
		},
		NetContext:     ctx,
		RetryCount:     3,
		InitialTimeout: 10 * time.Second,
	}
	var apiRes accountCurrencyResult
	err := g.API.GetDecode(apiArg, &apiRes)
	return apiRes.CurrencyDisplayPreference, err
}

func SetAccountDefaultCurrency(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID,
	currency string) error {

	conf, err := g.GetStellar().GetServerDefinitions(ctx)
	if err != nil {
		return err
	}
	if _, ok := conf.Currencies[stellar1.OutsideCurrencyCode(currency)]; !ok {
		return fmt.Errorf("Unknown currency code: %q", currency)
	}
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/accountcurrency",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: string(accountID)},
			"currency":   libkb.S{Val: currency},
		},
		NetContext: ctx,
	}
	_, err = g.API.Post(apiArg)
	return err
}

type disclaimerResult struct {
	libkb.AppStatusEmbed
	AcceptedDisclaimer bool `json:"accepted_disclaimer"`
}

func GetAcceptedDisclaimer(ctx context.Context, g *libkb.GlobalContext) (ret bool, err error) {
	apiArg := libkb.APIArg{
		Endpoint:       "stellar/disclaimer",
		SessionType:    libkb.APISessionTypeREQUIRED,
		NetContext:     ctx,
		RetryCount:     3,
		InitialTimeout: 10 * time.Second,
	}
	var apiRes disclaimerResult
	err = g.API.GetDecode(apiArg, &apiRes)
	if err != nil {
		return ret, err
	}
	return apiRes.AcceptedDisclaimer, nil
}

func SetAcceptedDisclaimer(ctx context.Context, g *libkb.GlobalContext) error {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/disclaimer",
		SessionType: libkb.APISessionTypeREQUIRED,
		NetContext:  ctx,
	}
	_, err := g.API.Post(apiArg)
	return err
}

type submitRequestResult struct {
	libkb.AppStatusEmbed
	RequestID stellar1.KeybaseRequestID `json:"request_id"`
}

func SubmitRequest(ctx context.Context, g *libkb.GlobalContext, post stellar1.RequestPost) (ret stellar1.KeybaseRequestID, err error) {
	payload := make(libkb.JSONPayload)
	payload["request"] = post
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/submitrequest",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
		NetContext:  ctx,
	}
	var res submitRequestResult
	if err := g.API.PostDecode(apiArg, &res); err != nil {
		return ret, err
	}
	return res.RequestID, nil
}

type requestDetailsResult struct {
	libkb.AppStatusEmbed
	Request stellar1.RequestDetails `json:"request"`
}

func RequestDetails(ctx context.Context, g *libkb.GlobalContext, requestID stellar1.KeybaseRequestID) (ret stellar1.RequestDetails, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/requestdetails",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"id": libkb.S{Val: requestID.String()},
		},
		NetContext:      ctx,
		RetryCount:      3,
		RetryMultiplier: 1.5,
		InitialTimeout:  10 * time.Second,
	}
	var res requestDetailsResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
		return ret, err
	}
	return res.Request, nil
}

func CancelRequest(ctx context.Context, g *libkb.GlobalContext, requestID stellar1.KeybaseRequestID) (err error) {
	payload := make(libkb.JSONPayload)
	payload["id"] = requestID
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/cancelrequest",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
		NetContext:  ctx,
	}
	var res libkb.AppStatusEmbed
	return g.API.PostDecode(apiArg, &res)
}

func MarkAsRead(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID, mostRecentID stellar1.TransactionID) error {
	payload := make(libkb.JSONPayload)
	payload["account_id"] = accountID
	payload["most_recent_id"] = mostRecentID
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/markasread",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
		NetContext:  ctx,
	}
	var res libkb.AppStatusEmbed
	return g.API.PostDecode(apiArg, &res)
}

func IsAccountMobileOnly(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (bool, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	bundle, _, _, err := FetchSecretlessBundle(mctx)
	if err != nil {
		return false, err
	}
	for _, account := range bundle.Accounts {
		if account.AccountID == accountID {
			return account.Mode == stellar1.AccountMode_MOBILE, nil
		}
	}
	err = libkb.AppStatusError{
		Code: libkb.SCStellarMissingAccount,
		Desc: "account does not exist for user",
	}
	return false, err
}

// SetAccountMobileOnly will fetch the account bundle and flip the mobile-only switch,
// then send the new account bundle revision to the server.
func SetAccountMobileOnly(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) error {
	bundle, version, _, err := FetchAccountBundle(ctx, g, accountID)
	if err != nil {
		return err
	}
	if version == stellar1.BundleVersion_V1 {
		return fmt.Errorf("mobile-only feature requires migration to v2 bundles")
	}
	err = acctbundle.MakeMobileOnly(bundle, accountID)
	if err == acctbundle.ErrNoChangeNecessary {
		g.Log.CDebugf(ctx, "SetAccountMobileOnly account %s is already mobile-only", accountID)
		return nil
	}
	if err != nil {
		return err
	}
	nextBundle := acctbundle.AdvanceAccounts(*bundle, []stellar1.AccountID{accountID})
	if err := postV2Bundle(ctx, g, &nextBundle); err != nil {
		g.Log.CDebugf(ctx, "SetAccountMobileOnly postV2Bundle error: %s", err)
		return err
	}

	return nil
}

// MakeAccountAllDevices will fetch the account bundle and flip the mobile-only switch to off
// (so that any device can get the account secret keys) then send the new account bundle
// to the server.
func MakeAccountAllDevices(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) error {
	bundle, version, _, err := FetchAccountBundle(ctx, g, accountID)
	if err != nil {
		return err
	}
	if version == stellar1.BundleVersion_V1 {
		return fmt.Errorf("mobile-only feature requires migration to v2 bundles")
	}
	err = acctbundle.MakeAllDevices(bundle, accountID)
	if err == acctbundle.ErrNoChangeNecessary {
		g.Log.CDebugf(ctx, "MakeAccountAllDevices account %s is already in all-device mode", accountID)
		return nil
	}
	if err != nil {
		return err
	}
	nextBundle := acctbundle.AdvanceAccounts(*bundle, []stellar1.AccountID{accountID})
	if err := postV2Bundle(ctx, g, &nextBundle); err != nil {
		g.Log.CDebugf(ctx, "MakeAccountAllDevices postV2Bundle error: %s", err)
		return err
	}

	return nil
}

type lookupUnverifiedResult struct {
	libkb.AppStatusEmbed
	Users []struct {
		UID         keybase1.UID   `json:"uid"`
		EldestSeqno keybase1.Seqno `json:"eldest_seqno"`
	} `json:"users"`
}

func LookupUnverified(ctx context.Context, g *libkb.GlobalContext, accountID stellar1.AccountID) (ret []keybase1.UserVersion, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/lookup",
		SessionType: libkb.APISessionTypeOPTIONAL,
		Args: libkb.HTTPArgs{
			"account_id": libkb.S{Val: accountID.String()},
		},
		MetaContext:    libkb.NewMetaContext(ctx, g),
		RetryCount:     3,
		InitialTimeout: 10 * time.Second,
	}
	var res lookupUnverifiedResult
	if err := g.API.GetDecode(apiArg, &res); err != nil {
		return ret, err
	}
	for _, user := range res.Users {
		ret = append(ret, keybase1.NewUserVersion(user.UID, user.EldestSeqno))
	}
	return ret, nil
}

// pukFinder implements the acctbundle.PukFinder interface.
type pukFinder struct{}

func (p *pukFinder) SeedByGeneration(m libkb.MetaContext, generation keybase1.PerUserKeyGeneration) (libkb.PerUserKeySeed, error) {
	pukring, err := m.G().GetPerUserKeyring(m.Ctx())
	if err != nil {
		return libkb.PerUserKeySeed{}, err
	}

	return pukring.GetSeedByGenerationOrSync(m, generation)
}

type serverTimeboundsRes struct {
	libkb.AppStatusEmbed
	stellar1.TimeboundsRecommendation
}

func ServerTimeboundsRecommendation(ctx context.Context, g *libkb.GlobalContext) (ret stellar1.TimeboundsRecommendation, err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/timebounds",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        libkb.HTTPArgs{},
		MetaContext: libkb.NewMetaContext(ctx, g),
		RetryCount:  3,
	}
	var res serverTimeboundsRes
	if err := g.API.GetDecode(apiArg, &res); err != nil {
		return ret, err
	}
	return res.TimeboundsRecommendation, nil
}

func SetInflationDestination(ctx context.Context, g *libkb.GlobalContext, signedTx string) (err error) {
	apiArg := libkb.APIArg{
		Endpoint:    "stellar/setinflation",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args: libkb.HTTPArgs{
			"sig": libkb.S{Val: signedTx},
		},
		MetaContext: libkb.NewMetaContext(ctx, g),
	}
	_, err = g.API.Post(apiArg)
	return err
}
