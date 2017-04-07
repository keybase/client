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

func NewJSONConfigFile(g *GlobalContext, s string) *JSONConfigFile {
	return &JSONConfigFile{NewJSONFile(g, s, "config"), &UserConfigWrapper{}}
}

type valueGetter func(*jsonw.Wrapper) (interface{}, error)

func (f JSONConfigFile) getValueAtPath(p string, getter valueGetter) (ret interface{}, isSet bool) {
	var err error
	ret, err = getter(f.jw.AtPath(p))
	if err == nil {
		isSet = true
	}
	return
}

// Check looks inside the JSON file to see if any fields are poorly specified
func (f JSONConfigFile) Check() error {
	return PickFirstError(
		// Feel free to add others here..
		func() error {
			_, err := f.GetRunMode()
			return err
		}(),
	)
}

func getString(w *jsonw.Wrapper) (interface{}, error) {
	return w.GetString()
}

func getBool(w *jsonw.Wrapper) (interface{}, error) {
	return w.GetBool()
}

func getInt(w *jsonw.Wrapper) (interface{}, error) {
	return w.GetInt()
}

func (f JSONConfigFile) GetFilename() string {
	return f.filename
}

func (f JSONConfigFile) GetInterfaceAtPath(p string) (i interface{}, err error) {
	return f.jw.AtPath(p).GetInterface()
}

func (f JSONConfigFile) GetStringAtPath(p string) (ret string, isSet bool) {
	i, isSet := f.getValueAtPath(p, getString)
	if isSet {
		ret = i.(string)
	}
	return
}

func (f JSONConfigFile) GetBoolAtPath(p string) (ret bool, isSet bool) {
	i, isSet := f.getValueAtPath(p, getBool)
	if isSet {
		ret = i.(bool)
	}
	return
}

func (f JSONConfigFile) GetIntAtPath(p string) (ret int, isSet bool) {
	i, isSet := f.getValueAtPath(p, getInt)
	if isSet {
		ret = i.(int)
	}
	return
}

func (f JSONConfigFile) GetNullAtPath(p string) (isSet bool) {
	w := f.jw.AtPath(p)
	isSet = w.IsNil() && w.Error() == nil
	return
}

