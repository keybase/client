// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package libkb

import (
	"encoding/base64"
	"fmt"
	"os"
	"strings"

	keychain "github.com/keybase/go-keychain"
)

const slotSep = "/"

type keychainSlottedAccount struct {
	name NormalizedUsername
	slot int
}

func newKeychainSlottedAccount(name NormalizedUsername, slot int) keychainSlottedAccount {
	return keychainSlottedAccount{
		name: name,
		slot: slot,
	}
}

// keychainSlottedAccount is used in case we can not longer delete/update an entry
// due to keychain corruption. For backwards compatibility the initial slot
// just returns the accountName field.
func (a keychainSlottedAccount) String() string {
	if a.slot == 0 {
		return a.name.String()
	}
	return fmt.Sprintf("%s%s%d", a.name, slotSep, a.slot)
}

func parseSlottedAccount(account string) string {
	parts := strings.Split(account, slotSep)
	if len(parts) == 0 {
		return account
	}
	return parts[0]
}

// NOTE There have been bug reports where we are unable to store a secret in
// the keychain since there is an existing corrupted entry that cannot be
// deleted (returns a keychain.ErrorItemNotFound) but can also not be written
// (return keychain.ErrorDuplicateItem). As a workaround we add a slot number
// to the accountName field to write the secret multiple times, using a new
// slot if an old one is corrupted. When reading the store we return the last
// secret we have written down.
type KeychainSecretStore struct{}

var _ SecretStoreAll = KeychainSecretStore{}

func (k KeychainSecretStore) serviceName(mctx MetaContext) string {
	return mctx.G().GetStoredSecretServiceName()
}

func (k KeychainSecretStore) StoreSecret(mctx MetaContext, accountName NormalizedUsername, secret LKSecFullSecret) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("KeychainSecretStore.StoreSecret(%s)", accountName), func() error { return err })()

	// Base64 encode to make it easy to work with Keychain Access (since we are
	// using a password item and secret is not utf-8)
	encodedSecret := base64.StdEncoding.EncodeToString(secret.Bytes())

	// Try until we successfully write the secret in the store and we are the
	// last entry.
	for i := 0; i < maxKeychainItemSlots; i++ {
		account := newKeychainSlottedAccount(accountName, i)
		if err = k.storeSecret(mctx, account, encodedSecret); err != nil {
			mctx.Debug("KeychainSecretStore.StoreSecret(%s): unable to store secret %v, attempt %d, retrying", accountName, err, i)
			continue
		}

		// look ahead, if we are the last entry in the keychain can break
		// the loop, otherwise we should keep writing the down our secret
		// since reads will only use the last entry.
		if i < maxKeychainItemSlots-1 {
			nextAccount := newKeychainSlottedAccount(accountName, i+1)
			encodedSecret, err := keychain.GetGenericPassword(k.serviceName(mctx), nextAccount.String(), "", k.accessGroup(mctx))
			if err == nil && encodedSecret == nil {
				mctx.Debug("KeychainSecretStore.StoreSecret(%s): successfully stored secret on attempt %d", accountName, i)
				break
			}
		}
	}
	return err
}

func (k KeychainSecretStore) GetOptions(MetaContext) *SecretStoreOptions  { return nil }
func (k KeychainSecretStore) SetOptions(MetaContext, *SecretStoreOptions) {}

func (k KeychainSecretStore) storeSecret(mctx MetaContext, account keychainSlottedAccount, encodedSecret string) (err error) {
	// try to clear an old secret if present
	if err = k.clearSecret(mctx, account); err != nil {
		mctx.Debug("KeychainSecretStore.storeSecret(%s): unable to clearSecret error: %v", account, err)
	}

	item := keychain.NewGenericPassword(k.serviceName(mctx), account.String(),
		"", []byte(encodedSecret), k.accessGroup(mctx))
	item.SetSynchronizable(k.synchronizable())
	item.SetAccessible(k.accessible())
	return keychain.AddItem(item)
}

func (k KeychainSecretStore) updateAccessibility(mctx MetaContext, account keychainSlottedAccount) {
	query := keychain.NewItem()
	query.SetSecClass(keychain.SecClassGenericPassword)
	query.SetService(k.serviceName(mctx))
	query.SetAccount(account.String())

	// iOS keychain returns `keychain.ErrorParam` if this is set so we skip it.
	if !isIOS {
		query.SetMatchLimit(keychain.MatchLimitOne)
	}

	updateItem := keychain.NewItem()
	updateItem.SetAccessible(k.accessible())
	if err := keychain.UpdateItem(query, updateItem); err != nil {
		mctx.Debug("KeychainSecretStore.updateAccessibility: failed: %s", err)
	}
}

