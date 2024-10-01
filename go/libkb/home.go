// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/keybase/client/go/protocol/keybase1"
)

type ConfigGetter func() string
type RunModeGetter func() RunMode
type EnvGetter func(s string) string

type Base struct {
	appName             string
	getHomeFromCmd      ConfigGetter
	getHomeFromConfig   ConfigGetter
	getMobileSharedHome ConfigGetter
	getRunMode          RunModeGetter
	getLog              LogGetter
	getenvFunc          EnvGetter
}

type HomeFinder interface {
	CacheDir() string
	SharedCacheDir() string
	ConfigDir() string
	DownloadsDir() string
	Home(emptyOk bool) string
	MobileSharedHome(emptyOk bool) string
	DataDir() string
	SharedDataDir() string
	RuntimeDir() string
	Normalize(s string) string
	LogDir() string
	ServiceSpawnDir() (string, error)
	SandboxCacheDir() string // For macOS
	InfoDir() string
	IsNonstandardHome() (bool, error)
}

func (b Base) getHome() string {
	if b.getHomeFromCmd != nil {
		ret := b.getHomeFromCmd()
		if ret != "" {
			return ret
		}
	}
	if b.getHomeFromConfig != nil {
		ret := b.getHomeFromConfig()
		if ret != "" {
			return ret
		}
	}
	return ""
}

func (b Base) IsNonstandardHome() (bool, error) {
	return false, fmt.Errorf("unsupported on %s", runtime.GOOS)
}

func (b Base) getenv(s string) string {
	if b.getenvFunc != nil {
		return b.getenvFunc(s)
	}
	return os.Getenv(s)
}

func (b Base) Join(elem ...string) string { return filepath.Join(elem...) }

type XdgPosix struct {
	Base
}

func (x XdgPosix) Normalize(s string) string { return s }

func (x XdgPosix) Home(emptyOk bool) string {
	ret := x.getHome()
	if len(ret) == 0 && !emptyOk {
		ret = x.getenv("HOME")
	}
	if ret == "" {
		return ""
	}
	resolved, err := filepath.Abs(ret)
	if err != nil {
		return ret
	}
	return resolved
}

// IsNonstandardHome is true if the home directory gleaned via cmdline,
// env, or config is different from that in /etc/passwd.
func (x XdgPosix) IsNonstandardHome() (bool, error) {
	passed := x.Home(false)
	if passed == "" {
		return false, nil
	}
	passwd, err := user.Current()
	if err != nil {
		return false, err
	}
	passwdAbs, err := filepath.Abs(passwd.HomeDir)
	if err != nil {
		return false, err
	}
	passedAbs, err := filepath.Abs(passed)
	if err != nil {
		return false, err
	}
	return passedAbs != passwdAbs, nil
}

func (x XdgPosix) MobileSharedHome(emptyOk bool) string {
	return x.Home(emptyOk)
}

func (x XdgPosix) dirHelper(xdgEnvVar string, prefixDirs ...string) string {
	appName := x.appName
	if x.getRunMode() != ProductionRunMode {
		appName = appName + "." + string(x.getRunMode())
	}

	isNonstandard, isNonstandardErr := x.IsNonstandardHome()
	xdgSpecified := x.getenv(xdgEnvVar)

	// If the user specified a nonstandard home directory, or there's no XDG
	// environment variable present, use the home directory from the
	// commandline/environment/config.
	if (isNonstandardErr == nil && isNonstandard) || xdgSpecified == "" {
		alternateDir := x.Join(append([]string{x.Home(false)}, prefixDirs...)...)
		return x.Join(alternateDir, appName)
	}

	// Otherwise, use the XDG standard.
	return x.Join(xdgSpecified, appName)
}

func (x XdgPosix) ConfigDir() string       { return x.dirHelper("XDG_CONFIG_HOME", ".config") }
func (x XdgPosix) CacheDir() string        { return x.dirHelper("XDG_CACHE_HOME", ".cache") }
func (x XdgPosix) SharedCacheDir() string  { return x.CacheDir() }
func (x XdgPosix) SandboxCacheDir() string { return "" } // Unsupported
func (x XdgPosix) DataDir() string         { return x.dirHelper("XDG_DATA_HOME", ".local", "share") }
func (x XdgPosix) SharedDataDir() string   { return x.DataDir() }
func (x XdgPosix) DownloadsDir() string {
	xdgSpecified := x.getenv("XDG_DOWNLOAD_DIR")
	if xdgSpecified != "" {
		return xdgSpecified
	}
	return filepath.Join(x.Home(false), "Downloads")
}
func (x XdgPosix) RuntimeDir() string { return x.dirHelper("XDG_RUNTIME_DIR", ".config") }
func (x XdgPosix) InfoDir() string    { return x.RuntimeDir() }