func (f JSONConfigFile) GetDurationAtPath(p string) (time.Duration, bool) {
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

func (f JSONConfigFile) GetTopLevelString(s string) (ret string) {
	var e error
	f.jw.AtKey(s).GetStringVoid(&ret, &e)
	f.G().VDL.Log(VLog1, "Config: mapping %q -> %q", s, ret)
	return
}

func (f JSONConfigFile) GetTopLevelBool(s string) (res, isSet bool) {
	if w := f.jw.AtKey(s); !w.IsNil() {
		isSet = true
		var e error
		w.GetBoolVoid(&res, &e)
	}
	return
}

func (f *JSONConfigFile) setValueAtPath(p string, getter valueGetter, v interface{}) error {
	existing, err := getter(f.jw.AtPath(p))

	if err != nil || existing != v {
		err = f.jw.SetValueAtPath(p, jsonw.NewWrapper(v))
		if err == nil {
			return f.Save()
		}
	}
	return err
}

func (f *JSONConfigFile) SetWrapperAtPath(p string, w *jsonw.Wrapper) error {
	err := f.jw.SetValueAtPath(p, w)
	if err == nil {
		err = f.Save()
	}
	return err
}

func (f *JSONConfigFile) SetStringAtPath(p string, v string) error {
	return f.setValueAtPath(p, getString, v)
}

func (f *JSONConfigFile) SetBoolAtPath(p string, v bool) error {
	return f.setValueAtPath(p, getBool, v)
}

func (f *JSONConfigFile) SetIntAtPath(p string, v int) error {
	return f.setValueAtPath(p, getInt, v)
}

func (f *JSONConfigFile) SetInt64AtPath(p string, v int64) error {
	return f.setValueAtPath(p, getInt, v)
}

func (f *JSONConfigFile) SetNullAtPath(p string) (err error) {
	existing := f.jw.AtPath(p)
	if !existing.IsNil() || existing.Error() != nil {
		err = f.jw.SetValueAtPath(p, jsonw.NewNil())
		if err == nil {
			return f.Save()
		}
	}
	return
}

func (f JSONConfigFile) GetUserConfig() (*UserConfig, error) {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	return f.getUserConfigWithLock()
}

// GetUserConfig looks for the `current_user` field to see if there's
// a corresponding user object in the `users` table. There really should be.
func (f JSONConfigFile) getUserConfigWithLock() (ret *UserConfig, err error) {

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

func (f JSONConfigFile) GetDeviceIDForUsername(nu NormalizedUsername) keybase1.DeviceID {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	ret, err := f.GetUserConfigForUsername(nu)
	var empty keybase1.DeviceID
	if err != nil {
		return empty
	}
	return ret.GetDeviceID()
}

func (f JSONConfigFile) GetDeviceIDForUID(u keybase1.UID) keybase1.DeviceID {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	ret, err := f.GetUserConfigForUID(u)
	var empty keybase1.DeviceID
	if err != nil || ret == nil {
		return empty
	}
	return ret.GetDeviceID()
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

	f.jw.SetKey("current_user", val)
	f.userConfigWrapper.userConfig = nil
	saveErr := f.Save()
	if err != nil {
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
func (f JSONConfigFile) GetUserConfigForUsername(nu NormalizedUsername) (*UserConfig, error) {
	return ImportUserConfigFromJSONWrapper(f.jw.AtKey("users").AtKey(nu.String()))
}

// GetUserConfigForUID sees if there's a UserConfig object for the given UIDs previously stored.
func (f JSONConfigFile) GetUserConfigForUID(u keybase1.UID) (*UserConfig, error) {
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

func (f JSONConfigFile) GetAllUsernames() (current NormalizedUsername, others []NormalizedUsername, err error) {
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
		f.jw.DeleteKey("current_user")
		f.userConfigWrapper.userConfig = nil
		return f.Save()
	}

	parent := f.jw.AtKey("users")
	un := u.GetUsername()
	f.G().Log.Debug("| SetUserConfig(%s)", un)
	if parent.IsNil() {
		parent = jsonw.NewDictionary()
		f.jw.SetKey("users", parent)
	}
	if parent.AtKey(un.String()).IsNil() || overwrite {
		uWrapper, err := jsonw.NewObjectWrapper(*u)
		if err != nil {
			return err
		}
		parent.SetKey(un.String(), uWrapper)
		f.userConfigWrapper.userConfig = u
	}

	if !f.getCurrentUser().Eq(un) {
		f.jw.SetKey("current_user", jsonw.NewString(un.String()))
		f.userConfigWrapper.userConfig = nil
	}

	return f.Save()
}

func (f *JSONConfigFile) DeleteAtPath(p string) {
	f.jw.DeleteValueAtPath(p)
	f.Save()
}

func (f *JSONConfigFile) Reset() {
	f.jw = jsonw.NewDictionary()
	f.Save()
}

func (f JSONConfigFile) GetHome() string {
	return f.GetTopLevelString("home")
}
func (f JSONConfigFile) GetServerURI() string {
	return f.GetTopLevelString("server")
}
func (f JSONConfigFile) GetConfigFilename() string {
	return f.GetTopLevelString("config_file")
}
func (f JSONConfigFile) GetUpdaterConfigFilename() string {
	return f.GetTopLevelString("updater_config_file")
}
func (f JSONConfigFile) GetSecretKeyringTemplate() string {
	return f.GetTopLevelString("secret_keyring")
}
func (f JSONConfigFile) GetSessionFilename() string {
	return f.GetTopLevelString("session_file")
}
func (f JSONConfigFile) GetDbFilename() string {
	return f.GetTopLevelString("db")
}
func (f JSONConfigFile) GetChatDbFilename() string {
	return f.GetTopLevelString("chat_db")
}
func (f JSONConfigFile) GetPvlKitFilename() string {
	return f.GetTopLevelString("pvl_kit")
}
func (f JSONConfigFile) GetPinentry() string {
	res, _ := f.GetStringAtPath("pinentry.path")
	return res
}
func (f JSONConfigFile) GetGpg() string {
	res, _ := f.GetStringAtPath("gpg.command")
	return res
}
func (f JSONConfigFile) GetLocalRPCDebug() string {
	return f.GetTopLevelString("local_rpc_debug")
}
func (f JSONConfigFile) GetTimers() string {
	return f.GetTopLevelString("timers")
}
func (f JSONConfigFile) GetGpgOptions() []string {
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
func (f JSONConfigFile) GetRunMode() (RunMode, error) {
	var err error
	var ret RunMode = NoRunMode
	if s, isSet := f.GetStringAtPath("run_mode"); isSet {
		ret, err = StringToRunMode(s)
	}
	return ret, err
}
func (f JSONConfigFile) GetFeatureFlags() (ret FeatureFlags, err error) {
	if s, isSet := f.GetStringAtPath("features"); isSet {
		ret = StringToFeatureFlags(s)
	}
	return ret, err
}
func (f JSONConfigFile) GetNoPinentry() (bool, bool) {
	return f.GetBoolAtPath("pinentry.disabled")
}
func (f JSONConfigFile) GetUsername() (ret NormalizedUsername) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetUsername()
	}
	return ret
}
func (f JSONConfigFile) GetSalt() (ret []byte) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetSalt()
	}
	return ret
}
func (f JSONConfigFile) GetUID() (ret keybase1.UID) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetUID()
	}
	return ret
}
func (f JSONConfigFile) GetDeviceID() (ret keybase1.DeviceID) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetDeviceID()
	}
	return ret
}

