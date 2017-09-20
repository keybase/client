package main

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// General mobile build environment. Initialized by envInit.
var (
	cwd          string
	gomobilepath string // $GOPATH/pkg/gomobile

	androidEnv map[string][]string // android arch -> []string

	darwinArmEnv   []string
	darwinArm64Env []string
	darwin386Env   []string
	darwinAmd64Env []string

	androidArmNM string
	darwinArmNM  string

	ndkRoot string

	archs = []string{"arm", "arm64", "386", "amd64"}
)

func buildEnvInit() (cleanup func(), err error) {
	// Find gomobilepath.
	gopath := goEnv("GOPATH")
	for _, p := range filepath.SplitList(gopath) {
		gomobilepath = filepath.Join(p, "pkg", "gomobile")
		if _, err := os.Stat(gomobilepath); buildN || err == nil {
			break
		}
	}

	if buildX {
		fmt.Fprintln(xout, "GOMOBILE="+gomobilepath)
	}

	// Check the toolchain is in a good state.
	// Pick a temporary directory for assembling an apk/app.
	if gomobilepath == "" {
		return nil, errors.New("toolchain not installed, run `gomobile init`")
	}

	// Read the NDK root path stored by gomobile init -ndk, if any.
	if !buildN {
		root, err := ioutil.ReadFile(filepath.Join(gomobilepath, "android_ndk_root"))
		if err != nil && !os.IsNotExist(err) {
			return nil, err
		}
		ndkRoot = string(root)
		if ndkRoot != "" {
			if _, err := os.Stat(filepath.Join(ndkRoot, "toolchains")); err != nil {
				if os.IsNotExist(err) {
					return nil, fmt.Errorf("The ndk path %q doesn't exist. Please re-run gomobile with the ndk-bundle install through the Android SDK manager or with the -ndk flag set.", ndkRoot)
				}
				return nil, err
			}
		}
	}
	if err := envInit(); err != nil {
		return nil, err
	}

	cleanupFn := func() {
		if buildWork {
			fmt.Printf("WORK=%s\n", tmpdir)
			return
		}
		removeAll(tmpdir)
	}
	if buildN {
		tmpdir = "$WORK"
		cleanupFn = func() {}
	} else {
		verpath := filepath.Join(gomobilepath, "version")
		installedVersion, err := ioutil.ReadFile(verpath)
		if err != nil {
			return nil, errors.New("toolchain partially installed, run `gomobile init`")
		}
		if !bytes.Equal(installedVersion, goVersionOut) {
			return nil, errors.New("toolchain out of date, run `gomobile init`")
		}

		tmpdir, err = ioutil.TempDir("", "gomobile-work-")
		if err != nil {
			return nil, err
		}
	}
	if buildX {
		fmt.Fprintln(xout, "WORK="+tmpdir)
	}

	return cleanupFn, nil
}

