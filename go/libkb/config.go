// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type UserConfigWrapper struct {
	userConfig *UserConfig
	sync.Mutex
}

type JSONConfigFile struct {
	*JSONFile
	userConfigWrapper *UserConfigWrapper
}

var _ (ConfigReader) = (*JSONConfigFile)(nil)

func NewJSONConfigFile(g *GlobalContext, s string) *JSONConfigFile {
	return &JSONConfigFile{NewJSONFile(g, s, "config"), &UserConfigWrapper{}}
}

// Check looks inside the JSON file to see if any fields are poorly specified
func (f *JSONConfigFile) Check() error {
	return PickFirstError(
		// Feel free to add others here..
		func() error {
			_, err := f.GetRunMode()
			return err
		}(),
	)
}

func (f *JSONConfigFile) GetDurationAtPath(p string) (time.Duration, bool) {
	s, ok := f.GetStringAtPath(p)
	if !ok {
		return 0, false
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		f.G().Log.Warning("invalid time duration in config file: %s => %s", p, s)
		return 0, false
	}
	return d, true
}

func (f *JSONConfigFile) GetTopLevelString(s string) (ret string) {
	var e error
	f.jw.AtKey(s).GetStringVoid(&ret, &e)
	f.G().VDL.Log(VLog1, "Config: mapping %q -> %q", s, ret)
	return
}

func (f *JSONConfigFile) GetTopLevelBool(s string) (res, isSet bool) {
	if w := f.jw.AtKey(s); !w.IsNil() {
		isSet = true
		var e error
		w.GetBoolVoid(&res, &e)
	}
	return
}

func (f *JSONConfigFile) GetUserConfig() (*UserConfig, error) {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	return f.getUserConfigWithLock()
}

// GetUserConfig looks for the `current_user` field to see if there's
// a corresponding user object in the `users` table. There really should be.
func (f *JSONConfigFile) getUserConfigWithLock() (ret *UserConfig, err error) {
	var s string
	if ret = f.userConfigWrapper.userConfig; ret != nil {
		return
	}
	if s, err = f.jw.AtKey("current_user").GetString(); err != nil {
		return
	}
	nu := NewNormalizedUsername(s)
	if ret, err = f.GetUserConfigForUsername(nu); err != nil {
		return
	} else if ret != nil {
		f.userConfigWrapper.userConfig = ret
	} else {
		err = ConfigError{f.filename,
			fmt.Sprintf("Didn't find a UserConfig for %s", s)}
	}
	return
}

func (f *JSONConfigFile) GetDeviceIDForUsername(nu NormalizedUsername) keybase1.DeviceID {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	ret, err := f.GetUserConfigForUsername(nu)
	var empty keybase1.DeviceID
	if err != nil {
		return empty
	}
	return ret.GetDeviceID()
}

func (f *JSONConfigFile) GetPassphraseStateForUsername(nu NormalizedUsername) (ret *keybase1.PassphraseState) {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	userConfig, err := f.GetUserConfigForUsername(nu)
	if err != nil || userConfig == nil {
		return nil
	}
	return userConfig.GetPassphraseState()
}

func (f *JSONConfigFile) GetDeviceIDForUID(u keybase1.UID) keybase1.DeviceID {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	ret, err := f.GetUserConfigForUID(u)
	var empty keybase1.DeviceID
	if err != nil || ret == nil {
		return empty
	}
	return ret.GetDeviceID()
}

func (f *JSONConfigFile) GetUsernameForUID(u keybase1.UID) NormalizedUsername {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	ret, err := f.GetUserConfigForUID(u)
	var empty NormalizedUsername
	if err != nil || ret == nil {
		return empty
	}
	return ret.GetUsername()
}

func (f *JSONConfigFile) GetUIDForUsername(n NormalizedUsername) keybase1.UID {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	ret, err := f.GetUserConfigForUsername(n)
	var empty keybase1.UID
	if err != nil || ret == nil {
		return empty
	}
	return ret.GetUID()
}

