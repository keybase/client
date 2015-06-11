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

type JsonConfigFile struct {
	*JsonFile
	userConfigWrapper *UserConfigWrapper
}

func NewJsonConfigFile(s string) *JsonConfigFile {
	return &JsonConfigFile{NewJsonFile(s, "config"), &UserConfigWrapper{}}
}

type valueGetter func(*jsonw.Wrapper) (interface{}, error)

func (f JsonConfigFile) getValueAtPath(p string, getter valueGetter) (ret interface{}, isSet bool) {
	var err error
	ret, err = getter(f.jw.AtPath(p))
	if err == nil {
		isSet = true
	}
	return
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

func (f JsonConfigFile) GetFilename() string {
	return f.filename
}

func (f JsonConfigFile) GetStringAtPath(p string) (ret string, isSet bool) {
	i, isSet := f.getValueAtPath(p, getString)
	if isSet {
		ret = i.(string)
	}
	return
}

func (f JsonConfigFile) GetBoolAtPath(p string) (ret bool, isSet bool) {
	i, isSet := f.getValueAtPath(p, getBool)
	if isSet {
		ret = i.(bool)
	}
	return
}

func (f JsonConfigFile) GetIntAtPath(p string) (ret int, isSet bool) {
	i, isSet := f.getValueAtPath(p, getInt)
	if isSet {
		ret = i.(int)
	}
	return
}

func (f JsonConfigFile) GetNullAtPath(p string) (isSet bool) {
	w := f.jw.AtPath(p)
	isSet = w.IsNil() && w.Error() == nil
	return
}

func (f JsonConfigFile) GetDurationAtPath(p string) (time.Duration, bool) {
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

func (f JsonConfigFile) GetTopLevelString(s string) (ret string) {
	var e error
	f.jw.AtKey(s).GetStringVoid(&ret, &e)
	G.Log.Debug("Config: mapping %s -> %s", s, ret)
	return
}

func (f JsonConfigFile) GetTopLevelBool(s string) (res, isSet bool) {
	if w := f.jw.AtKey(s); !w.IsNil() {
		isSet = true
		var e error
		w.GetBoolVoid(&res, &e)
	}
	return
}

func (f *JsonConfigFile) setValueAtPath(p string, getter valueGetter, v interface{}) error {
	existing, err := getter(f.jw.AtPath(p))

	if err != nil || existing != v {
		err = f.jw.SetValueAtPath(p, jsonw.NewWrapper(v))
		if err == nil {
			f.dirty = true
		}
	}
	return err
}

func (f *JsonConfigFile) SetStringAtPath(p string, v string) error {
	return f.setValueAtPath(p, getString, v)
}

func (f *JsonConfigFile) SetBoolAtPath(p string, v bool) error {
	return f.setValueAtPath(p, getBool, v)
}

func (f *JsonConfigFile) SetIntAtPath(p string, v int) error {
	return f.setValueAtPath(p, getInt, v)
}

func (f *JsonConfigFile) SetNullAtPath(p string) (err error) {
	existing := f.jw.AtPath(p)
	if !existing.IsNil() || existing.Error() != nil {
		err = f.jw.SetValueAtPath(p, jsonw.NewNil())
		if err == nil {
			f.dirty = true
		}
	}
	return
}

func (f JsonConfigFile) GetUserConfig() (*UserConfig, error) {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	return f.getUserConfigWithLock()
}

// GetUserConfig looks for the `current_user` field to see if there's
// a corresponding user object in the `users` table. There really should be.
func (f JsonConfigFile) getUserConfigWithLock() (ret *UserConfig, err error) {

	var s string
	if ret = f.userConfigWrapper.userConfig; ret != nil {
		return
	}
	if s, err = f.jw.AtKey("current_user").GetString(); err != nil {
		return
	}
	if ret, err = f.GetUserConfigForUsername(s); err != nil {
		return
	} else if ret != nil {
		f.userConfigWrapper.userConfig = ret
	} else {
		err = ConfigError{f.filename,
			fmt.Sprintf("Didn't find a UserConfig for %s", s)}
	}
	return
}

func (f *JsonConfigFile) SwitchUser(un string) error {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()

	if cu := f.getCurrentUser(); cu == un {
		G.Log.Debug("| Already configured as user=%s", un)
		return nil
	}

	if f.jw.AtKey("users").AtKey(un).IsNil() {
		return UserNotFoundError{msg: un}
	}

	f.jw.SetKey("current_user", jsonw.NewString(un))
	f.userConfigWrapper.userConfig = nil
	f.dirty = true
	return nil
}

// GetUserConfigForUsername sees if there's a UserConfig object for the given
// username previously stored.
func (f JsonConfigFile) GetUserConfigForUsername(s string) (*UserConfig, error) {
	return ImportUserConfigFromJsonWrapper(f.jw.AtKey("users").AtKey(s))
}

func (f JsonConfigFile) GetAllUsernames() (current string, others []string, err error) {
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
		if name != current {
			others = append(others, name)
		}
	}
	return
}

// SetDeviceID sets the device field of the UserConfig object
func (f *JsonConfigFile) SetDeviceID(did *DeviceID) (err error) {
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

func (f *JsonConfigFile) getCurrentUser() string {
	s, _ := f.jw.AtKey("current_user").GetString()
	return s
}

// SetUserConfig writes this UserConfig to the config file and updates the
// currently active UserConfig in memory.  If the given UserConfig is nil, then
// just empty everything out and clear the `current_user` field.  Note that
// we never actually overwrite users.<username>, we just write it if it
// doesn't already exist, and we update the `current_user` pointer.
func (f *JsonConfigFile) SetUserConfig(u *UserConfig, overwrite bool) error {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	return f.setUserConfigWithLock(u, overwrite)
}

func (f *JsonConfigFile) setUserConfigWithLock(u *UserConfig, overwrite bool) error {

	if u == nil {
		G.Log.Debug("| SetUserConfig(nil)")
		f.jw.DeleteKey("current_user")
		f.userConfigWrapper.userConfig = nil
		f.dirty = true
	} else {
		parent := f.jw.AtKey("users")
		un := u.GetUsername()
		G.Log.Debug("| SetUserConfig(%s)", un)
		if parent.IsNil() {
			parent = jsonw.NewDictionary()
			f.jw.SetKey("users", parent)
			f.dirty = true
		}
		if parent.AtKey(un).IsNil() || overwrite {
			parent.SetKey(un, jsonw.NewWrapper(*u))
			f.userConfigWrapper.userConfig = u
			f.dirty = true
		}

		if f.getCurrentUser() != un {
			f.jw.SetKey("current_user", jsonw.NewString(un))
			f.userConfigWrapper.userConfig = nil
			f.dirty = true
		}
	}
	return nil
}

func (f *JsonConfigFile) DeleteAtPath(p string) {
	f.jw.DeleteValueAtPath(p)
	f.dirty = true
}

func (f *JsonConfigFile) Reset() {
	f.jw = jsonw.NewDictionary()
	f.dirty = true
}

func (f *JsonConfigFile) Write() error {
	return f.MaybeSave(true, 0)
}

func (f JsonConfigFile) GetHome() string {
	return f.GetTopLevelString("home")
}
func (f JsonConfigFile) GetServerURI() string {
	return f.GetTopLevelString("server")
}
func (f JsonConfigFile) GetConfigFilename() string {
	return f.GetTopLevelString("config")
}
func (f JsonConfigFile) GetSecretKeyringTemplate() string {
	return f.GetTopLevelString("secret_keyring")
}
func (f JsonConfigFile) GetSessionFilename() string {
	return f.GetTopLevelString("session")
}
func (f JsonConfigFile) GetDbFilename() string {
	return f.GetTopLevelString("db")
}
func (f JsonConfigFile) GetPinentry() string {
	res, _ := f.GetStringAtPath("pinentry.path")
	return res
}
func (f JsonConfigFile) GetGpg() string {
	res, _ := f.GetStringAtPath("gpg.command")
	return res
}
func (f JsonConfigFile) GetLocalRPCDebug() string {
	return f.GetTopLevelString("local_rpc_debug")
}
func (f JsonConfigFile) GetTimers() string {
	return f.GetTopLevelString("timers")
}
func (f JsonConfigFile) GetGpgOptions() []string {
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
func (f JsonConfigFile) GetDevelMode() (bool, bool) {
	return f.GetTopLevelBool("devel")
}
func (f JsonConfigFile) GetGpgDisabled() (bool, bool) {
	return f.GetTopLevelBool("gpg.disabled")
}
func (f JsonConfigFile) GetNoPinentry() (bool, bool) {
	return f.GetBoolAtPath("pinentry.disabled")
}
func (f JsonConfigFile) GetUsername() (ret string) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetUsername()
	}
	return ret
}
func (f JsonConfigFile) GetSalt() (ret []byte) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetSalt()
	}
	return ret
}
func (f JsonConfigFile) GetUID() (ret keybase1.UID) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetUID()
	}
	return ret
}
func (f JsonConfigFile) GetDeviceID() (ret *DeviceID) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetDeviceID()
	}
	return ret
}

