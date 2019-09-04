// Copyright 2015 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"errors"
	"fmt"
	"go/build"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"path/filepath"
)

// ctx, pkg, tmpdir in build.go

var cmdBind = &command{
	run:   runBind,
	Name:  "bind",
	Usage: "[-target android|ios] [-bootclasspath <path>] [-classpath <path>] [-o output] [build flags] [package]",
	Short: "build a library for Android and iOS",
	Long: `
Bind generates language bindings for the package named by the import
path, and compiles a library for the named target system.

The -target flag takes a target system name, either android (the
default) or ios.

For -target android, the bind command produces an AAR (Android ARchive)
file that archives the precompiled Java API stub classes, the compiled
shared libraries, and all asset files in the /assets subdirectory under
the package directory. The output is named '<package_name>.aar' by
default. This AAR file is commonly used for binary distribution of an
Android library project and most Android IDEs support AAR import. For
example, in Android Studio (1.2+), an AAR file can be imported using
the module import wizard (File > New > New Module > Import .JAR or
.AAR package), and setting it as a new dependency
(File > Project Structure > Dependencies).  This requires 'javac'
(version 1.7+) and Android SDK (API level 15 or newer) to build the
library for Android. The environment variable ANDROID_HOME must be set
to the path to Android SDK. Use the -javapkg flag to specify the Java
package prefix for the generated classes.

By default, -target=android builds shared libraries for all supported
instruction sets (arm, arm64, 386, amd64). A subset of instruction sets
can be selected by specifying target type with the architecture name. E.g.,
-target=android/arm,android/386.

For -target ios, gomobile must be run on an OS X machine with Xcode
installed. The generated Objective-C types can be prefixed with the -prefix
flag.

For -target android, the -bootclasspath and -classpath flags are used to
control the bootstrap classpath and the classpath for Go wrappers to Java
classes.

The -v flag provides verbose output, including the list of packages built.

The build flags -a, -n, -x, -gcflags, -ldflags, -tags, and -work
are shared with the build command. For documentation, see 'go help build'.
`,
}

func runBind(cmd *command) error {
	cleanup, err := buildEnvInit()
	if err != nil {
		return err
	}
	defer cleanup()

	args := cmd.flag.Args()

	targetOS, targetArchs, err := parseBuildTarget(buildTarget)
	if err != nil {
		return fmt.Errorf(`invalid -target=%q: %v`, buildTarget, err)
	}

	oldCtx := ctx
	defer func() {
		ctx = oldCtx
	}()
	ctx.GOARCH = "arm"
	ctx.GOOS = targetOS

	if bindJavaPkg != "" && ctx.GOOS != "android" {
		return fmt.Errorf("-javapkg is supported only for android target")
	}
	if bindPrefix != "" && ctx.GOOS != "darwin" {
		return fmt.Errorf("-prefix is supported only for ios target")
	}

	if ctx.GOOS == "android" {
		if _, err := ndkRoot(); err != nil {
			return err
		}
	}

	if ctx.GOOS == "darwin" {
		ctx.BuildTags = append(ctx.BuildTags, "ios")
	}

	var gobind string
	if !buildN {
		gobind, err = exec.LookPath("gobind")
		if err != nil {
			return errors.New("gobind was not found. Please run gomobile init before trying again.")
		}
	} else {
		gobind = "gobind"
	}

	var pkgs []*build.Package
	switch len(args) {
	case 0:
		pkgs = make([]*build.Package, 1)
		pkgs[0], err = ctx.ImportDir(cwd, build.ImportComment)
	default:
		pkgs, err = importPackages(args)
	}
	if err != nil {
		return err
	}

	// check if any of the package is main
	for _, pkg := range pkgs {
		if pkg.Name == "main" {
			return fmt.Errorf("binding 'main' package (%s) is not supported", pkg.ImportComment)
		}
	}

	switch targetOS {
	case "android":
		return goAndroidBind(gobind, pkgs, targetArchs)
	case "darwin":
		if !xcodeAvailable() {
			return fmt.Errorf("-target=ios requires XCode")
		}
		return goIOSBind(gobind, pkgs, targetArchs)
	default:
		return fmt.Errorf(`invalid -target=%q`, buildTarget)
	}
}

func importPackages(args []string) ([]*build.Package, error) {
	pkgs := make([]*build.Package, len(args))
	for i, a := range args {
		a = path.Clean(a)
		var err error
		if pkgs[i], err = ctx.Import(a, cwd, build.ImportComment); err != nil {
			return nil, fmt.Errorf("package %q: %v", a, err)
		}
	}
	return pkgs, nil
}

var (
	bindPrefix        string // -prefix
	bindJavaPkg       string // -javapkg
	bindClasspath     string // -classpath
	bindBootClasspath string // -bootclasspath
)

func init() {
	// bind command specific commands.
	cmdBind.flag.StringVar(&bindJavaPkg, "javapkg", "",
		"specifies custom Java package path prefix. Valid only with -target=android.")
	cmdBind.flag.StringVar(&bindPrefix, "prefix", "",
		"custom Objective-C name prefix. Valid only with -target=ios.")
	cmdBind.flag.StringVar(&bindClasspath, "classpath", "", "The classpath for imported Java classes. Valid only with -target=android.")
	cmdBind.flag.StringVar(&bindBootClasspath, "bootclasspath", "", "The bootstrap classpath for imported Java classes. Valid only with -target=android.")
}

func bootClasspath() (string, error) {
	if bindBootClasspath != "" {
		return bindBootClasspath, nil
	}
	apiPath, err := androidAPIPath()
	if err != nil {
		return "", err
	}
	return filepath.Join(apiPath, "android.jar"), nil
}

func copyFile(dst, src string) error {
	if buildX {
		printcmd("cp %s %s", src, dst)
	}
	return writeFile(dst, func(w io.Writer) error {
		if buildN {
			return nil
		}
		f, err := os.Open(src)
		if err != nil {
			return err
		}
		defer f.Close()

		if _, err := io.Copy(w, f); err != nil {
			return fmt.Errorf("cp %s %s failed: %v", src, dst, err)
		}
		return nil
	})
}

func writeFile(filename string, generate func(io.Writer) error) error {
	if buildV {
		fmt.Fprintf(os.Stderr, "write %s\n", filename)
	}

	err := mkdir(filepath.Dir(filename))
	if err != nil {
		return err
	}

	if buildN {
		return generate(ioutil.Discard)
	}

	f, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := f.Close(); err == nil {
			err = cerr
		}
	}()

	return generate(f)
}