func envInit() (err error) {
	// TODO(crawshaw): cwd only used by ctx.Import, which can take "."
	cwd, err = os.Getwd()
	if err != nil {
		return err
	}

	// Setup the cross-compiler environments.

	if ndkRoot != "" {
		androidEnv = make(map[string][]string)
		for arch, toolchain := range ndk {
			// Emulate the flags in the clang wrapper scripts generated
			// by make_standalone_toolchain.py
			s := strings.SplitN(toolchain.toolPrefix, "-", 3)
			a, os, env := s[0], s[1], s[2]
			if a == "arm" {
				a = "armv7a"
			}
			target := strings.Join([]string{a, "none", os, env}, "-")
			sysroot := filepath.Join(ndkRoot, "platforms", toolchain.platform, "arch-"+toolchain.arch)
			gcctoolchain := filepath.Join(ndkRoot, "toolchains", toolchain.gcc, "prebuilt", archNDK())
			flags := fmt.Sprintf("-target %s --sysroot %s -gcc-toolchain %s", target, sysroot, gcctoolchain)
			cflags := fmt.Sprintf("%s -I%s/include", flags, gomobilepath)
			ldflags := fmt.Sprintf("%s -L%s/usr/lib -L%s/lib/%s", flags, sysroot, gomobilepath, arch)
			androidEnv[arch] = []string{
				"GOOS=android",
				"GOARCH=" + arch,
				"CC=" + toolchain.Path("clang"),
				"CXX=" + toolchain.Path("clang++"),
				"CGO_CFLAGS=" + cflags,
				"CGO_CPPFLAGS=" + cflags,
				"CGO_LDFLAGS=" + ldflags,
				"CGO_ENABLED=1",
			}
			if arch == "arm" {
				androidEnv[arch] = append(androidEnv[arch], "GOARM=7")
			}
		}
	}

	if !xcodeAvailable() {
		return nil
	}

	clang, cflags, err := envClang("iphoneos")
	if err != nil {
		return err
	}
	darwinArmEnv = []string{
		"GOOS=darwin",
		"GOARCH=arm",
		"GOARM=7",
		"CC=" + clang,
		"CXX=" + clang,
		"CGO_CFLAGS=" + cflags + " -miphoneos-version-min=6.1 -arch " + archClang("arm"),
		"CGO_LDFLAGS=" + cflags + " -miphoneos-version-min=6.1 -arch " + archClang("arm"),
		"CGO_ENABLED=1",
	}
	darwinArmNM = "nm"
	darwinArm64Env = []string{
		"GOOS=darwin",
		"GOARCH=arm64",
		"CC=" + clang,
		"CXX=" + clang,
		"CGO_CFLAGS=" + cflags + " -miphoneos-version-min=6.1 -arch " + archClang("arm64"),
		"CGO_LDFLAGS=" + cflags + " -miphoneos-version-min=6.1 -arch " + archClang("arm64"),
		"CGO_ENABLED=1",
	}

	clang, cflags, err = envClang("iphonesimulator")
	if err != nil {
		return err
	}
	darwin386Env = []string{
		"GOOS=darwin",
		"GOARCH=386",
		"CC=" + clang,
		"CXX=" + clang,
		"CGO_CFLAGS=" + cflags + " -mios-simulator-version-min=6.1 -arch " + archClang("386"),
		"CGO_LDFLAGS=" + cflags + " -mios-simulator-version-min=6.1 -arch " + archClang("386"),
		"CGO_ENABLED=1",
	}
	darwinAmd64Env = []string{
		"GOOS=darwin",
		"GOARCH=amd64",
		"CC=" + clang,
		"CXX=" + clang,
		"CGO_CFLAGS=" + cflags + " -mios-simulator-version-min=6.1 -arch x86_64",
		"CGO_LDFLAGS=" + cflags + " -mios-simulator-version-min=6.1 -arch x86_64",
		"CGO_ENABLED=1",
	}

	return nil
}

func envClang(sdkName string) (clang, cflags string, err error) {
	if buildN {
		return "clang-" + sdkName, "-isysroot=" + sdkName, nil
	}
	cmd := exec.Command("xcrun", "--sdk", sdkName, "--find", "clang")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", "", fmt.Errorf("xcrun --find: %v\n%s", err, out)
	}
	clang = strings.TrimSpace(string(out))

	cmd = exec.Command("xcrun", "--sdk", sdkName, "--show-sdk-path")
	out, err = cmd.CombinedOutput()
	if err != nil {
		return "", "", fmt.Errorf("xcrun --show-sdk-path: %v\n%s", err, out)
	}
	sdk := strings.TrimSpace(string(out))

	return clang, "-isysroot " + sdk, nil
}

func archClang(goarch string) string {
	switch goarch {
	case "arm":
		return "armv7"
	case "arm64":
		return "arm64"
	case "386":
		return "i386"
	case "amd64":
		return "x86_64"
	default:
		panic(fmt.Sprintf("unknown GOARCH: %q", goarch))
	}
}

