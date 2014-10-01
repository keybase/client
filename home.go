
package libkb

import (
	"path/filepath"
	"os"
	"regexp"
	"strings"
	"runtime"
	"log"
)

type HomeGetter func() string

type Base struct {
	appName string
	getHome HomeGetter
}

type HomeFinder interface {
	CacheDir() string
	ConfigDir() string
	Home(emptyOk bool) string
	DataDir() string
	Normalize(s string) string
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

func (x XdgPosix) dirHelper(env string, prefix_dirs ...string) string {
	var prfx string
	prfx = os.Getenv(env)
	if len(prfx) == 0 {
		h := x.Home(false)
		v := append([]string { h }, prefix_dirs...)
		prfx = x.Join(v...)
	}
	return x.Join(prfx, x.appName)
}

func (x XdgPosix) ConfigDir() string { return x.dirHelper("XDG_CONFIG_HOME", ".config") }
func (x XdgPosix) CacheDir()  string { return x.dirHelper("XDG_CACHE_HOME", ".cache") }
func (x XdgPosix) DataDir()   string { return x.dirHelper("XDG_DATA_HOME", ".local", "share") }

type Win32 struct {
	Base
}

func (w Win32) Split(s string) []string {
	rxx := regexp.MustCompile(`[/\\]`)
	return rxx.Split(s,-1)
}

func (w Win32) Normalize(s string) string {
	return w.Unsplit(w.Split(s))
}

func (w Win32) CacheDir()  string { return w.Home(false); }
func (w Win32) ConfigDir() string { return w.Home(false); }
func (w Win32) DataDir()   string { return w.Home(false); }

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
		rest := v[0:len(v)-1]
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

func NewHomeFinder(appName string, getHome HomeGetter) HomeFinder {
	if runtime.GOOS == "windows" {
		return Win32 { Base { appName, getHome }}
	} else {
		return XdgPosix { Base { appName, getHome }}
	}
}