func (f *JSONConfigFile) SwitchUser(nu NormalizedUsername) error {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()

	if cu := f.getCurrentUser(); cu.Eq(nu) {
		f.G().Log.Debug("| Already configured as user=%s", nu)
		return nil
	}

	var err error
	var val *jsonw.Wrapper
	if f.jw.AtKey("users").AtKey(nu.String()).IsNil() {
		val = jsonw.NewNil()
		err = UserNotFoundError{Msg: nu.String()}
	} else {
		val = jsonw.NewString(nu.String())
	}

	setKeyErr := f.jw.SetKey("current_user", val)
	if err == nil {
		err = setKeyErr
	}
	f.userConfigWrapper.userConfig = nil
	saveErr := f.Save()
	if err == nil {
		err = saveErr
	}
	return err
}

// NukeUser deletes the given user from the config file, or if
// the given user is empty, deletes the current user from the
// config file.
func (f *JSONConfigFile) NukeUser(nu NormalizedUsername) error {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()

	if cu := f.getCurrentUser(); nu.IsNil() || cu.Eq(nu) {
		err := f.jw.DeleteValueAtPath("current_user")
		f.userConfigWrapper.userConfig = nil
		if err != nil {
			return err
		}
		if nu.IsNil() {
			nu = cu
		}
	}

	if !f.jw.AtKey("users").AtKey(nu.String()).IsNil() {
		err := f.jw.DeleteValueAtPath("users." + nu.String())
		if err != nil {
			return err
		}
	}

	return f.Save()
}

// GetUserConfigForUsername sees if there's a UserConfig object for the given
// username previously stored.
func (f *JSONConfigFile) GetUserConfigForUsername(nu NormalizedUsername) (*UserConfig, error) {
	if uc := f.copyUserConfigIfForUsername(nu); uc != nil {
		return uc, nil
	}
	return ImportUserConfigFromJSONWrapper(f.jw.AtKey("users").AtKey(nu.String()))
}

func (f *JSONConfigFile) copyUserConfigIfForUsername(u NormalizedUsername) *UserConfig {
	if f.userConfigWrapper == nil || f.userConfigWrapper.userConfig == nil {
		return nil
	}
	if f.userConfigWrapper.userConfig.GetUsername().IsNil() {
		return nil
	}
	if f.userConfigWrapper.userConfig.GetUsername().Eq(u) {
		tmp := *f.userConfigWrapper.userConfig
		return &tmp
	}
	return nil
}

func (f *JSONConfigFile) copyUserConfigIfForUID(u keybase1.UID) *UserConfig {
	if f.userConfigWrapper == nil || f.userConfigWrapper.userConfig == nil {
		return nil
	}
	if f.userConfigWrapper.userConfig.GetUID().IsNil() {
		return nil
	}
	if f.userConfigWrapper.userConfig.GetUID().Equal(u) {
		tmp := *f.userConfigWrapper.userConfig
		return &tmp
	}
	return nil
}

// GetUserConfigForUID sees if there's a UserConfig object for the given UIDs previously stored.
func (f *JSONConfigFile) GetUserConfigForUID(u keybase1.UID) (*UserConfig, error) {

	if uc := f.copyUserConfigIfForUID(u); uc != nil {
		return uc, nil
	}

	d := f.jw.AtKey("users")
	keys, _ := d.Keys()
	for _, key := range keys {
		uc, err := f.GetUserConfigForUsername(NewNormalizedUsername(key))
		if err == nil && uc != nil && uc.GetUID().Equal(u) {
			return uc, nil
		}
	}
	return nil, nil
}

func (f *JSONConfigFile) GetAllUserConfigs() (current *UserConfig, all []UserConfig, err error) {

	currentUsername, allUsernames, err := f.GetAllUsernames()
	if err != nil {
		return nil, nil, err
	}

	if !currentUsername.IsNil() {
		current, _ = f.GetUserConfigForUsername(currentUsername)
	}

	for _, u := range allUsernames {
		tmp, err := f.GetUserConfigForUsername(u)
		if err == nil && tmp != nil {
			all = append(all, *tmp)
		}
	}

	return current, all, nil
}