func (f JsonConfigFile) GetProxy() string {
	return f.GetTopLevelString("proxy")
}
func (f JsonConfigFile) GetDebug() (bool, bool) {
	return f.GetTopLevelBool("debug")
}
func (f JsonConfigFile) GetAutoFork() (bool, bool) {
	return f.GetTopLevelBool("auto_fork")
}
func (f JsonConfigFile) GetPlainLogging() (bool, bool) {
	return f.GetTopLevelBool("plain_logging")
}
func (f JsonConfigFile) GetStandalone() (bool, bool) {
	return f.GetTopLevelBool("standalone")
}

func (f JsonConfigFile) getCacheSize(w string) (int, bool) {
	return f.jw.AtPathGetInt(w)
}

func (f JsonConfigFile) GetUserCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.users")
}
func (f JsonConfigFile) GetProofCacheSize() (int, bool) {
	return f.getCacheSize("cache.limits.proofs")
}

func (f JsonConfigFile) GetProofCacheLongDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.long_duration.proofs")
}

func (f JsonConfigFile) GetProofCacheMediumDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.medium_duration.proofs")
}

func (f JsonConfigFile) GetProofCacheShortDur() (time.Duration, bool) {
	return f.GetDurationAtPath("cache.short_duration.proofs")
}

func (f JsonConfigFile) GetMerkleKIDs() []string {
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

func (f JsonConfigFile) GetGpgHome() (ret string) {
	ret, _ = f.GetStringAtPath("gpg.home")
	return ret
}

func (f JsonConfigFile) GetBundledCA(host string) (ret string) {
	var err error
	f.jw.AtKey("bundled_CAs").AtKey(host).GetStringVoid(&ret, &err)
	if err == nil {
		G.Log.Debug("Read bundled CA for %s", host)
	}
	return ret
}

func (f JsonConfigFile) GetSocketFile() string {
	return f.GetTopLevelString("socket_file")
}
func (f JsonConfigFile) GetPidFile() string {
	return f.GetTopLevelString("pid_file")
}
func (f JsonConfigFile) GetDaemonPort() (int, bool) {
	return f.GetIntAtPath("daemon_port")
}

func (f JsonConfigFile) GetProxyCACerts() (ret []string, err error) {
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
		err = ConfigError{f.filename, fmt.Sprintf("Can't read Proxy CA certs: %s", e.Error())}
	}
	return
}

func (f JsonConfigFile) GetLogFile() string {
	return f.GetTopLevelString("log_file")
}
func (f JsonConfigFile) GetSplitLogOutput() (bool, bool) {
	return f.GetTopLevelBool("split_log_output")
}