func (f JSONConfigFile) GetTorMode() (ret TorMode, err error) {
	if s, isSet := f.GetStringAtPath("tor.mode"); isSet {
		ret, err = StringToTorMode(s)
	}
	return ret, err
}

func (f JSONConfigFile) GetTorHiddenAddress() string {
	s, _ := f.GetStringAtPath("tor.hidden_address")
	return s
}
func (f JSONConfigFile) GetTorProxy() string {
	s, _ := f.GetStringAtPath("tor.proxy")
	return s
}

func (f JSONConfigFile) GetProxy() string {
	return f.GetTopLevelString("proxy")
}
func (f JSONConfigFile) GetDebug() (bool, bool) {
	return f.GetTopLevelBool("debug")
}
func (f JSONConfigFile) GetVDebugSetting() string {
	return f.GetTopLevelString("vdebug")
}
func (f JSONConfigFile) GetAutoFork() (bool, bool) {
	return f.GetTopLevelBool("auto_fork")
}
func (f JSONConfigFile) GetLogFormat() string {
	return f.GetTopLevelString("log_format")
}
func (f JSONConfigFile) GetStandalone() (bool, bool) {
	return f.GetTopLevelBool("standalone")
}

func (f JSONConfigFile) GetGregorURI() string {
	s, _ := f.GetStringAtPath("push.server_uri")
	return s
}
func (f JSONConfigFile) GetGregorDisabled() (bool, bool) {
	return f.GetBoolAtPath("push.disabled")
}
func (f JSONConfigFile) GetBGIdentifierDisabled() (bool, bool) {
	return f.GetBoolAtPath("bg_identifier.disabled")
}
func (f JSONConfigFile) GetGregorSaveInterval() (time.Duration, bool) {
	return f.GetDurationAtPath("push.save_interval")
}

func (f JSONConfigFile) GetGregorPingInterval() (time.Duration, bool) {
	return f.GetDurationAtPath("push.ping_interval")
}

func (f JSONConfigFile) GetGregorPingTimeout() (time.Duration, bool) {
	return f.GetDurationAtPath("push.ping_timeout")
}

func (f JSONConfigFile) GetChatDelivererInterval() (time.Duration, bool) {
	return f.GetDurationAtPath("chat.deliverer_interval")
}

func (f JSONConfigFile) GetDNSServer() string {
	return ""
}

func (f JSONConfigFile) getCacheSize(w string) (int, bool) {
	return f.jw.AtPathGetInt(w)
}

func (f JSONConfigFile) GetUserCacheMaxAge() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.maxage.users")
}
func (f JSONConfigFile) GetAPITimeout() (time.Duration, bool) {
	return f.GetDurationAtPath("timeouts.api")
}
func (f JSONConfigFile) GetScraperTimeout() (time.Duration, bool) {
	return f.GetDurationAtPath("timeouts.scraper")
}
func (f JSONConfigFile) GetProofCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.proofs")
}

