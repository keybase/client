package main

import (
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

	darwinEnv map[string][]string

	androidArmNM string
	darwinArmNM  string

	allArchs = []string{"arm", "arm64", "386", "amd64"}
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
	if hasNDK() {
		androidEnv = make(map[string][]string)
		for arch, toolchain := range ndk {
			androidEnv[arch] = []string{
				"GOOS=android",
				"GOARCH=" + arch,
				"CC=" + toolchain.Path("clang"),
				"CXX=" + toolchain.Path("clang++"),
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

	darwinArmNM = "nm"
	darwinEnv = make(map[string][]string)
	for _, arch := range allArchs {
		var env []string
		var err error
		var clang, cflags string
		switch arch {
		case "arm":
			env = append(env, "GOARM=7")
			fallthrough
		case "arm64":
			clang, cflags, err = envClang("iphoneos")
			cflags += " -miphoneos-version-min=" + buildIOSVersion
		case "386", "amd64":
			clang, cflags, err = envClang("iphonesimulator")
			cflags += " -mios-simulator-version-min=" + buildIOSVersion
		default:
			panic(fmt.Errorf("unknown GOARCH: %q", arch))
		}
		if err != nil {
			return err
		}
		env = append(env,
			"GOOS=darwin",
			"GOARCH="+arch,
			"CC="+clang,
			"CXX="+clang+"++",
			"CGO_CFLAGS="+cflags+" -arch "+archClang(arch),
			"CGO_CXXFLAGS="+cflags+" -arch "+archClang(arch),
			"CGO_LDFLAGS="+cflags+" -arch "+archClang(arch),
			"CGO_ENABLED=1",
		)
		darwinEnv[arch] = env
	}

	return nil
}

func hasNDK() bool {
	if buildN {
		return true
	}
	tcPath := filepath.Join(gomobilepath, "ndk-toolchains")
	_, err := os.Stat(tcPath)
	return err == nil
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
	return filepath.Join(gomobilepath, "ndk-toolchains", tc.arch, "bin", tc.toolPrefix+"-"+toolName)
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
		platform:   "android-16",
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
		platform:   "android-16",
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
	err := exec.Command("xcrun", "xcodebuild", "-version").Run()
	return err == nil
}