func (f *JSONConfigFile) GetAllUsernames() (current NormalizedUsername, others []NormalizedUsername, err error) {
	current = f.getCurrentUser()
	uw := f.jw.AtKey("users")
	if uw.IsNil() {
		return
	}
	keys, e := uw.Keys()
	if e != nil {
		err = e
		return
	}
	for _, k := range keys {
		u := uw.AtKey(k)
		if u == nil {
			continue
		}
		name, e := u.AtKey("name").GetString()
		if e != nil {
			err = e
			return
		}
		nu := NewNormalizedUsername(name)
		if !nu.Eq(current) {
			others = append(others, nu)
		}
	}
	return
}

// SetDeviceID sets the device field of the UserConfig object
func (f *JSONConfigFile) SetDeviceID(did keybase1.DeviceID) (err error) {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()

	f.G().Log.Debug("| Setting DeviceID to %v\n", did)
	var u *UserConfig
	if u, err = f.getUserConfigWithLock(); err != nil {
	} else if u == nil {
		err = NoUserConfigError{}
	} else {
		u.SetDevice(did)
		err = f.setUserConfigWithLock(u, true)
	}
	return
}

func (f *JSONConfigFile) getCurrentUser() NormalizedUsername {
	s, _ := f.jw.AtKey("current_user").GetString()
	return NormalizedUsername(s)
}

// SetUserConfig writes this UserConfig to the config file and updates the
// currently active UserConfig in memory.  If the given UserConfig is nil, then
// just empty everything out and clear the `current_user` field.  Note that
// we never actually overwrite users.<username>, we just write it if it
// doesn't already exist, and we update the `current_user` pointer.
func (f *JSONConfigFile) SetUserConfig(u *UserConfig, overwrite bool) error {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	return f.setUserConfigWithLock(u, overwrite)
}

func (f *JSONConfigFile) setUserConfigWithLock(u *UserConfig, overwrite bool) error {

	if u == nil {
		f.G().Log.Debug("| SetUserConfig(nil)")
		err := f.jw.DeleteKey("current_user")
		if err != nil {
			return err
		}
		f.userConfigWrapper.userConfig = nil
		return f.Save()
	}

	if u.IsOneshot() {
		f.userConfigWrapper.userConfig = u
		return nil
	}

	parent := f.jw.AtKey("users")
	un := u.GetUsername()
	f.G().Log.Debug("| SetUserConfig(%s)", un)
	if parent.IsNil() {
		parent = jsonw.NewDictionary()
		err := f.jw.SetKey("users", parent)
		if err != nil {
			return err
		}
	}
	if parent.AtKey(un.String()).IsNil() || overwrite {
		uWrapper, err := jsonw.NewObjectWrapper(*u)
		if err != nil {
			return err
		}
		err = parent.SetKey(un.String(), uWrapper)
		if err != nil {
			return err
		}
		f.userConfigWrapper.userConfig = u
	}

	if !f.getCurrentUser().Eq(un) {
		err := f.jw.SetKey("current_user", jsonw.NewString(un.String()))
		if err != nil {
			return err
		}
		f.userConfigWrapper.userConfig = nil
	}

	return f.Save()
}

func (f *JSONConfigFile) Reset() {
	f.jw = jsonw.NewDictionary()
	_ = f.Save()
}

