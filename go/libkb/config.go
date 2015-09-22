package libkb

import (
	"fmt"
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
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

func NewJSONConfigFile(s string) *JSONConfigFile {
	return &JSONConfigFile{NewJSONFile(s, "config"), &UserConfigWrapper{}}
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
		G.Log.Warning("invalid time duration in config file: %s => %s", p, s)
		return 0, false
	}
	return d, true
}

func (f JSONConfigFile) GetTopLevelString(s string) (ret string) {
	var e error
	f.jw.AtKey(s).GetStringVoid(&ret, &e)
	G.Log.Debug("Config: mapping %s -> %s", s, ret)
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
			return f.flush()
		}
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

func (f *JSONConfigFile) SetNullAtPath(p string) (err error) {
	existing := f.jw.AtPath(p)
	if !existing.IsNil() || existing.Error() != nil {
		err = f.jw.SetValueAtPath(p, jsonw.NewNil())
		if err == nil {
			return f.flush()
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

func (f *JSONConfigFile) SwitchUser(nu NormalizedUsername) error {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()

	if cu := f.getCurrentUser(); cu.Eq(nu) {
		G.Log.Debug("| Already configured as user=%s", nu)
		return nil
	}

	if f.jw.AtKey("users").AtKey(nu.String()).IsNil() {
		return UserNotFoundError{msg: nu.String()}
	}

	f.jw.SetKey("current_user", jsonw.NewString(nu.String()))
	f.userConfigWrapper.userConfig = nil
	return f.flush()
}

// GetUserConfigForUsername sees if there's a UserConfig object for the given
// username previously stored.
func (f JSONConfigFile) GetUserConfigForUsername(nu NormalizedUsername) (*UserConfig, error) {
	return ImportUserConfigFromJSONWrapper(f.jw.AtKey("users").AtKey(nu.String()))
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

	G.Log.Debug("| Setting DeviceID to %v\n", did)
	var u *UserConfig
	if u, err = f.getUserConfigWithLock(); err != nil {
	} else if u == nil {
		err = NoUserConfigError{}
	} else {
		u.SetDevice(did)
		f.setUserConfigWithLock(u, true)
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
		G.Log.Debug("| SetUserConfig(nil)")
		f.jw.DeleteKey("current_user")
		f.userConfigWrapper.userConfig = nil
		return f.flush()
	}

	parent := f.jw.AtKey("users")
	un := u.GetUsername()
	G.Log.Debug("| SetUserConfig(%s)", un)
	if parent.IsNil() {
		parent = jsonw.NewDictionary()
		f.jw.SetKey("users", parent)
		f.dirty = true
	}
	if parent.AtKey(un.String()).IsNil() || overwrite {
		uWrapper, err := jsonw.NewObjectWrapper(*u)
		if err != nil {
			return err
		}
		parent.SetKey(un.String(), uWrapper)
		f.userConfigWrapper.userConfig = u
		f.dirty = true
	}

	if !f.getCurrentUser().Eq(un) {
		f.jw.SetKey("current_user", jsonw.NewString(un.String()))
		f.userConfigWrapper.userConfig = nil
		f.dirty = true
	}

	return f.Write()
}

func (f *JSONConfigFile) DeleteAtPath(p string) {
	f.jw.DeleteValueAtPath(p)
	f.flush()
}

func (f *JSONConfigFile) Reset() {
	f.jw = jsonw.NewDictionary()
	f.flush()
}

func (f *JSONConfigFile) flush() error {
	f.dirty = true
	return f.Write()
}

func (f *JSONConfigFile) Write() error {
	return f.MaybeSave(true, 0)
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
func (f JSONConfigFile) GetSecretKeyringTemplate() string {
	return f.GetTopLevelString("secret_keyring")
}
func (f JSONConfigFile) GetSessionFilename() string {
	return f.GetTopLevelString("session_file")
}
func (f JSONConfigFile) GetDbFilename() string {
	return f.GetTopLevelString("db")
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
	if s, isSet := f.GetStringAtPath("run-mode"); isSet {
		ret, err = StringToRunMode(s)
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

func (f JSONConfigFile) GetProxy() string {
	return f.GetTopLevelString("proxy")
}
func (f JSONConfigFile) GetDebug() (bool, bool) {
	return f.GetTopLevelBool("debug")
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

func (f JSONConfigFile) getCacheSize(w string) (int, bool) {
	return f.jw.AtPathGetInt(w)
}

func (f JSONConfigFile) GetUserCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.users")
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

func (f JSONConfigFile) GetMerkleKIDs() []string {
	if f.jw == nil {
		return nil
	}

	v, err := f.jw.AtKey("keys").AtKey("merkle").ToArray()
	if err != nil || v == nil {
		return nil
	}

	l, err := v.Len()
	if err != nil {
		return nil
	}

	if l == 0 {
		return nil
	}

	ret := make([]string, l)
	for i := 0; i < l; i++ {
		s, err := v.AtIndex(i).GetString()
		if err != nil {
			return nil
		}
		ret[i] = s
	}
	return ret
}

func (f JSONConfigFile) GetGpgHome() (ret string) {
	ret, _ = f.GetStringAtPath("gpg.home")
	return ret
}

func (f JSONConfigFile) GetBundledCA(host string) (ret string) {
	var err error
	f.jw.AtKey("bundled_CAs").AtKey(host).GetStringVoid(&ret, &err)
	if err == nil {
		G.Log.Debug("Read bundled CA for %s", host)
	}
	return ret
}

func (f JSONConfigFile) GetSocketFile() string {
	return f.GetTopLevelString("socket_file")
}
func (f JSONConfigFile) GetPidFile() string {
	return f.GetTopLevelString("pid_file")
}
func (f JSONConfigFile) GetDaemonPort() (int, bool) {
	return f.GetIntAtPath("daemon_port")
}

func (f JSONConfigFile) GetProxyCACerts() (ret []string, err error) {
	jw := f.jw.AtKey("proxyCAs")
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
func (f JSONConfigFile) GetSplitLogOutput() (bool, bool) {
	return f.GetTopLevelBool("split_log_output")
}