// environ merges os.Environ and the given "key=value" pairs.
// If a key is in both os.Environ and kv, kv takes precedence.
func environ(kv []string) []string {
	cur := os.Environ()
	new := make([]string, 0, len(cur)+len(kv))

	envs := make(map[string]string, len(cur))
	for _, ev := range cur {
		elem := strings.SplitN(ev, "=", 2)
		if len(elem) != 2 || elem[0] == "" {
			// pass the env var of unusual form untouched.
			// e.g. Windows may have env var names starting with "=".
			new = append(new, ev)
			continue
		}
		if goos == "windows" {
			elem[0] = strings.ToUpper(elem[0])
		}
		envs[elem[0]] = elem[1]
	}
	for _, ev := range kv {
		elem := strings.SplitN(ev, "=", 2)
		if len(elem) != 2 || elem[0] == "" {
			panic(fmt.Sprintf("malformed env var %q from input", ev))
		}
		if goos == "windows" {
			elem[0] = strings.ToUpper(elem[0])
		}
		envs[elem[0]] = elem[1]
	}
	for k, v := range envs {
		new = append(new, k+"="+v)
	}
	return new
}

func getenv(env []string, key string) string {
	prefix := key + "="
	for _, kv := range env {
		if strings.HasPrefix(kv, prefix) {
			return kv[len(prefix):]
		}
	}
	return ""
}

func pkgdir(env []string) string {
	return gomobilepath + "/pkg_" + getenv(env, "GOOS") + "_" + getenv(env, "GOARCH")
}

func archNDK() string {
	if runtime.GOOS == "windows" && runtime.GOARCH == "386" {
		return "windows"
	} else {
		var arch string
		switch runtime.GOARCH {
		case "386":
			arch = "x86"
		case "amd64":
			arch = "x86_64"
		default:
			panic("unsupported GOARCH: " + runtime.GOARCH)
		}
		return runtime.GOOS + "-" + arch
	}
}

type ndkToolchain struct {
	arch       string
	abi        string
	platform   string
	gcc        string
	toolPrefix string
}

func (tc *ndkToolchain) Path(toolName string) string {
	// The nm tool is located in the GCC directory structure.
	isUtil := toolName == "nm"
	if goos == "windows" {
		toolName += ".exe"
	}
	path := filepath.Join(ndkRoot, "toolchains")
	if isUtil {
		toolName = tc.toolPrefix + "-" + toolName
		path = filepath.Join(path, tc.gcc)
	} else {
		path = filepath.Join(path, "llvm")
	}
	path = filepath.Join(path, "prebuilt")
	return filepath.Join(path, archNDK(), "bin", toolName)
}

type ndkConfig map[string]ndkToolchain // map: GOOS->androidConfig.

func (nc ndkConfig) Toolchain(arch string) ndkToolchain {
	tc, ok := nc[arch]
	if !ok {
		panic(`unsupported architecture: ` + arch)
	}
	return tc
}

var ndk = ndkConfig{
	"arm": {
		arch:       "arm",
		abi:        "armeabi-v7a",
		platform:   "android-15",
		gcc:        "arm-linux-androideabi-4.9",
		toolPrefix: "arm-linux-androideabi",
	},
	"arm64": {
		arch:       "arm64",
		abi:        "arm64-v8a",
		platform:   "android-21",
		gcc:        "aarch64-linux-android-4.9",
		toolPrefix: "aarch64-linux-android",
	},

	"386": {
		arch:       "x86",
		abi:        "x86",
		platform:   "android-15",
		gcc:        "x86-4.9",
		toolPrefix: "i686-linux-android",
	},
	"amd64": {
		arch:       "x86_64",
		abi:        "x86_64",
		platform:   "android-21",
		gcc:        "x86_64-4.9",
		toolPrefix: "x86_64-linux-android",
	},
}

func xcodeAvailable() bool {
	_, err := exec.LookPath("xcrun")
	return err == nil
}