func (f *JSONConfigFile) GetHome() string {
	return f.GetTopLevelString("home")
}
func (f *JSONConfigFile) GetMobileSharedHome() string {
	return f.GetTopLevelString("mobile_shared_home")
}
func (f *JSONConfigFile) GetServerURI() (string, error) {
	return f.GetTopLevelString("server"), nil
}
func (f *JSONConfigFile) GetConfigFilename() string {
	return f.GetTopLevelString("config_file")
}
func (f *JSONConfigFile) GetUpdaterConfigFilename() string {
	return f.GetTopLevelString("updater_config_file")
}
func (f *JSONConfigFile) GetGUIConfigFilename() string {
	return f.GetTopLevelString("gui_config_file")
}
func (f *JSONConfigFile) GetDeviceCloneStateFilename() string {
	return f.GetTopLevelString("device_clone_state_file")
}
func (f *JSONConfigFile) GetSecretKeyringTemplate() string {
	return f.GetTopLevelString("secret_keyring")
}
func (f *JSONConfigFile) GetSessionFilename() string {
	return f.GetTopLevelString("session_file")
}
func (f *JSONConfigFile) GetDbFilename() string {
	return f.GetTopLevelString("db")
}
func (f *JSONConfigFile) GetChatDbFilename() string {
	return f.GetTopLevelString("chat_db")
}
func (f *JSONConfigFile) GetPvlKitFilename() string {
	return f.GetTopLevelString("pvl_kit")
}
func (f *JSONConfigFile) GetParamProofKitFilename() string {
	return f.GetTopLevelString("paramproof_kit")
}
func (f *JSONConfigFile) GetExternalURLKitFilename() string {
	return f.GetTopLevelString("externalurl_kit")
}
func (f *JSONConfigFile) GetProveBypass() (bool, bool) {
	return f.GetBoolAtPath("prove_bypass")
}
func (f *JSONConfigFile) GetPinentry() string {
	res, _ := f.GetStringAtPath("pinentry.path")
	return res
}
func (f *JSONConfigFile) GetGpg() string {
	res, _ := f.GetStringAtPath("gpg.command")
	return res
}
func (f *JSONConfigFile) GetLocalRPCDebug() string {
	return f.GetTopLevelString("local_rpc_debug")
}
func (f *JSONConfigFile) GetTimers() string {
	return f.GetTopLevelString("timers")
}
func (f *JSONConfigFile) GetGpgOptions() []string {
	var ret []string
	if f.jw == nil {
		// noop
	} else if v := f.jw.AtPath("gpg.options"); v == nil {
		// noop
	} else if l, e := v.Len(); e != nil || l == 0 {
		// noop
	} else {
		ret = make([]string, 0, l)
		for i := 0; i < l; i++ {
			if s, e := v.AtIndex(i).GetString(); e == nil {
				ret = append(ret, s)
			}
		}
	}
	return ret
}
func (f *JSONConfigFile) GetRunMode() (ret RunMode, err error) {
	ret = NoRunMode
	if s, isSet := f.GetStringAtPath("run_mode"); isSet {
		ret, err = StringToRunMode(s)
	}
	return ret, err
}
func (f *JSONConfigFile) GetFeatureFlags() (ret FeatureFlags, err error) {
	if s, isSet := f.GetStringAtPath("features"); isSet {
		ret = StringToFeatureFlags(s)
	}
	return ret, err
}
func (f *JSONConfigFile) GetNoPinentry() (bool, bool) {
	return f.GetBoolAtPath("pinentry.disabled")
}
func (f *JSONConfigFile) GetUsername() (ret NormalizedUsername) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetUsername()
	}
	return ret
}
func (f *JSONConfigFile) GetUID() (ret keybase1.UID) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetUID()
	}
	return ret
}
func (f *JSONConfigFile) GetDeviceID() (ret keybase1.DeviceID) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetDeviceID()
	}
	return ret
}

func (f *JSONConfigFile) GetPassphraseState() (ret *keybase1.PassphraseState) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetPassphraseState()
	}
	return ret
}

func (f *JSONConfigFile) SetPassphraseState(passphraseState keybase1.PassphraseState) (err error) {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()

	f.G().Log.Debug("| Setting PassphraseState to %v\n", passphraseState)
	var u *UserConfig
	if u, err = f.getUserConfigWithLock(); err != nil {
	} else if u == nil {
		err = NoUserConfigError{}
	} else {
		u.SetPassphraseState(passphraseState)
		err = f.setUserConfigWithLock(u, true)
	}
	return
}

