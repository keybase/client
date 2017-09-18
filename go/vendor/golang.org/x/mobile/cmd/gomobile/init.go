// Copyright 2015 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

var (
	goos    = runtime.GOOS
	goarch  = runtime.GOARCH
	ndkarch string
)

func init() {
	switch runtime.GOARCH {
	case "amd64":
		ndkarch = "x86_64"
	case "386":
		ndkarch = "x86"
	default:
		ndkarch = runtime.GOARCH
	}
}

var cmdInit = &command{
	run:   runInit,
	Name:  "init",
	Usage: "[-u]",
	Short: "install mobile compiler toolchain",
	Long: `
Init builds copies of the Go standard library for mobile devices.
It uses Xcode, if available, to build for iOS and uses the Android
NDK from the ndk-bundle SDK package or from the -ndk flag, to build
for Android.
If a OpenAL source directory is specified with -openal, init will
also build an Android version of OpenAL for use with gomobile build
and gomobile install.
`,
}

var (
	initNDK    string // -ndk
	initOpenAL string // -openal
)

func init() {
	cmdInit.flag.StringVar(&initNDK, "ndk", "", "Android NDK path")
	cmdInit.flag.StringVar(&initOpenAL, "openal", "", "OpenAL source path")
}

func runInit(cmd *command) error {
	gopaths := filepath.SplitList(goEnv("GOPATH"))
	if len(gopaths) == 0 {
		return fmt.Errorf("GOPATH is not set")
	}
	gomobilepath = filepath.Join(gopaths[0], "pkg/gomobile")

	verpath := filepath.Join(gomobilepath, "version")
	if buildX || buildN {
		fmt.Fprintln(xout, "GOMOBILE="+gomobilepath)
	}
	removeAll(gomobilepath)

	if err := mkdir(gomobilepath); err != nil {
		return err
	}

	if buildN {
		tmpdir = filepath.Join(gomobilepath, "work")
	} else {
		var err error
		tmpdir, err = ioutil.TempDir(gomobilepath, "work-")
		if err != nil {
			return err
		}
	}
	if buildX || buildN {
		fmt.Fprintln(xout, "WORK="+tmpdir)
	}
	defer func() {
		if buildWork {
			fmt.Printf("WORK=%s\n", tmpdir)
			return
		}
		removeAll(tmpdir)
	}()

	if buildN {
		initNDK = "$NDK_PATH"
		initOpenAL = "$OPENAL_PATH"
	} else {
		toolsDir := filepath.Join("prebuilt", archNDK(), "bin")
		// Try the ndk-bundle SDK package package, if installed.
		if initNDK == "" {
			if sdkHome := os.Getenv("ANDROID_HOME"); sdkHome != "" {
				path := filepath.Join(sdkHome, "ndk-bundle")
				if st, err := os.Stat(filepath.Join(path, toolsDir)); err == nil && st.IsDir() {
					initNDK = path
				}
			}
		}
		if initNDK != "" {
			var err error
			if initNDK, err = filepath.Abs(initNDK); err != nil {
				return err
			}
			// Check if the platform directory contains a known subdirectory.
			if _, err := os.Stat(filepath.Join(initNDK, toolsDir)); err != nil {
				if os.IsNotExist(err) {
					return fmt.Errorf("%q does not point to an Android NDK.", initNDK)
				}
				return err
			}
			ndkFile := filepath.Join(gomobilepath, "android_ndk_root")
			if err := ioutil.WriteFile(ndkFile, []byte(initNDK), 0644); err != nil {
				return err
			}
		}
		if initOpenAL != "" {
			var err error
			if initOpenAL, err = filepath.Abs(initOpenAL); err != nil {
				return err
			}
		}
	}
	ndkRoot = initNDK
	if err := envInit(); err != nil {
		return err
	}

	if runtime.GOOS == "darwin" {
		// Install common x/mobile packages for local development.
		// These are often slow to compile (due to cgo) and easy to forget.
		//
		// Limited to darwin for now as it is common for linux to
		// not have GLES installed.
		//
		// TODO: consider testing GLES installation and suggesting it here
		for _, pkg := range commonPkgs {
			if err := installPkg(pkg, nil); err != nil {
				return err
			}
		}
	}

	// Install standard libraries for cross compilers.
	start := time.Now()
	// Ideally this would be -buildmode=c-shared.
	// https://golang.org/issue/13234.
	androidArgs := []string{"-gcflags=-shared", "-ldflags=-shared"}
	for _, arch := range archs {
		env := androidEnv[arch]
		if err := installStd(env, androidArgs...); err != nil {
			return err
		}
	}

	if err := installDarwin(); err != nil {
		return err
	}

	if err := installOpenAL(gomobilepath); err != nil {
		return err
	}

	if buildX || buildN {
		printcmd("go version > %s", verpath)
	}
	if !buildN {
		if err := ioutil.WriteFile(verpath, goVersionOut, 0644); err != nil {
			return err
		}
	}
	if buildV {
		took := time.Since(start) / time.Second * time.Second
		fmt.Fprintf(os.Stderr, "\nDone, build took %s.\n", took)
	}
	return nil
}