func (f JSONConfigFile) GetProofCacheLongDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.long_duration.proofs")
}

func (f JSONConfigFile) GetProofCacheMediumDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.medium_duration.proofs")
}

func (f JSONConfigFile) GetProofCacheShortDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.short_duration.proofs")
}

func (f JSONConfigFile) GetLinkCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.links")
}

func (f JSONConfigFile) GetLinkCacheCleanDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.clean_duration.links")
}

func (f JSONConfigFile) getStringArray(v *jsonw.Wrapper) []string {
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

func (f JSONConfigFile) GetMerkleKIDs() []string {
	if f.jw == nil {
		return nil
	}

	v, err := f.jw.AtKey("keys").AtKey("merkle").ToArray()
	if err != nil || v == nil {
		return nil
	}

	return f.getStringArray(v)
}

func (f JSONConfigFile) GetCodeSigningKIDs() []string {
	if f.jw == nil {
		return nil
	}

	v, err := f.jw.AtKey("keys").AtKey("codesigning").ToArray()
	if err != nil || v == nil {
		return nil
	}
	return f.getStringArray(v)
}

func (f JSONConfigFile) GetGpgHome() (ret string) {
	ret, _ = f.GetStringAtPath("gpg.home")
	return ret
}

func (f JSONConfigFile) GetBundledCA(host string) (ret string) {
	var err error
	f.jw.AtKey("bundled_ca").AtKey(host).GetStringVoid(&ret, &err)
	if err == nil {
		f.G().Log.Debug("Read bundled CA for %s", host)
	}
	return ret
}

func (f JSONConfigFile) GetSocketFile() string {
	return f.GetTopLevelString("socket_file")
}
func (f JSONConfigFile) GetPidFile() string {
	return f.GetTopLevelString("pid_file")
}

func (f JSONConfigFile) GetProxyCACerts() (ret []string, err error) {
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

func (f JSONConfigFile) GetLogFile() string {
	return f.GetTopLevelString("log_file")
}

func (f JSONConfigFile) GetSecurityAccessGroupOverride() (bool, bool) {
	return false, false
}

func (f JSONConfigFile) GetUpdatePreferenceAuto() (bool, bool) {
	return f.GetBoolAtPath("updates.auto")
}

func (f JSONConfigFile) GetUpdatePreferenceSnoozeUntil() keybase1.Time {
	return f.GetTimeAtPath("updates.snooze")
}

func (f JSONConfigFile) GetUpdateLastChecked() keybase1.Time {
	return f.GetTimeAtPath("updates.last_checked")
}

func (f JSONConfigFile) GetUpdatePreferenceSkip() string {
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

func (f JSONConfigFile) GetUpdateURL() string {
	s, _ := f.GetStringAtPath("updates.url")
	return s
}

func (f JSONConfigFile) GetUpdateDisabled() (bool, bool) {
	return f.GetBoolAtPath("updates.disabled")
}

func (f JSONConfigFile) IsAdmin() (bool, bool) {
	return f.GetBoolAtPath("is_admin")
}

func (f JSONConfigFile) GetTimeAtPath(path string) keybase1.Time {
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

func (f JSONConfigFile) GetLocalTrackMaxAge() (time.Duration, bool) {
	return f.GetDurationAtPath("local_track_max_age")
}

func (f JSONConfigFile) GetMountDir() string {
	return f.GetTopLevelString("mountdir")
}

func bug3964path(un NormalizedUsername) string {
	return fmt.Sprintf("maintenance.%s.bug_3964_repair_time", un)
}

func (f JSONConfigFile) GetBug3964RepairTime(un NormalizedUsername) (time.Time, error) {
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

func (f JSONConfigFile) SetBug3964RepairTime(un NormalizedUsername, t time.Time) (err error) {
	return f.SetStringAtPath(bug3964path(un), fmt.Sprintf("%d", int64(keybase1.ToTime(t))))
}

func (f JSONConfigFile) GetAppType() AppType {
	return AppType(f.GetTopLevelString("app_type"))
}
