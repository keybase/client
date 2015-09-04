package libkb

import (
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"
)

type ConfigGetter func() string
type RunModeGetter func() RunMode

type Base struct {
	appName    string
	getHome    ConfigGetter
	getRunMode RunModeGetter
}

type HomeFinder interface {
	CacheDir() string
	ConfigDir() string
	Home(emptyOk bool) string
	DataDir() string
	RuntimeDir() string
	Normalize(s string) string
	LogDir() string
	ServiceSpawnDir() (string, error)
}

func (b Base) Unsplit(v []string) string {
	if len(v) > 0 && len(v[0]) == 0 {
		v2 := make([]string, len(v))
		copy(v2, v)
		v[0] = string(filepath.Separator)
	}
	return filepath.Join(v...)
}

func (b Base) Join(elem ...string) string { return filepath.Join(elem...) }

type XdgPosix struct {
	Base
}

func (x XdgPosix) Normalize(s string) string { return s }

func (x XdgPosix) Home(emptyOk bool) string {
	var ret string
	if x.getHome != nil {
		ret = x.getHome()
	}
	if len(ret) == 0 && !emptyOk {
		ret = os.Getenv("HOME")
	}
	return ret
}

func (x XdgPosix) dirHelper(env string, prefixDirs ...string) string {
	var prfx string
	prfx = os.Getenv(env)
	if len(prfx) == 0 {
		h := x.Home(false)
		v := append([]string{h}, prefixDirs...)
		prfx = x.Join(v...)
	}
	appName := x.appName
	if x.getRunMode() != ProductionRunMode {
		appName = appName + "." + string(x.getRunMode())
	}
	return x.Join(prfx, appName)
}

func (x XdgPosix) ConfigDir() string { return x.dirHelper("XDG_CONFIG_HOME", ".config") }
func (x XdgPosix) CacheDir() string  { return x.dirHelper("XDG_CACHE_HOME", ".cache") }
func (x XdgPosix) DataDir() string   { return x.dirHelper("XDG_DATA_HOME", ".local", "share") }

func (x XdgPosix) xdgRuntimeDir() string { return os.Getenv("XDG_RUNTIME_DIR") }

func (x XdgPosix) RuntimeDir() string {
	ret := x.xdgRuntimeDir()
	if len(ret) != 0 {
		return ret
	}
	return x.ConfigDir()
}

func (x XdgPosix) ServiceSpawnDir() (ret string, err error) {
	ret = x.xdgRuntimeDir()
	if len(ret) == 0 {
		ret, err = ioutil.TempDir("", "keybase_service")
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
}

func toUpper(s string) string {
	if s == "" {
		return s
	}
	a := []rune(s)
	a[0] = unicode.ToUpper(a[0])
	return string(a)
}

func (d Darwin) homeDir(dirs ...string) string {
	appName := toUpper(d.appName)
	runMode := d.getRunMode()
	if runMode != ProductionRunMode {
		appName = appName + toUpper(string(runMode))
	}
	dirs = append(dirs, appName)
	return filepath.Join(dirs...)
}

func (d Darwin) CacheDir() string                 { return d.homeDir(d.Home(false), "Library", "Caches") }
func (d Darwin) ConfigDir() string                { return d.homeDir(d.Home(false), "Library", "Application Support") }
func (d Darwin) DataDir() string                  { return d.ConfigDir() }
func (d Darwin) RuntimeDir() string               { return d.ConfigDir() }
func (d Darwin) ServiceSpawnDir() (string, error) { return d.RuntimeDir(), nil }
func (d Darwin) LogDir() string                   { return d.homeDir(d.Home(false), "Library", "Logs") }

func (d Darwin) Home(emptyOk bool) string {
	var ret string
	if d.getHome != nil {
		ret = d.getHome()
	}
	if len(ret) == 0 && !emptyOk {
		ret = os.Getenv("HOME")
	}
	return ret
}

func (d Darwin) Normalize(s string) string { return s }

type Win32 struct {
	Base
}

func (w Win32) Split(s string) []string {
	rxx := regexp.MustCompile(`[/\\]`)
	return rxx.Split(s, -1)
}

func (w Win32) Normalize(s string) string {
	return w.Unsplit(w.Split(s))
}

func (w Win32) CacheDir() string                 { return w.Home(false) }
func (w Win32) ConfigDir() string                { return w.Home(false) }
func (w Win32) DataDir() string                  { return w.Home(false) }
func (w Win32) RuntimeDir() string               { return w.Home(false) }
func (w Win32) ServiceSpawnDir() (string, error) { return w.RuntimeDir(), nil }
func (w Win32) LogDir() string                   { return w.Home(false) }

func (w Win32) Home(emptyOk bool) string {
	var ret string

	if w.getHome != nil {
		ret = w.getHome()
	}
	if len(ret) == 0 && !emptyOk {
		tmp := os.Getenv("TEMP")
		if len(tmp) == 0 {
			log.Fatalf("No 'TEMP' environment variable found")
		}
		v := w.Split(tmp)
		if len(v) < 2 {
			log.Fatalf("Bad 'TEMP' variable found, no directory separators!")
		}
		last := strings.ToLower(v[len(v)-1])
		rest := v[0 : len(v)-1]
		if last != "temp" && last != "tmp" {
			log.Fatalf("TEMP directory didn't end in \\Temp")
		}
		if strings.ToLower(rest[len(rest)-1]) == "local" {
			rest[len(rest)-1] = "Roaming"
		}
		ret = w.Unsplit(rest)
	}
	return ret
}

func NewHomeFinder(appName string, getHome ConfigGetter, osname string, getRunMode RunModeGetter) HomeFinder {
	if osname == "windows" {
		return Win32{Base{appName, getHome, getRunMode}}
	} else if osname == "darwin" {
		return Darwin{Base{appName, getHome, getRunMode}}
	} else {
		return XdgPosix{Base{appName, getHome, getRunMode}}
	}
}