func (x XdgPosix) ServiceSpawnDir() (ret string, err error) {
	ret = x.RuntimeDir()
	if len(ret) == 0 {
		ret, err = os.MkdirTemp("", "keybase_service")
	}
	return
}

func (x XdgPosix) LogDir() string {
	// There doesn't seem to be an official place for logs in the XDG spec, but
	// according to http://stackoverflow.com/a/27965014/823869 at least, this
	// is the best compromise.
	return x.CacheDir()
}

type Darwin struct {
	Base
	forceIOS bool // for testing
}

func toUpper(s string) string {
	if s == "" {
		return s
	}
	a := []rune(s)
	a[0] = unicode.ToUpper(a[0])
	return string(a)
}

func (d Darwin) isIOS() bool {
	return isIOS || d.forceIOS
}

func (d Darwin) appDir(dirs ...string) string {
	appName := toUpper(d.appName)
	runMode := d.getRunMode()
	if runMode != ProductionRunMode {
		appName += toUpper(string(runMode))
	}
	dirs = append(dirs, appName)
	return filepath.Join(dirs...)
}

func (d Darwin) sharedHome() string {
	homeDir := d.Home(false)
	if d.isIOS() {
		// check if we have a shared container path, and if so, that is where the shared home is.
		sharedHome := d.getMobileSharedHome()
		if len(sharedHome) > 0 {
			homeDir = sharedHome
		}
	}
	return homeDir
}

func (d Darwin) CacheDir() string {
	return d.appDir(d.Home(false), "Library", "Caches")
}

func (d Darwin) SharedCacheDir() string {
	return d.appDir(d.sharedHome(), "Library", "Caches")
}

func (d Darwin) SandboxCacheDir() string {
	if d.isIOS() {
		return ""
	}
	return d.CacheDir()
	// The container name "keybase" is the group name specified in the entitlement for sandboxed extensions
	// Note: this was added for kbfs finder integration, which was never activated.
	// keybased.sock and kbfsd.sock live in this directory.
	// return d.appDir(d.Home(false), "Library", "keybase", "Library", "Caches")
}
func (d Darwin) ConfigDir() string {
	return d.appDir(d.sharedHome(), "Library", "Application Support")
}
func (d Darwin) DataDir() string {
	return d.appDir(d.Home(false), "Library", "Application Support")
}
func (d Darwin) SharedDataDir() string {
	return d.appDir(d.sharedHome(), "Library", "Application Support")
}
func (d Darwin) RuntimeDir() string               { return d.CacheDir() }
func (d Darwin) ServiceSpawnDir() (string, error) { return d.RuntimeDir(), nil }
func (d Darwin) LogDir() string {
	appName := toUpper(d.appName)
	runMode := d.getRunMode()
	dirs := []string{d.Home(false), "Library", "Logs"}
	if runMode != ProductionRunMode {
		dirs = append(dirs, appName+toUpper(string(runMode)))
	}
	return filepath.Join(dirs...)
}

func (d Darwin) InfoDir() string {
	// If the user is explicitly passing in a HomeDirectory, make the PID file directory
	// local to that HomeDir. This way it's possible to have multiple keybases in parallel
	// running for a given run mode, without having to explicitly specify a PID file.
	if d.getHome() != "" {
		return d.CacheDir()
	}
	return d.appDir(os.TempDir())
}

func (d Darwin) DownloadsDir() string {
	return filepath.Join(d.Home(false), "Downloads")
}

func (d Darwin) Home(emptyOk bool) string {
	ret := d.getHome()
	if len(ret) == 0 && !emptyOk {
		ret = d.getenv("HOME")
	}
	return ret
}

func (d Darwin) MobileSharedHome(emptyOk bool) string {
	var ret string
	if d.getMobileSharedHome != nil {
		ret = d.getMobileSharedHome()
	}
	if len(ret) == 0 && !emptyOk {
		ret = d.getenv("MOBILE_SHARED_HOME")
	}
	return ret
}

func (d Darwin) Normalize(s string) string { return s }

type Win32 struct {
	Base
}

