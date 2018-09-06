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
	goos   = runtime.GOOS
	goarch = runtime.GOARCH
)

var cmdInit = &command{
	run:   runInit,
	Name:  "init",
	Usage: "[-ndk dir] [-openal dir]",
	Short: "install NDK toolchains and build OpenAL for Android",
	Long: `
If the -ndk flag is specified or the Android NDK is installed at
$ANDROID_HOME/ndk-bundle, init will create NDK standalone toolchains
for Android targets.

If a OpenAL source directory is specified with -openal, init will
build an Android version of OpenAL for use with gomobile build
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

	// Make sure gobind is up to date.
	if err := goInstall([]string{"golang.org/x/mobile/cmd/gobind"}, nil); err != nil {
		return err
	}

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
		}
		if initOpenAL != "" {
			var err error
			if initOpenAL, err = filepath.Abs(initOpenAL); err != nil {
				return err
			}
		}
	}
	if err := envInit(); err != nil {
		return err
	}

	start := time.Now()

	if err := installNDKToolchains(gomobilepath); err != nil {
		return err
	}

	if err := installOpenAL(gomobilepath); err != nil {
		return err
	}

	if buildV {
		took := time.Since(start) / time.Second * time.Second
		fmt.Fprintf(os.Stderr, "\nDone, build took %s.\n", took)
	}
	return nil
}

func installNDKToolchains(gomobilepath string) error {
	if initNDK == "" {
		return nil
	}
	toolsDir := filepath.Join(initNDK, "prebuilt", archNDK(), "bin")
	py27 := filepath.Join(toolsDir, "python2.7")
	for _, arch := range allArchs {
		t := ndk[arch]
		// Split android-XX to get the api version.
		platform := strings.SplitN(t.platform, "-", 2)
		api := platform[1]
		cmd := exec.Command(py27,
			"build/tools/make_standalone_toolchain.py",
			"--arch="+t.arch,
			"--api="+api,
			"--install-dir="+filepath.Join(gomobilepath, "ndk-toolchains", t.arch))
		cmd.Dir = initNDK
		if err := runCmd(cmd); err != nil {
			return err
		}
	}
	return nil
}

func installOpenAL(gomobilepath string) error {
	if initOpenAL == "" {
		return nil
	}
	if !hasNDK() {
		return errors.New("The Android NDK is needed to build OpenAL but it was not found. Please run gomobile init with the ndk-bundle installed through the Android SDK manager or with the -ndk flag set.")
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

	for _, arch := range allArchs {
		t := ndk[arch]
		abi := t.arch
		if abi == "arm" {
			abi = "armeabi"
		}
		tcPath := filepath.Join(gomobilepath, "ndk-toolchains", t.arch, "bin")
		make := filepath.Join(tcPath, "make")
		// Split android-XX to get the api version.
		buildDir := alTmpDir + "/build/" + abi
		if err := mkdir(buildDir); err != nil {
			return err
		}
		cmd := exec.Command(cmake,
			initOpenAL,
			"-DCMAKE_TOOLCHAIN_FILE="+initOpenAL+"/XCompile-Android.txt",
			"-DHOST="+t.toolPrefix)
		cmd.Dir = buildDir
		if !buildN {
			orgPath := os.Getenv("PATH")
			cmd.Env = []string{"PATH=" + tcPath + string(os.PathListSeparator) + orgPath}
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
