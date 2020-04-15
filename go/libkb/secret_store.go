// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type SecretRetriever interface {
	RetrieveSecret(m MetaContext) (LKSecFullSecret, error)
}

type SecretStoreOptions struct {
	RandomPw bool
}

func DefaultSecretStoreOptions() SecretStoreOptions {
	return SecretStoreOptions{}
}

type SecretStorer interface {
	StoreSecret(m MetaContext, secret LKSecFullSecret) error
}

// SecretStore stores/retreives the keyring-resident secrets for a given user.
type SecretStore interface {
	SecretRetriever
	SecretStorer
	GetOptions(mctx MetaContext) *SecretStoreOptions
	SetOptions(mctx MetaContext, options *SecretStoreOptions)
}

// SecretStoreall stores/retreives the keyring-resider secrets for **all** users
// on this system.
type SecretStoreAll interface {
	RetrieveSecret(mctx MetaContext, username NormalizedUsername) (LKSecFullSecret, error)
	StoreSecret(mctx MetaContext, username NormalizedUsername, secret LKSecFullSecret) error
	GetOptions(mctx MetaContext) *SecretStoreOptions
	SetOptions(mctx MetaContext, options *SecretStoreOptions)
	ClearSecret(mctx MetaContext, username NormalizedUsername) error
	GetUsersWithStoredSecrets(mctx MetaContext) ([]string, error)
}

// SecretStoreImp is a specialization of a SecretStoreAll for just one username.
// You specify that username at the time on construction and then it doesn't change.
type SecretStoreImp struct {
	username NormalizedUsername
	store    *SecretStoreLocked
	secret   LKSecFullSecret
	sync.Mutex
}

var _ SecretStore = (*SecretStoreImp)(nil)

func (s *SecretStoreImp) RetrieveSecret(m MetaContext) (LKSecFullSecret, error) {
	s.Lock()
	defer s.Unlock()

	if !s.secret.IsNil() {
		return s.secret, nil
	}
	sec, err := s.store.RetrieveSecret(m, s.username)
	if err != nil {
		return sec, err
	}
	s.secret = sec
	return sec, nil
}

func (s *SecretStoreImp) StoreSecret(m MetaContext, secret LKSecFullSecret) error {
	s.Lock()
	defer s.Unlock()

	// clear out any in-memory secret in this instance
	s.secret = LKSecFullSecret{}
	return s.store.StoreSecret(m, s.username, secret)
}

func (s *SecretStoreImp) GetOptions(mctx MetaContext) *SecretStoreOptions {
	if s.store != nil {
		return s.store.GetOptions(mctx)
	}
	return nil

}
func (s *SecretStoreImp) SetOptions(mctx MetaContext, options *SecretStoreOptions) {
	if s.store != nil {
		s.store.SetOptions(mctx, options)
	}
}

// NewSecretStore returns a SecretStore interface that is only used for
// a short period of time (i.e. one function block).  Multiple calls to RetrieveSecret()
// will only call the underlying store.RetrieveSecret once.
func NewSecretStore(m MetaContext, username NormalizedUsername) SecretStore {
	store := m.G().SecretStore()
	if store != nil {
		m.Debug("NewSecretStore: reifying SecretStoreImp for %q", username)
		return &SecretStoreImp{
			username: username,
			store:    store,
		}
	}
	return nil
}