func (f *JSONConfigFile) GetTorMode() (ret TorMode, err error) {
	if s, isSet := f.GetStringAtPath("tor.mode"); isSet {
		ret, err = StringToTorMode(s)
	}
	return ret, err
}

func (f *JSONConfigFile) GetTorHiddenAddress() string {
	s, _ := f.GetStringAtPath("tor.hidden_address")
	return s
}
func (f *JSONConfigFile) GetTorProxy() string {
	s, _ := f.GetStringAtPath("tor.proxy")
	return s
}

func (f *JSONConfigFile) GetProxy() string {
	return f.GetTopLevelString("proxy")
}
func (f *JSONConfigFile) GetProxyType() string {
	return f.GetTopLevelString("proxy-type")
}
func (f *JSONConfigFile) IsCertPinningEnabled() bool {
	res, isSet := f.GetTopLevelBool("disable-cert-pinning")
	if !isSet {
		// Enable SSL pinning if the flag is not set
		return true
	}
	return !res
}
func (f *JSONConfigFile) GetDebug() (bool, bool) {
	return f.GetTopLevelBool("debug")
}
func (f *JSONConfigFile) GetDebugJourneycard() (bool, bool) {
	return f.GetTopLevelBool("debug_journeycard")
}
func (f *JSONConfigFile) GetDisplayRawUntrustedOutput() (bool, bool) {
	return f.GetTopLevelBool("display_raw_untrusted_output")
}
func (f *JSONConfigFile) GetVDebugSetting() string {
	return f.GetTopLevelString("vdebug")
}
func (f *JSONConfigFile) GetAutoFork() (bool, bool) {
	return f.GetTopLevelBool("auto_fork")
}

func (f *JSONConfigFile) GetRememberPassphrase(username NormalizedUsername) (bool, bool) {
	const legacyRememberPassphraseKey = "remember_passphrase"

	if username.IsNil() {
		return f.GetTopLevelBool(legacyRememberPassphraseKey)
	}
	if m, ok := f.jw.AtKey("remember_passphrase_map").GetDataOrNil().(map[string]interface{}); ok {
		if ret, mOk := m[username.String()]; mOk {
			if boolRet, boolOk := ret.(bool); boolOk {
				return boolRet, true
			}
		}
	}
	return f.GetTopLevelBool(legacyRememberPassphraseKey)
}
func (f *JSONConfigFile) GetStayLoggedOut() (bool, bool) {
	return f.GetBoolAtPath("stay_logged_out")
}
func (f *JSONConfigFile) SetStayLoggedOut(stayLoggedOut bool) error {
	return f.SetBoolAtPath("stay_logged_out", stayLoggedOut)
}
func (f *JSONConfigFile) GetLogFormat() string {
	return f.GetTopLevelString("log_format")
}
func (f *JSONConfigFile) GetStandalone() (bool, bool) {
	return f.GetTopLevelBool("standalone")
}
func (f *JSONConfigFile) GetGregorURI() string {
	s, _ := f.GetStringAtPath("push.server_uri")
	return s
}
func (f *JSONConfigFile) GetGregorDisabled() (bool, bool) {
	return f.GetBoolAtPath("push.disabled")
}
func (f *JSONConfigFile) GetSecretStorePrimingDisabled() (bool, bool) {
	// SecretStorePrimingDisabled is only for tests
	return false, false
}
func (f *JSONConfigFile) GetBGIdentifierDisabled() (bool, bool) {
	return f.GetBoolAtPath("bg_identifier.disabled")
}
func (f *JSONConfigFile) GetGregorSaveInterval() (time.Duration, bool) {
	return f.GetDurationAtPath("push.save_interval")
}