func installOpenAL(gomobilepath string) error {
	if ndkRoot == "" || initOpenAL == "" {
		return nil
	}
	var cmake string
	if buildN {
		cmake = "cmake"
	} else {
		sdkRoot := os.Getenv("ANDROID_HOME")
		if sdkRoot == "" {
			return nil
		}
		var err error
		cmake, err = exec.LookPath("cmake")
		if err != nil {
			cmakePath := filepath.Join(sdkRoot, "cmake")
			cmakeDir, err := os.Open(cmakePath)
			if err != nil {
				if os.IsNotExist(err) {
					// Skip OpenAL install if the cmake package is not installed.
					return errors.New("cmake was not found in the PATH. Please install it through the Android SDK manager.")
				}
				return err
			}
			defer cmakeDir.Close()
			// There might be multiple versions of CMake installed. Use any one for now.
			cmakeVers, err := cmakeDir.Readdirnames(1)
			if err != nil || len(cmakeVers) == 0 {
				return errors.New("cmake was not found in the PATH. Please install it through the Android SDK manager.")
			}
			cmake = filepath.Join(cmakePath, cmakeVers[0], "bin", "cmake")
		}
	}
	var alTmpDir string
	if buildN {
		alTmpDir = filepath.Join(gomobilepath, "work")
	} else {
		var err error
		alTmpDir, err = ioutil.TempDir(gomobilepath, "openal-release-")
		if err != nil {
			return err
		}
		defer removeAll(alTmpDir)
	}

	for _, f := range []string{"include/AL/al.h", "include/AL/alc.h"} {
		dst := filepath.Join(gomobilepath, f)
		src := filepath.Join(initOpenAL, f)
		if err := copyFile(dst, src); err != nil {
			return err
		}
	}

	toolsDir := filepath.Join(ndkRoot, "prebuilt", archNDK(), "bin")
	py27 := filepath.Join(toolsDir, "python2.7")
	var make string
	if !buildN && runtime.GOOS == "windows" {
		var err error
		make, err = exec.LookPath("nmake")
		if err != nil {
			return nil
		}
	} else {
		make = filepath.Join(toolsDir, "make")
	}
	for _, arch := range archs {
		t := ndk[arch]
		abi := t.arch
		if abi == "arm" {
			abi = "armeabi"
		}
		// Split android-XX to get the api version.
		platform := strings.SplitN(t.platform, "-", 2)
		api := platform[1]
		buildDir := alTmpDir + "/build/" + abi
		toolchain := buildDir + "/toolchain"
		// standalone ndk toolchains make openal-soft's build config easier.
		cmd := exec.Command(py27,
			"build/tools/make_standalone_toolchain.py",
			"--arch="+t.arch,
			"--api="+api,
			"--install-dir="+toolchain)
		cmd.Dir = ndkRoot
		if err := runCmd(cmd); err != nil {
			return err
		}

		cmd = exec.Command(cmake,
			initOpenAL,
			"-DCMAKE_TOOLCHAIN_FILE="+initOpenAL+"/XCompile-Android.txt",
			"-DHOST="+t.toolPrefix)
		cmd.Dir = buildDir
		orgPath := os.Getenv("PATH")
		if !buildN {
			cmd.Env = []string{"PATH=" + toolchain + "/bin" + string(os.PathListSeparator) + orgPath}
		}
		if err := runCmd(cmd); err != nil {
			return err
		}

		cmd = exec.Command(make)
		cmd.Dir = buildDir
		if err := runCmd(cmd); err != nil {
			return err
		}

		dst := filepath.Join(gomobilepath, "lib", t.abi, "libopenal.so")
		src := filepath.Join(alTmpDir, "build", abi, "libopenal.so")
		if err := copyFile(dst, src); err != nil {
			return err
		}
	}
	return nil
}

var commonPkgs = []string{
	"golang.org/x/mobile/gl",
	"golang.org/x/mobile/app",
	"golang.org/x/mobile/exp/app/debug",
}

func installDarwin() error {
	if !xcodeAvailable() {
		return nil
	}
	if err := installStd(darwinArmEnv); err != nil {
		return err
	}
	if err := installStd(darwinArm64Env); err != nil {
		return err
	}
	// TODO(crawshaw): darwin/386 for the iOS simulator?
	if err := installStd(darwinAmd64Env, "-tags=ios"); err != nil {
		return err
	}
	return nil
}