func GetConfiguredAccountsFromProvisionedUsernames(m MetaContext, s SecretStoreAll, currentUsername NormalizedUsername, allUsernames []NormalizedUsername) ([]keybase1.ConfiguredAccount, error) {
	if !currentUsername.IsNil() {
		allUsernames = append(allUsernames, currentUsername)
	}

	accounts := make(map[NormalizedUsername]keybase1.ConfiguredAccount)
	for _, username := range allUsernames {
		accounts[username] = keybase1.ConfiguredAccount{
			Username:  username.String(),
			IsCurrent: username.Eq(currentUsername),
		}
	}

	// Get the full names
	uids := make([]keybase1.UID, len(allUsernames))
	for idx, username := range allUsernames {
		uids[idx] = GetUIDByNormalizedUsername(m.G(), username)
	}
	usernamePackages, err := m.G().UIDMapper.MapUIDsToUsernamePackages(m.Ctx(), m.G(),
		uids, time.Hour*24, time.Second*10, false)
	if err != nil {
		if usernamePackages != nil {
			// If data is returned, interpret the error as a warning
			m.G().Log.CInfof(m.Ctx(),
				"error while retrieving full names: %+v", err)
		} else {
			return nil, err
		}
	}
	for _, uPackage := range usernamePackages {
		if uPackage.FullName == nil {
			continue
		}
		if account, ok := accounts[uPackage.NormalizedUsername]; ok {
			account.Fullname = uPackage.FullName.FullName
			accounts[uPackage.NormalizedUsername] = account
		}
	}

	// Check for secrets

	var storedSecretUsernames []string
	if s != nil {
		storedSecretUsernames, err = s.GetUsersWithStoredSecrets(m)
	}
	if err != nil {
		return nil, err
	}

	for _, username := range storedSecretUsernames {
		nu := NewNormalizedUsername(username)
		account, ok := accounts[nu]
		if ok {
			account.HasStoredSecret = true
			accounts[nu] = account
		}
	}

	configuredAccounts := make([]keybase1.ConfiguredAccount, 0, len(accounts))
	for _, account := range accounts {
		configuredAccounts = append(configuredAccounts, account)
	}

	loginTimes, err := getLoginTimes(m)
	if err != nil {
		m.Warning("Failed to get login times: %s", err)
		loginTimes = make(loginTimeMap)
	}

	sort.Slice(configuredAccounts, func(i, j int) bool {
		iUsername := configuredAccounts[i].Username
		jUsername := configuredAccounts[j].Username
		iTime, iOk := loginTimes[NormalizedUsername(iUsername)]
		jTime, jOk := loginTimes[NormalizedUsername(jUsername)]
		if !iOk && !jOk {
			iSignedIn := configuredAccounts[i].HasStoredSecret
			jSignedIn := configuredAccounts[j].HasStoredSecret
			if iSignedIn != jSignedIn {
				return iSignedIn
			}
			return strings.Compare(iUsername, jUsername) < 0
		}
		if !iOk {
			return false
		}
		if !jOk {
			return true
		}
		return iTime.After(jTime)
	})

	return configuredAccounts, nil
}

func GetConfiguredAccounts(m MetaContext, s SecretStoreAll) ([]keybase1.ConfiguredAccount, error) {
	currentUsername, allUsernames, err := GetAllProvisionedUsernames(m)
	if err != nil {
		return nil, err
	}
	return GetConfiguredAccountsFromProvisionedUsernames(m, s, currentUsername, allUsernames)
}

func ClearStoredSecret(m MetaContext, username NormalizedUsername) error {
	ss := m.G().SecretStore()
	if ss == nil {
		return nil
	}
	return ss.ClearSecret(m, username)
}

// SecretStoreLocked protects a SecretStoreAll with a mutex. It wraps two different
// SecretStoreAlls: one in memory and one in disk. In all cases, we always have a memory
// backing. If the OS and options provide one, we can additionally have a disk-backed
// secret store. It's a write-through cache, so on RetrieveSecret, the memory store
// will be checked first, and then the disk store.
type SecretStoreLocked struct {
	sync.Mutex
	mem  SecretStoreAll
	disk SecretStoreAll
}

func NewSecretStoreLocked(m MetaContext) *SecretStoreLocked {
	// We always make an on-disk secret store, but if the user has opted not
	// to remember their passphrase, we don't store it on-disk.
	return &SecretStoreLocked{
		mem:  NewSecretStoreMem(),
		disk: NewSecretStoreAll(m),
	}
}

func (s *SecretStoreLocked) isNil() bool {
	return s.mem == nil && s.disk == nil
}

func (s *SecretStoreLocked) ClearMem() {
	s.mem = NewSecretStoreMem()
}

func (s *SecretStoreLocked) RetrieveSecret(m MetaContext, username NormalizedUsername) (LKSecFullSecret, error) {
	if s == nil || s.isNil() {
		return LKSecFullSecret{}, nil
	}
	s.Lock()
	defer s.Unlock()

	res, err := s.mem.RetrieveSecret(m, username)
	if !res.IsNil() && err == nil {
		return res, nil
	}
	if err != nil {
		m.Debug("SecretStoreLocked#RetrieveSecret: memory fetch error: %s", err.Error())
	}
	if s.disk == nil {
		return res, err
	}

	res, err = s.disk.RetrieveSecret(m, username)
	if err != nil {
		return res, err
	}
	tmp := s.mem.StoreSecret(m, username, res)
	if tmp != nil {
		m.Debug("SecretStoreLocked#RetrieveSecret: failed to store secret in memory: %s", tmp.Error())
	}
	return res, err
}

