package libkb

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"unicode"
)

type HomeGetter func() string

type Base struct {
	appName string
	getHome HomeGetter
	dev bool
}

type HomeFinder interface {
	CacheDir() string
	ConfigDir() string
	Home(emptyOk bool) string
	DataDir() string
	RuntimeDir() (string, error)
	Normalize(s string) string
	LogDir() string
	ChdirDir() (string, error)
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
	return x.Join(prfx, x.appName)
}

func (x XdgPosix) ConfigDir() string { return x.dirHelper("XDG_CONFIG_HOME", ".config") }
func (x XdgPosix) CacheDir() string  { return x.dirHelper("XDG_CACHE_HOME", ".cache") }
func (x XdgPosix) DataDir() string   { return x.dirHelper("XDG_DATA_HOME", ".local", "share") }

func (x XdgPosix) xdgRuntimeDir() string { return os.Getenv("XDG_RUNTIME_DIR") }

func (x XdgPosix) RuntimeDir() (ret string, err error) {
	ret = x.xdgRuntimeDir()
	if len(ret) != 0 {
	} else {
		ret = x.ConfigDir()
	}
	return
}

func (x XdgPosix) ChdirDir() (ret string, err error) {
	ret = x.xdgRuntimeDir()
	if len(ret) == 0 {
		ret, err = ioutil.TempDir("", "keybase_server")
	}
	return
}

func (x XdgPosix) LogDir() string {
	ret := x.xdgRuntimeDir()
	if len(ret) != 0 {
		return ret
	}
	return x.CacheDir()
}

type Darwin struct {
	Base
}

func (d Darwin) dirName(s string) string {
	a := []rune(s)
	a[0] = unicode.ToUpper(a[0]) // Ensure directory name is capitalized
	return string(a)
}

func (d Darwin) homeDir(prefixDirs ...string) string {
	dir := d.Home(false)
	var dirs []string
	dirs = append([]string{dir}, prefixDirs...)

	var appName = d.dirName(d.appName)
	if d.dev {
		appName = fmt.Sprintf("%sDev", appName)
	}
	dirs = append(dirs, appName)
	return filepath.Join(dirs...)
}

func (d Darwin) CacheDir() string             { return d.homeDir("Library", "Caches") }
func (d Darwin) ConfigDir() string            { return d.homeDir("Library", "Application Support") }
func (d Darwin) DataDir() string              { return d.ConfigDir() }
func (d Darwin) RuntimeDir() (string, error)  { return d.ConfigDir(), nil }
func (d Darwin) ChdirDir() (string, error)    { return d.RuntimeDir() }
func (d Darwin) LogDir() string               { return d.homeDir("Library", "Logs") }

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

func (w Win32) CacheDir() string            { return w.Home(false) }
func (w Win32) ConfigDir() string           { return w.Home(false) }
func (w Win32) DataDir() string             { return w.Home(false) }
func (w Win32) RuntimeDir() (string, error) { return w.Home(false), nil }
func (w Win32) ChdirDir() (string, error)   { return w.RuntimeDir() }
func (w Win32) LogDir() string              { return w.Home(false) }

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

func NewHomeFinder(appName string, getHome HomeGetter, dev bool) HomeFinder {
	if runtime.GOOS == "windows" {
		return Win32{Base{appName, getHome, dev}}
	} else if runtime.GOOS == "darwin" {
	  return Darwin{Base{appName, getHome, dev}}
  } else {
    return XdgPosix{Base{appName, getHome, dev}}
  }
}