func installStd(env []string, args ...string) error {
	return installPkg("std", env, args...)
}

func installPkg(pkg string, env []string, args ...string) error {
	tOS, tArch, pd := getenv(env, "GOOS"), getenv(env, "GOARCH"), pkgdir(env)
	if tOS != "" && tArch != "" {
		if buildV {
			fmt.Fprintf(os.Stderr, "\n# Installing %s for %s/%s.\n", pkg, tOS, tArch)
		}
		args = append(args, "-pkgdir="+pd)
	} else {
		if buildV {
			fmt.Fprintf(os.Stderr, "\n# Installing %s.\n", pkg)
		}
	}

	cmd := exec.Command("go", "install")
	cmd.Args = append(cmd.Args, args...)
	if buildV {
		cmd.Args = append(cmd.Args, "-v")
	}
	if buildX {
		cmd.Args = append(cmd.Args, "-x")
	}
	if buildWork {
		cmd.Args = append(cmd.Args, "-work")
	}
	cmd.Args = append(cmd.Args, pkg)
	cmd.Env = append([]string{}, env...)
	return runCmd(cmd)
}

func mkdir(dir string) error {
	if buildX || buildN {
		printcmd("mkdir -p %s", dir)
	}
	if buildN {
		return nil
	}
	return os.MkdirAll(dir, 0755)
}

func symlink(src, dst string) error {
	if buildX || buildN {
		printcmd("ln -s %s %s", src, dst)
	}
	if buildN {
		return nil
	}
	if goos == "windows" {
		return doCopyAll(dst, src)
	}
	return os.Symlink(src, dst)
}

func rm(name string) error {
	if buildX || buildN {
		printcmd("rm %s", name)
	}
	if buildN {
		return nil
	}
	return os.Remove(name)
}

func doCopyAll(dst, src string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, errin error) (err error) {
		if errin != nil {
			return errin
		}
		prefixLen := len(src)
		if len(path) > prefixLen {
			prefixLen++ // file separator
		}
		outpath := filepath.Join(dst, path[prefixLen:])
		if info.IsDir() {
			return os.Mkdir(outpath, 0755)
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.OpenFile(outpath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, info.Mode())
		if err != nil {
			return err
		}
		defer func() {
			if errc := out.Close(); err == nil {
				err = errc
			}
		}()
		_, err = io.Copy(out, in)
		return err
	})
}

func removeAll(path string) error {
	if buildX || buildN {
		printcmd(`rm -r -f "%s"`, path)
	}
	if buildN {
		return nil
	}

	// os.RemoveAll behaves differently in windows.
	// http://golang.org/issues/9606
	if goos == "windows" {
		resetReadOnlyFlagAll(path)
	}

	return os.RemoveAll(path)
}

func resetReadOnlyFlagAll(path string) error {
	fi, err := os.Stat(path)
	if err != nil {
		return err
	}
	if !fi.IsDir() {
		return os.Chmod(path, 0666)
	}
	fd, err := os.Open(path)
	if err != nil {
		return err
	}
	defer fd.Close()

	names, _ := fd.Readdirnames(-1)
	for _, name := range names {
		resetReadOnlyFlagAll(path + string(filepath.Separator) + name)
	}
	return nil
}

func goEnv(name string) string {
	if val := os.Getenv(name); val != "" {
		return val
	}
	val, err := exec.Command("go", "env", name).Output()
	if err != nil {
		panic(err) // the Go tool was tested to work earlier
	}
	return strings.TrimSpace(string(val))
}

func runCmd(cmd *exec.Cmd) error {
	if buildX || buildN {
		dir := ""
		if cmd.Dir != "" {
			dir = "PWD=" + cmd.Dir + " "
		}
		env := strings.Join(cmd.Env, " ")
		if env != "" {
			env += " "
		}
		printcmd("%s%s%s", dir, env, strings.Join(cmd.Args, " "))
	}

	buf := new(bytes.Buffer)
	buf.WriteByte('\n')
	if buildV {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	} else {
		cmd.Stdout = buf
		cmd.Stderr = buf
	}

	if buildWork {
		if goos == "windows" {
			cmd.Env = append(cmd.Env, `TEMP=`+tmpdir)
			cmd.Env = append(cmd.Env, `TMP=`+tmpdir)
		} else {
			cmd.Env = append(cmd.Env, `TMPDIR=`+tmpdir)
		}
	}

	if !buildN {
		cmd.Env = environ(cmd.Env)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("%s failed: %v%s", strings.Join(cmd.Args, " "), err, buf)
		}
	}
	return nil
}