func (s *SecretStoreLocked) StoreSecret(m MetaContext, username NormalizedUsername, secret LKSecFullSecret) error {
	if s == nil || s.isNil() {
		return nil
	}
	s.Lock()
	defer s.Unlock()
	err := s.mem.StoreSecret(m, username, secret)
	if err != nil {
		m.Debug("SecretStoreLocked#StoreSecret: failed to store secret in memory: %s", err.Error())
	}
	if s.disk == nil {
		return err
	}
	if !m.G().Env.GetRememberPassphrase(username) {
		m.Debug("SecretStoreLocked: should not remember passphrase for %s; not storing on disk", username)
		return err
	}
	return s.disk.StoreSecret(m, username, secret)
}

func (s *SecretStoreLocked) ClearSecret(m MetaContext, username NormalizedUsername) error {

	if username.IsNil() {
		m.Debug("NOOPing SecretStoreLocked#ClearSecret for empty username")
		return nil
	}

	if s == nil || s.isNil() {
		return nil
	}
	s.Lock()
	defer s.Unlock()

	err := s.mem.ClearSecret(m, username)
	if err != nil {
		m.Debug("SecretStoreLocked#ClearSecret: failed to clear memory: %s", err.Error())
	}
	if s.disk == nil {
		return err
	}
	return s.disk.ClearSecret(m, username)
}

func (s *SecretStoreLocked) GetUsersWithStoredSecrets(m MetaContext) ([]string, error) {
	if s == nil || s.isNil() {
		return nil, nil
	}
	s.Lock()
	defer s.Unlock()
	users := make(map[string]struct{})

	memUsers, memErr := s.mem.GetUsersWithStoredSecrets(m)
	if memErr == nil {
		for _, memUser := range memUsers {
			users[memUser] = struct{}{}
		}
	}
	if s.disk == nil {
		return memUsers, memErr
	}
	diskUsers, diskErr := s.disk.GetUsersWithStoredSecrets(m)
	if diskErr == nil {
		for _, diskUser := range diskUsers {
			users[diskUser] = struct{}{}
		}
	}
	if memErr != nil && diskErr != nil {
		return nil, CombineErrors(memErr, diskErr)
	}
	var ret []string
	for user := range users {
		ret = append(ret, user)
	}
	return ret, nil
}

func (s *SecretStoreLocked) PrimeSecretStores(mctx MetaContext) (err error) {
	if mctx.G().Env.GetSecretStorePrimingDisabled() {
		mctx.Debug("Skipping PrimeSecretStores, disabled in env")
		return nil
	}
	if s == nil || s.isNil() {
		return errors.New("secret store is not available")
	}
	if s.disk != nil {
		err = PrimeSecretStore(mctx, s.disk)
		if err != nil {
			return err
		}
	}
	err = PrimeSecretStore(mctx, s.mem)
	return err
}

func (s *SecretStoreLocked) IsPersistent() bool {
	if s == nil || s.isNil() {
		return false
	}
	return s.disk != nil
}

func (s *SecretStoreLocked) GetOptions(mctx MetaContext) *SecretStoreOptions {
	if s.disk != nil {
		return s.disk.GetOptions(mctx)
	}
	return nil
}
func (s *SecretStoreLocked) SetOptions(mctx MetaContext, options *SecretStoreOptions) {
	if s.disk != nil {
		s.disk.SetOptions(mctx, options)
	}
}

