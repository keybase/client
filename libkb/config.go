package libkb

import (
	"fmt"
	"sync"

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

func (f JsonConfigFile) getValueAtPath(
	p string, getter valueGetter) (ret interface{}, is_set bool) {
	is_set = false
	var err error
	ret, err = getter(f.jw.AtPath(p))
	if err == nil {
		is_set = true
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

func (f JsonConfigFile) GetStringAtPath(p string) (ret string, is_set bool) {
	i, is_set := f.getValueAtPath(p, getString)
	if is_set {
		ret = i.(string)
	}
	return
}

func (f JsonConfigFile) GetBoolAtPath(p string) (ret bool, is_set bool) {
	i, is_set := f.getValueAtPath(p, getBool)
	if is_set {
		ret = i.(bool)
	}
	return
}

func (f JsonConfigFile) GetIntAtPath(p string) (ret int, is_set bool) {
	i, is_set := f.getValueAtPath(p, getInt)
	if is_set {
		ret = i.(int)
	}
	return
}

func (f JsonConfigFile) GetNullAtPath(p string) (is_set bool) {
	is_set = false
	w := f.jw.AtPath(p)
	is_set = w.IsNil() && w.Error() == nil
	return
}

func (f JsonConfigFile) GetTopLevelString(s string) (ret string) {
	var e error
	f.jw.AtKey(s).GetStringVoid(&ret, &e)
	G.Log.Debug("Config: mapping %s -> %s", s, ret)
	return
}

func (f JsonConfigFile) GetTopLevelBool(s string) (res bool, is_set bool) {
	is_set = false
	res = false
	if w := f.jw.AtKey(s); !w.IsNil() {
		is_set = true
		var e error
		w.GetBoolVoid(&res, &e)
	}
	return
}

func (f *JsonConfigFile) setValueAtPath(
	p string, getter valueGetter, v interface{}) (err error) {
	existing, err := getter(f.jw.AtPath(p))

	if err != nil || existing != v {
		err = f.jw.SetValueAtPath(p, jsonw.NewWrapper(v))
		if err == nil {
			f.dirty = true
		}
	}
	return
}

func (f *JsonConfigFile) SetStringAtPath(p string, v string) (err error) {
	return f.setValueAtPath(p, getString, v)
}

func (f *JsonConfigFile) SetBoolAtPath(p string, v bool) (err error) {
	return f.setValueAtPath(p, getBool, v)
}

func (f *JsonConfigFile) SetIntAtPath(p string, v int) (err error) {
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

func (f JsonConfigFile) GetUserConfig() (ret *UserConfig, err error) {
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

// GetUserConfigForUsername sees if there's a UserConfig object for the given
// username previously stored.
func (f JsonConfigFile) GetUserConfigForUsername(s string) (ret *UserConfig, err error) {
	return ImportUserConfigFromJsonWrapper(f.jw.AtKey("users").AtKey(s))
}

// SetUIDVerified flips the "uid_verified" flag on our UserConfig to true
func (f *JsonConfigFile) SetUIDVerified() (err error) {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()

	var u *UserConfig
	if u, err = f.getUserConfigWithLock(); err != nil {
	} else if u == nil {
		err = NoUserConfigError{}
	} else {
		u.UidVerified = true
		f.setUserConfigWithLock(u, true)
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
func (f *JsonConfigFile) SetUserConfig(u *UserConfig, overwrite bool) (err error) {
	f.userConfigWrapper.Lock()
	defer f.userConfigWrapper.Unlock()
	return f.setUserConfigWithLock(u, overwrite)
}

func (f *JsonConfigFile) setUserConfigWithLock(u *UserConfig, overwrite bool) (err error) {

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

func (f JsonConfigFile) GetHome() (ret string) {
	return f.GetTopLevelString("home")
}
func (f JsonConfigFile) GetServerUri() (ret string) {
	return f.GetTopLevelString("server")
}
func (f JsonConfigFile) GetConfigFilename() (ret string) {
	return f.GetTopLevelString("config")
}
func (f JsonConfigFile) GetSecretKeyringTemplate() string {
	return f.GetTopLevelString("secret_keyring")
}
func (f JsonConfigFile) GetSessionFilename() (ret string) {
	return f.GetTopLevelString("session")
}
func (f JsonConfigFile) GetDbFilename() (ret string) {
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
func (f JsonConfigFile) GetLocalRpcDebug() string {
	return f.GetTopLevelString("local_rpc_debug")
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
		ret := make([]string, 0, l)
		for i := 0; i < l; i++ {
			if s, e := v.AtIndex(i).GetString(); e != nil {
				ret = append(ret, s)
			}
		}
	}
	return ret
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
func (f JsonConfigFile) GetUID() (ret *UID) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		tmp := uc.GetUID()
		ret = &tmp
	}
	return ret
}
func (f JsonConfigFile) GetVerifiedUID() (ret *UID) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetVerifiedUID()
	}
	return ret
}
func (f JsonConfigFile) GetDeviceID() (ret *DeviceID) {
	if uc, _ := f.GetUserConfig(); uc != nil {
		ret = uc.GetDeviceID()
	}
	return ret
}

func (f JsonConfigFile) GetProxy() (ret string) {
	return f.GetTopLevelString("proxy")
}
func (f JsonConfigFile) GetDebug() (bool, bool) {
	return f.GetTopLevelBool("debug")
}
func (f JsonConfigFile) GetPlainLogging() (bool, bool) {
	return f.GetTopLevelBool("plain_logging")
}
func (f JsonConfigFile) GetStandalone() (bool, bool) {
	return f.GetTopLevelBool("standalone")
}

func (f JsonConfigFile) GetCacheSize(w string) (ret int, ok bool) {
	ret, ok = f.jw.AtPathGetInt(w)
	return
}

func (f JsonConfigFile) GetUserCacheSize() (ret int, ok bool) {
	return f.GetCacheSize("cache.limits.users")
}
func (f JsonConfigFile) GetProofCacheSize() (ret int, ok bool) {
	return f.GetCacheSize("cache.limits.proofs")
}

func (f JsonConfigFile) GetMerkleKeyFingerprints() []string {
	if f.jw == nil {
		return nil
	} else if v, err := f.jw.AtKey("keys").AtKey("merkle").ToArray(); err != nil || v == nil {
		return nil
	} else if l, err := v.Len(); err != nil {
		return nil
	} else if l == 0 {
		return make([]string, 0, 0)
	} else {
		ret := make([]string, 0, l)
		for i := 0; i < l; i++ {
			if s, err := v.AtIndex(i).GetString(); err != nil {
				return nil
			} else {
				ret = append(ret, s)
			}
		}
		return ret
	}
}

func (f JsonConfigFile) GetPgpDir() (ret string) {
	ret = f.GetTopLevelString("pgpdir")
	if len(ret) == 0 {
		ret = f.GetTopLevelString("gpgdir")
	}
	if len(ret) == 0 {
		ret = f.GetTopLevelString("gnupgdir")
	}
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
func (f JsonConfigFile) GetDaemonPort() (int, bool) {
	return f.GetIntAtPath("daemon_port")
}