func (f *JSONConfigFile) GetGregorPingInterval() (time.Duration, bool) {
	return f.GetDurationAtPath("push.ping_interval")
}

func (f *JSONConfigFile) GetGregorPingTimeout() (time.Duration, bool) {
	return f.GetDurationAtPath("push.ping_timeout")
}

func (f *JSONConfigFile) GetChatDelivererInterval() (time.Duration, bool) {
	return f.GetDurationAtPath("chat.deliverer_interval")
}

func (f *JSONConfigFile) getCacheSize(w string) (int, bool) {
	return f.jw.AtPathGetInt(w)
}

func (f *JSONConfigFile) GetUserCacheMaxAge() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.maxage.users")
}
func (f *JSONConfigFile) GetAPITimeout() (time.Duration, bool) {
	return f.GetDurationAtPath("timeouts.api")
}
func (f *JSONConfigFile) GetScraperTimeout() (time.Duration, bool) {
	return f.GetDurationAtPath("timeouts.scraper")
}
func (f *JSONConfigFile) GetProofCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.proofs")
}

func (f *JSONConfigFile) GetProofCacheLongDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.long_duration.proofs")
}

func (f *JSONConfigFile) GetProofCacheMediumDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.medium_duration.proofs")
}

func (f *JSONConfigFile) GetProofCacheShortDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.short_duration.proofs")
}

func (f *JSONConfigFile) GetLinkCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.links")
}

func (f *JSONConfigFile) GetLinkCacheCleanDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.clean_duration.links")
}

func (f *JSONConfigFile) GetUPAKCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.upak")
}

func (f *JSONConfigFile) GetUIDMapFullNameCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.uid_map_full_name")
}

func (f *JSONConfigFile) GetPayloadCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.payloads")
}

func (f *JSONConfigFile) GetLevelDBNumFiles() (int, bool) {
	return f.GetIntAtPath("leveldb.num_files")
}

func (f *JSONConfigFile) GetChatInboxSourceLocalizeThreads() (int, bool) {
	return f.GetIntAtPath("chat.inboxsource.localizethreads")
}

func (f *JSONConfigFile) getStringArray(v *jsonw.Wrapper) []string {
	n, err := v.Len()
	if err != nil {
		return nil
	}

	if n == 0 {
		return nil
	}

	ret := make([]string, n)
	for i := 0; i < n; i++ {
		s, err := v.AtIndex(i).GetString()
		if err != nil {
			return nil
		}
		ret[i] = s
	}
	return ret
}

func (f *JSONConfigFile) GetMerkleKIDs() []string {
	if f.jw == nil {
		return nil
	}

	v, err := f.jw.AtKey("keys").AtKey("merkle").ToArray()
	if err != nil || v == nil {
		return nil
	}

	return f.getStringArray(v)
}

func (f *JSONConfigFile) GetCodeSigningKIDs() []string {
	if f.jw == nil {
		return nil
	}

	v, err := f.jw.AtKey("keys").AtKey("codesigning").ToArray()
	if err != nil || v == nil {
		return nil
	}
	return f.getStringArray(v)
}

func (f *JSONConfigFile) GetGpgHome() (ret string) {
	ret, _ = f.GetStringAtPath("gpg.home")
	return ret
}

func (f *JSONConfigFile) GetBundledCA(host string) (ret string) {
	var err error
	f.jw.AtKey("bundled_ca").AtKey(host).GetStringVoid(&ret, &err)
	if err == nil {
		f.G().Log.Debug("Read bundled CA for %s", host)
	}
	return ret
}

func (f *JSONConfigFile) GetSocketFile() string {
	return f.GetTopLevelString("socket_file")
}
func (f *JSONConfigFile) GetPidFile() string {
	return f.GetTopLevelString("pid_file")
}