func (k KeychainSecretStore) mobileKeychainPermissionDeniedCheck(mctx MetaContext, err error) {
	mctx.G().Log.Debug("mobileKeychainPermissionDeniedCheck: checking for mobile permission denied")
	if !(isIOS && mctx.G().IsMobileAppType()) {
		mctx.G().Log.Debug("mobileKeychainPermissionDeniedCheck: not an iOS app")
		return
	}
	if err != keychain.ErrorInteractionNotAllowed {
		mctx.G().Log.Debug("mobileKeychainPermissionDeniedCheck: wrong kind of error: %s", err)
		return
	}
	mctx.G().Log.Warning("mobileKeychainPermissionDeniedCheck: keychain permission denied, aborting: %s", err)
	os.Exit(4)
}

func (k KeychainSecretStore) RetrieveSecret(mctx MetaContext, accountName NormalizedUsername) (secret LKSecFullSecret, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("KeychainSecretStore.RetrieveSecret(%s)", accountName), func() error { return err })()

	// find the last valid item we have stored in the keychain
	var previousSecret LKSecFullSecret
	for i := 0; i < maxKeychainItemSlots; i++ {
		account := newKeychainSlottedAccount(accountName, i)
		secret, err = k.retrieveSecret(mctx, account)
		if err == nil {
			previousSecret = secret
			mctx.Debug("successfully retrieved secret on attempt: %d, checking if there is another filled slot", i)
		} else if _, ok := err.(SecretStoreError); ok || err == keychain.ErrorItemNotFound {
			// We've reached the end of the keychain entries so let's return
			// the previous secret we found.
			secret = previousSecret
			k.updateAccessibility(mctx, account)
			err = nil
			mctx.Debug("found last slot: %d, finished read", i)
			break
		} else {
			mctx.Debug("unable to retrieve secret: %v, attempt: %d", err, i)
		}
	}
	if err != nil {
		return LKSecFullSecret{}, err
	} else if secret.IsNil() {
		return LKSecFullSecret{}, NewErrSecretForUserNotFound(accountName)
	}
	return secret, nil
}

func (k KeychainSecretStore) retrieveSecret(mctx MetaContext, account keychainSlottedAccount) (lk LKSecFullSecret, err error) {
	encodedSecret, err := keychain.GetGenericPassword(k.serviceName(mctx), account.String(),
		"", k.accessGroup(mctx))
	if err != nil {
		k.mobileKeychainPermissionDeniedCheck(mctx, err)
		return LKSecFullSecret{}, err
	} else if encodedSecret == nil {
		return LKSecFullSecret{}, NewErrSecretForUserNotFound(account.name)
	}

	secret, err := base64.StdEncoding.DecodeString(string(encodedSecret))
	if err != nil {
		return LKSecFullSecret{}, err
	}

	return newLKSecFullSecretFromBytes(secret)
}

func (k KeychainSecretStore) ClearSecret(mctx MetaContext, accountName NormalizedUsername) (err error) {
	defer mctx.TraceTimed(fmt.Sprintf("KeychainSecretStore#ClearSecret: accountName: %s", accountName),
		func() error { return err })()

	if accountName.IsNil() {
		mctx.Debug("NOOPing KeychainSecretStore#ClearSecret for empty username")
		return nil
	}

	// Try all slots to fully clear any secrets for this user
	epick := FirstErrorPicker{}
	for i := 0; i < maxKeychainItemSlots; i++ {
		account := newKeychainSlottedAccount(accountName, i)
		err = k.clearSecret(mctx, account)
		switch err {
		case nil, keychain.ErrorItemNotFound:
		default:
			mctx.Debug("KeychainSecretStore#ClearSecret: accountName: %s, unable to clear secret: %v", accountName, err)
			epick.Push(err)
		}
	}
	return epick.Error()
}

func (k KeychainSecretStore) clearSecret(mctx MetaContext, account keychainSlottedAccount) (err error) {
	query := keychain.NewGenericPassword(k.serviceName(mctx), account.String(),
		"", nil, k.accessGroup(mctx))
	// iOS keychain returns `keychain.ErrorParam` if this is set so we skip it.
	if !isIOS {
		query.SetMatchLimit(keychain.MatchLimitAll)
	}
	return keychain.DeleteItem(query)
}

func NewSecretStoreAll(mctx MetaContext) SecretStoreAll {
	if mctx.G().Env.ForceSecretStoreFile() {
		// Allow use of file secret store for development/testing on MacOS.
		return NewSecretStoreFile(mctx.G().Env.GetDataDir())
	}
	return KeychainSecretStore{}
}

func HasSecretStore() bool {
	return true
}

func (k KeychainSecretStore) GetUsersWithStoredSecrets(mctx MetaContext) ([]string, error) {
	accounts, err := keychain.GetAccountsForService(k.serviceName(mctx))
	if err != nil {
		mctx.Debug("KeychainSecretStore.GetUsersWithStoredSecrets() error: %s", err)
		return nil, err
	}

	seen := map[string]bool{}
	users := []string{}
	for _, account := range accounts {
		username := parseSlottedAccount(account)
		if isPPSSecretStore(username) {
			continue
		}
		if _, ok := seen[username]; !ok {
			users = append(users, username)
			seen[username] = true
		}
	}

	mctx.Debug("KeychainSecretStore.GetUsersWithStoredSecrets() -> %d users, %d accounts", len(users), len(accounts))
	return users, nil
}