// PrimeSecretStore runs a test with current platform's secret store, trying to
// store, retrieve, and then delete a secret with an arbitrary name. This should
// be done before provisioning or logging in
func PrimeSecretStore(mctx MetaContext, ss SecretStoreAll) (err error) {
	defer func() {
		if err != nil {
			go reportPrimeSecretStoreFailure(mctx.BackgroundWithLogTags(), ss, err)
		}
	}()
	defer mctx.Trace("PrimeSecretStore", &err)()

	// Generate test username and test secret
	testUsername, err := RandString("test_ss_", 5)
	// RandString returns base32 encoded random bytes, make it look like a
	// Keybase username. This is not required, though.
	testUsername = strings.ToLower(strings.Replace(testUsername, "=", "", -1))
	if err != nil {
		return err
	}
	randBytes, err := RandBytes(LKSecLen)
	if err != nil {
		return err
	}
	mctx.Debug("PrimeSecretStore: priming secret store with username %q and secret %v", testUsername, randBytes)
	testNormUsername := NormalizedUsername(testUsername)
	var secretF [LKSecLen]byte
	copy(secretF[:], randBytes)
	testSecret := LKSecFullSecret{f: &secretF}

	defer func() {
		err2 := ss.ClearSecret(mctx, testNormUsername)
		mctx.Debug("PrimeSecretStore: clearing test secret store entry")
		if err2 != nil {
			mctx.Debug("PrimeSecretStore: clearing secret store entry returned an error: %s", err2)
			if err == nil {
				err = err2
			} else {
				mctx.Debug("suppressing store clearing error because something else has errored prior")
			}
		}
	}()

	// Try to fetch first, we should get an error back.
	_, err = ss.RetrieveSecret(mctx, testNormUsername)
	if err == nil {
		return errors.New("managed to retrieve secret before storing it")
	} else if err != nil {
		mctx.Debug("PrimeSecretStore: error when retrieving secret that wasn't stored yet: %q, as expected", err)
	}

	// Put secret in secret store through `SecretStore` interface.
	err = ss.StoreSecret(mctx, testNormUsername, testSecret)
	if err != nil {
		return fmt.Errorf("error while storing secret: %s", err)
	}

	// Recreate test store with same username, try to retrieve secret.
	retrSecret, err := ss.RetrieveSecret(mctx, testNormUsername)
	if err != nil {
		return fmt.Errorf("error while retrieving secret: %s", err)
	}
	mctx.Debug("PrimeSecretStore: retrieved secret: %v", retrSecret.f)
	if !retrSecret.Equal(testSecret) {
		return errors.New("managed to retrieve test secret but it didn't match the stored one")
	}

	mctx.Debug("PrimeSecretStore: retrieved secret matched!")
	return nil
}

func reportPrimeSecretStoreFailure(mctx MetaContext, ss SecretStoreAll, reportErr error) {
	var err error
	defer mctx.Trace("reportPrimeSecretStoreFailure", &err)()
	osVersion, osBuild, err := OSVersionAndBuild()
	if err != nil {
		mctx.Debug("os info error: %v", err)
	}
	apiArg := APIArg{
		Endpoint:    "device/error",
		SessionType: APISessionTypeNONE,
		Args: HTTPArgs{
			"event":      S{Val: "prime_secret_store"},
			"msg":        S{Val: fmt.Sprintf("[%T] [%T] %v", ss, reportErr, reportErr.Error())},
			"run_mode":   S{Val: string(mctx.G().GetRunMode())},
			"kb_version": S{Val: VersionString()},
			"os_version": S{Val: osVersion},
			"os_build":   S{Val: osBuild},
		},
		RetryCount:     3,
		InitialTimeout: 10 * time.Second,
	}
	var apiRes AppStatusEmbed
	err = mctx.G().API.PostDecode(mctx, apiArg, &apiRes)
}

type loginTimeMap map[NormalizedUsername]time.Time

func loginTimesDbKey(mctx MetaContext) DbKey {
	return DbKey{
		// Should not be per-user, so not using uid in the db key
		Typ: DBLoginTimes,
		Key: "",
	}
}

func getLoginTimes(mctx MetaContext) (ret loginTimeMap, err error) {
	found, err := mctx.G().LocalDb.GetInto(&ret, loginTimesDbKey(mctx))
	if err != nil {
		return ret, err
	}
	if !found {
		ret = make(loginTimeMap)
	}
	return ret, nil
}

func RecordLoginTime(mctx MetaContext, username NormalizedUsername) (err error) {
	ret, err := getLoginTimes(mctx)
	if err != nil {
		mctx.Warning("failed to get login times from db; overwriting existing data: %s", err)
		ret = make(loginTimeMap)
	}
	ret[username] = time.Now()
	return mctx.G().LocalDb.PutObj(loginTimesDbKey(mctx), nil, ret)
}