func (f *JSONConfigFile) GetProxyCACerts() (ret []string, err error) {
	jw := f.jw.AtKey("proxy_ca_certs")
	if l, e := jw.Len(); e == nil {
		for i := 0; i < l; i++ {
			s, e2 := jw.AtIndex(i).GetString()
			if e2 != nil {
				err = ConfigError{f.filename,
					fmt.Sprintf("Error reading proxy CA file @ index %d: %s", i, e2)}
				return
			}

			ret = append(ret, s)
		}
	} else if s, e := jw.GetString(); e == nil {
		ret = strings.Split(s, ":")
	} else if !jw.IsNil() {
		err = ConfigError{f.filename, fmt.Sprintf("Can't read Proxy CA certs: %s", e)}
	}
	return
}

func (f *JSONConfigFile) GetLogFile() string {
	return f.GetTopLevelString("log_file")
}
func (f *JSONConfigFile) GetEKLogFile() string {
	return f.GetTopLevelString("ek_log_file")
}
func (f *JSONConfigFile) GetGUILogFile() string {
	return f.GetTopLevelString("gui_log_file")
}

func (f *JSONConfigFile) GetUseDefaultLogFile() (bool, bool) {
	return f.GetTopLevelBool("use_default_log_file")
}

func (f *JSONConfigFile) GetUseRootConfigFile() (bool, bool) {
	return false, false
}

func (f *JSONConfigFile) GetLogPrefix() string {
	return f.GetTopLevelString("log_prefix")
}

func (f *JSONConfigFile) GetSecurityAccessGroupOverride() (bool, bool) {
	return false, false
}

func (f *JSONConfigFile) GetUpdatePreferenceAuto() (bool, bool) {
	return f.GetBoolAtPath("updates.auto")
}

func (f *JSONConfigFile) GetUpdatePreferenceSnoozeUntil() keybase1.Time {
	return f.GetTimeAtPath("updates.snooze")
}

func (f *JSONConfigFile) GetUpdateLastChecked() keybase1.Time {
	return f.GetTimeAtPath("updates.last_checked")
}

func (f *JSONConfigFile) GetUpdatePreferenceSkip() string {
	s, _ := f.GetStringAtPath("updates.skip")
	return s
}

func (f *JSONConfigFile) SetUpdatePreferenceAuto(b bool) error {
	return f.SetBoolAtPath("updates.auto", b)
}

func (f *JSONConfigFile) SetUpdatePreferenceSkip(v string) error {
	return f.SetStringAtPath("updates.skip", v)
}

func (f *JSONConfigFile) SetUpdatePreferenceSnoozeUntil(t keybase1.Time) error {
	return f.SetTimeAtPath("updates.snooze", t)
}

func (f *JSONConfigFile) SetUpdateLastChecked(t keybase1.Time) error {
	return f.SetTimeAtPath("updates.last_checked", t)
}

func (f *JSONConfigFile) GetUpdateURL() string {
	s, _ := f.GetStringAtPath("updates.url")
	return s
}

func (f *JSONConfigFile) GetUpdateDisabled() (bool, bool) {
	return f.GetBoolAtPath("updates.disabled")
}

func (f *JSONConfigFile) GetTimeAtPath(path string) keybase1.Time {
	var ret keybase1.Time
	s, _ := f.GetStringAtPath(path)
	if len(s) == 0 {
		return ret
	}
	u, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return ret
	}
	ret = keybase1.Time(u)
	return ret
}

func (f *JSONConfigFile) SetTimeAtPath(path string, t keybase1.Time) error {
	if t == keybase1.Time(0) {
		return f.SetNullAtPath(path)
	}
	return f.SetStringAtPath(path, fmt.Sprintf("%d", t))
}

func (f *JSONConfigFile) GetLocalTrackMaxAge() (time.Duration, bool) {
	return f.GetDurationAtPath("local_track_max_age")
}

func (f *JSONConfigFile) GetMountDir() string {
	return f.GetTopLevelString("mountdir")
}

func (f *JSONConfigFile) GetMountDirDefault() string {
	return f.GetTopLevelString("mountdirdefault")
}