var win32SplitRE = regexp.MustCompile(`[/\\]`)

func (w Win32) Split(s string) []string {
	return win32SplitRE.Split(s, -1)
}

func (w Win32) Unsplit(v []string) string {
	if len(v) > 0 && len(v[0]) == 0 {
		v2 := make([]string, len(v))
		copy(v2, v)
		v[0] = string(filepath.Separator)
	}
	result := filepath.Join(v...)
	// filepath.Join doesn't add a separator on Windows after the drive
	if len(v) > 0 && result[len(v[0])] != filepath.Separator {
		v = append(v[:1], v...)
		v[1] = string(filepath.Separator)
		result = filepath.Join(v...)
	}
	return result
}

func (w Win32) Normalize(s string) string {
	return w.Unsplit(w.Split(s))
}

func (w Win32) CacheDir() string                 { return w.Home(false) }
func (w Win32) SharedCacheDir() string           { return w.CacheDir() }
func (w Win32) SandboxCacheDir() string          { return "" } // Unsupported
func (w Win32) ConfigDir() string                { return w.Home(false) }
func (w Win32) DataDir() string                  { return w.Home(false) }
func (w Win32) SharedDataDir() string            { return w.DataDir() }
func (w Win32) RuntimeDir() string               { return w.Home(false) }
func (w Win32) InfoDir() string                  { return w.RuntimeDir() }
func (w Win32) ServiceSpawnDir() (string, error) { return w.RuntimeDir(), nil }
func (w Win32) LogDir() string                   { return w.Home(false) }

func (w Win32) deriveFromTemp() (ret string) {
	tmp := w.getenv("TEMP")
	if len(tmp) == 0 {
		w.getLog().Info("No 'TEMP' environment variable found")
		tmp = w.getenv("TMP")
		if len(tmp) == 0 {
			w.getLog().Fatalf("No 'TMP' environment variable found")
		}
	}
	v := w.Split(tmp)
	if len(v) < 2 {
		w.getLog().Fatalf("Bad 'TEMP' variable found, no directory separators!")
	}
	last := strings.ToLower(v[len(v)-1])
	rest := v[0 : len(v)-1]
	if last != "temp" && last != "tmp" {
		w.getLog().Warning("TEMP directory didn't end in \\Temp: %s", last)
	}
	if strings.ToLower(rest[len(rest)-1]) == "local" {
		rest[len(rest)-1] = "Roaming"
	}
	ret = w.Unsplit(rest)
	return
}

func (w Win32) DownloadsDir() string {
	// Prefer to use USERPROFILE instead of w.Home() because the latter goes
	// into APPDATA.
	user, err := user.Current()
	if err != nil {
		return filepath.Join(w.Home(false), "Downloads")
	}
	return filepath.Join(user.HomeDir, "Downloads")
}

func (w Win32) Home(emptyOk bool) string {
	ret := w.getHome()
	if len(ret) == 0 && !emptyOk {
		ret, _ = LocalDataDir()
		if len(ret) == 0 {
			w.getLog().Info("APPDATA environment variable not found")
		}

	}
	if len(ret) == 0 && !emptyOk {
		ret = w.deriveFromTemp()
	}

	packageName := "Keybase"

	if w.getRunMode() == DevelRunMode || w.getRunMode() == StagingRunMode {
		runModeName := string(w.getRunMode())
		if runModeName != "" {
			// Capitalize the first letter
			r, n := utf8.DecodeRuneInString(runModeName)
			runModeName = string(unicode.ToUpper(r)) + runModeName[n:]
			packageName += runModeName
		}
	}

	ret = filepath.Join(ret, packageName)

	return ret
}

func (w Win32) MobileSharedHome(emptyOk bool) string {
	return w.Home(emptyOk)
}

func NewHomeFinder(appName string, getHomeFromCmd ConfigGetter, getHomeFromConfig ConfigGetter, getMobileSharedHome ConfigGetter,
	osname string, getRunMode RunModeGetter, getLog LogGetter, getenv EnvGetter) HomeFinder {
	base := Base{appName, getHomeFromCmd, getHomeFromConfig, getMobileSharedHome, getRunMode, getLog, getenv}
	switch runtimeGroup(osname) {
	case keybase1.RuntimeGroup_WINDOWSLIKE:
		return Win32{base}
	case keybase1.RuntimeGroup_DARWINLIKE:
		return Darwin{Base: base}
	default:
		return XdgPosix{base}
	}
}
