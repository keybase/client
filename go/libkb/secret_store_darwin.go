// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

//go:build darwin

package libkb

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strconv"
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
	defer mctx.Trace(fmt.Sprintf("KeychainSecretStore.StoreSecret(%s)", accountName), &err)()

	// Base64 encode to make it easy to work with Keychain Access (since we are
	// using a password item and secret is not utf-8)
	encodedSecret := base64.StdEncoding.EncodeToString(secret.Bytes())

	// Try until we successfully write the secret in the store and we are the
	// last entry.
	for i := range maxKeychainItemSlots {
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

func (k KeychainSecretStore) mobileKeychainPermissionDeniedCheck(mctx MetaContext, err error) {
	mctx.G().Log.Debug("mobileKeychainPermissionDeniedCheck: checking for mobile permission denied")
	if !isIOS || !mctx.G().IsMobileAppType() {
		mctx.G().Log.Debug("mobileKeychainPermissionDeniedCheck: not an iOS app")
		return
	}
	if !errors.Is(err, keychain.ErrorInteractionNotAllowed) {
		mctx.G().Log.Debug("mobileKeychainPermissionDeniedCheck: wrong kind of error: %s", err)
		return
	}
	mctx.G().Log.Warning("mobileKeychainPermissionDeniedCheck: keychain permission denied, aborting: %s", err)
	os.Exit(4)
}

func (k KeychainSecretStore) RetrieveSecret(mctx MetaContext, accountName NormalizedUsername) (secret LKSecFullSecret, err error) {
	defer mctx.Trace(fmt.Sprintf("KeychainSecretStore.RetrieveSecret(%s)", accountName), &err)()

	// Read all slots with a single keychain query; the slot scan issues one
	// SecItemCopyMatching per slot (50 in production), which can add seconds
	// to cold start when securityd is slow.
	secret, err = k.retrieveSecretBatch(mctx, accountName)
	if err == nil {
		return secret, nil
	}
	if _, notFound := err.(SecretStoreError); notFound {
		return LKSecFullSecret{}, err
	}
	mctx.Debug("KeychainSecretStore.RetrieveSecret(%s): batch keychain query failed (%v), falling back to slot scan", accountName, err)
	return k.retrieveSecretSlotScan(mctx, accountName)
}

// parseAccountSlot returns the slot number encoded in a keychain account
// string for the given username, mirroring keychainSlottedAccount.String
// (slot 0 is the bare username).
func parseAccountSlot(account string, name NormalizedUsername) (slot int, ok bool) {
	if account == name.String() {
		return 0, true
	}
	rest, ok := strings.CutPrefix(account, name.String()+slotSep)
	if !ok {
		return 0, false
	}
	slot, err := strconv.Atoi(rest)
	if err != nil || slot <= 0 {
		return 0, false
	}
	return slot, true
}

// retrieveSecretBatch fetches every slot for accountName in one
// SecItemCopyMatching call and picks the same slot the scan in
// retrieveSecretSlotScan would: the last filled slot before the first gap.
func (k KeychainSecretStore) retrieveSecretBatch(mctx MetaContext, accountName NormalizedUsername) (LKSecFullSecret, error) {
	query := keychain.NewItem()
	query.SetSecClass(keychain.SecClassGenericPassword)
	query.SetService(k.serviceName(mctx))
	query.SetAccessGroup(k.accessGroup(mctx))
	query.SetMatchLimit(keychain.MatchLimitAll)
	query.SetReturnAttributes(true)
	query.SetReturnData(true)
	results, err := keychain.QueryItem(query)
	if err != nil {
		k.mobileKeychainPermissionDeniedCheck(mctx, err)
		return LKSecFullSecret{}, err
	}

	bySlot := make(map[int][]byte, len(results))
	for _, r := range results {
		if slot, ok := parseAccountSlot(r.Account, accountName); ok {
			bySlot[slot] = r.Data
		}
	}

	var secret LKSecFullSecret
	found := false
	for i := range maxKeychainItemSlots {
		encodedSecret, ok := bySlot[i]
		if !ok {
			break
		}
		decoded, err := base64.StdEncoding.DecodeString(string(encodedSecret))
		if err != nil {
			mctx.Debug("retrieveSecretBatch: undecodable secret in slot %d: %v", i, err)
			continue
		}
		s, err := newLKSecFullSecretFromBytes(decoded)
		if err != nil {
			mctx.Debug("retrieveSecretBatch: invalid secret in slot %d: %v", i, err)
			continue
		}
		secret = s
		found = true
	}
	if !found {
		return LKSecFullSecret{}, NewErrSecretForUserNotFound(accountName)
	}
	return secret, nil
}

func (k KeychainSecretStore) retrieveSecretSlotScan(mctx MetaContext, accountName NormalizedUsername) (secret LKSecFullSecret, err error) {
	// find the last valid item we have stored in the keychain
	var previousSecret LKSecFullSecret
	for i := range maxKeychainItemSlots {
		account := newKeychainSlottedAccount(accountName, i)
		secret, err = k.retrieveSecret(mctx, account)
		if err == nil {
			previousSecret = secret
			mctx.Debug("successfully retrieved secret on attempt: %d, checking if there is another filled slot", i)
		} else if _, ok := err.(SecretStoreError); ok || errors.Is(err, keychain.ErrorItemNotFound) {
			// We've reached the end of the keychain entries so let's return
			// the previous secret we found.
			secret = previousSecret
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
	defer mctx.Trace(fmt.Sprintf("KeychainSecretStore#ClearSecret: accountName: %s", accountName),
		&err)()

	if accountName.IsNil() {
		mctx.Debug("NOOPing KeychainSecretStore#ClearSecret for empty username")
		return nil
	}

	// Try all slots to fully clear any secrets for this user
	epick := FirstErrorPicker{}
	for i := range maxKeychainItemSlots {
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

func (k KeychainSecretStore) GetUsersWithStoredSecrets(mctx MetaContext) (_ []string, err error) {
	defer mctx.Trace("KeychainSecretStore.GetUsersWithStoredSecrets", &err)()
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