func bug3964path(un NormalizedUsername) string {
	return fmt.Sprintf("maintenance.%s.bug_3964_repair_time", un)
}

func (f *JSONConfigFile) GetBug3964RepairTime(un NormalizedUsername) (time.Time, error) {
	if un == "" {
		return time.Time{}, NoUserConfigError{}
	}
	s, _ := f.GetStringAtPath(bug3964path(un))
	if s == "" {
		return time.Time{}, nil
	}
	i, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return time.Time{}, err
	}
	return keybase1.FromTime(keybase1.Time(i)), nil
}

func (f *JSONConfigFile) SetBug3964RepairTime(un NormalizedUsername, t time.Time) (err error) {
	return f.SetStringAtPath(bug3964path(un), fmt.Sprintf("%d", int64(keybase1.ToTime(t))))
}

func (f *JSONConfigFile) GetAppType() AppType {
	return AppType(f.GetTopLevelString("app_type"))
}

func (f *JSONConfigFile) IsMobileExtension() (bool, bool) {
	return f.GetBoolAtPath("mobile_extension")
}

func (f *JSONConfigFile) GetSlowGregorConn() (bool, bool) {
	return f.GetBoolAtPath("slow_gregor_conn")
}

func (f *JSONConfigFile) GetReadDeletedSigChain() (bool, bool) {
	return f.GetBoolAtPath("read_deleted_sigchain")
}

func (f *JSONConfigFile) SetRememberPassphrase(username NormalizedUsername, remember bool) error {
	if username.IsNil() {
		return f.SetBoolAtPath("remember_passphrase", remember)
	}
	return f.SetBoolAtPath(fmt.Sprintf("remember_passphrase_map.%s", username.String()), remember)
}

func (f *JSONConfigFile) GetAttachmentHTTPStartPort() (int, bool) {
	return f.GetIntAtPath("attachment_httpsrv_port")
}

func (f *JSONConfigFile) GetAttachmentDisableMulti() (bool, bool) {
	return f.GetBoolAtPath("attachment_disable_multi")
}

func (f *JSONConfigFile) GetDisableTeamAuditor() (bool, bool) {
	return f.GetBoolAtPath("disable_team_auditor")
}

func (f *JSONConfigFile) GetDisableTeamBoxAuditor() (bool, bool) {
	return f.GetBoolAtPath("disable_team_box_auditor")
}

func (f *JSONConfigFile) GetDisableEKBackgroundKeygen() (bool, bool) {
	return f.GetBoolAtPath("disable_ek_background_keygen")
}

func (f *JSONConfigFile) GetDisableMerkleAuditor() (bool, bool) {
	return f.GetBoolAtPath("disable_merkle_auditor")
}

func (f *JSONConfigFile) GetDisableSearchIndexer() (bool, bool) {
	return f.GetBoolAtPath("disable_search_indexer")
}

func (f *JSONConfigFile) GetDisableBgConvLoader() (bool, bool) {
	return f.GetBoolAtPath("disable_bg_conv_loader")
}

func (f *JSONConfigFile) GetEnableBotLiteMode() (bool, bool) {
	return f.GetBoolAtPath("enable_bot_lite_mode")
}

func (f *JSONConfigFile) GetExtraNetLogging() (bool, bool) {
	return f.GetBoolAtPath("extra_net_logging")
}

func (f *JSONConfigFile) GetForceLinuxKeyring() (bool, bool) {
	return f.GetBoolAtPath("force_linux_keyring")
}

func (f *JSONConfigFile) GetForceSecretStoreFile() (bool, bool) {
	return f.GetBoolAtPath("force_less_safe_secret_store_file")
}

func (f *JSONConfigFile) GetChatOutboxStorageEngine() string {
	s, _ := f.GetStringAtPath("chat_outboxstorageengine")
	return s
}

func (f *JSONConfigFile) GetRuntimeStatsEnabled() (bool, bool) {
	return f.GetBoolAtPath("runtime_stats_enabled")
}
