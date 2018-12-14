// Copyright 2015 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"bytes"
	"errors"
	"fmt"
	"go/ast"
	"go/build"
	"go/importer"
	"go/parser"
	"go/token"
	"go/types"
	"io"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"strings"

	"golang.org/x/mobile/bind"
	"golang.org/x/mobile/internal/importers"
	"golang.org/x/mobile/internal/importers/java"
	"golang.org/x/mobile/internal/importers/objc"
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
to the path to Android SDK. The generated Java class is in the java
package 'go.<package_name>' unless -javapkg flag is specified.

By default, -target=android builds shared libraries for all supported
instruction sets (arm, arm64, 386, amd64). A subset of instruction sets
can be selected by specifying target type with the architecture name. E.g.,
-target=android/arm,android/386.

For -target ios, gomobile must be run on an OS X machine with Xcode
installed. Support is not complete. The generated Objective-C types
are prefixed with 'Go' unless the -prefix flag is provided.

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

	ctx.GOARCH = "arm"
	ctx.GOOS = targetOS

	if ctx.GOOS == "darwin" {
		ctx.BuildTags = append(ctx.BuildTags, "ios")
	}

	if bindJavaPkg != "" && ctx.GOOS != "android" {
		return fmt.Errorf("-javapkg is supported only for android target")
	}
	if bindPrefix != "" && ctx.GOOS != "darwin" {
		return fmt.Errorf("-prefix is supported only for ios target")
	}

	if ctx.GOOS == "android" && ndkRoot == "" {
		return errors.New("no Android NDK path is set. Please run gomobile init with the ndk-bundle installed through the Android SDK manager or with the -ndk flag set.")
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
		return goAndroidBind(pkgs, targetArchs)
	case "darwin":
		// TODO: use targetArchs?
		return goIOSBind(pkgs)
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

type binder struct {
	files []*ast.File
	fset  *token.FileSet
	pkgs  []*types.Package
}

func (b *binder) GenGoSupport(outdir string) error {
	bindPkg, err := ctx.Import("golang.org/x/mobile/bind", "", build.FindOnly)
	if err != nil {
		return err
	}
	return copyFile(filepath.Join(outdir, "seq.go"), filepath.Join(bindPkg.Dir, "seq.go.support"))
}

func (b *binder) GenObjcSupport(outdir string) error {
	objcPkg, err := ctx.Import("golang.org/x/mobile/bind/objc", "", build.FindOnly)
	if err != nil {
		return err
	}
	if err := copyFile(filepath.Join(outdir, "seq_darwin.m"), filepath.Join(objcPkg.Dir, "seq_darwin.m.support")); err != nil {
		return err
	}
	if err := copyFile(filepath.Join(outdir, "seq_darwin.go"), filepath.Join(objcPkg.Dir, "seq_darwin.go.support")); err != nil {
		return err
	}
	if err := copyFile(filepath.Join(outdir, "ref.h"), filepath.Join(objcPkg.Dir, "ref.h")); err != nil {
		return err
	}
	return copyFile(filepath.Join(outdir, "seq.h"), filepath.Join(objcPkg.Dir, "seq.h"))
}

func (b *binder) GenObjc(pkg *types.Package, files []*ast.File, allPkg []*types.Package, outdir string, wrappers []*objc.Named) (string, error) {
	if pkg == nil {
		bindPrefix = ""
	}
	pkgName := ""
	pkgPath := ""
	if pkg != nil {
		pkgName = pkg.Name()
		pkgPath = pkg.Path()
	} else {
		pkgName = "universe"
	}
	bindOption := "-lang=objc"
	if bindPrefix != "" {
		bindOption += fmt.Sprintf(" -prefix=%q", bindPrefix)
	}

	fileBase := bindPrefix + strings.Title(pkgName)
	mfile := filepath.Join(outdir, fileBase+".m")
	hfile := filepath.Join(outdir, fileBase+".objc.h")
	gohfile := filepath.Join(outdir, pkgName+".h")

	var buf bytes.Buffer
	g := &bind.ObjcGen{
		Generator: &bind.Generator{
			Printer: &bind.Printer{Buf: &buf, IndentEach: []byte("\t")},
			Fset:    b.fset,
			AllPkg:  allPkg,
			Pkg:     pkg,
			Files:   files,
		},
		Prefix: bindPrefix,
	}
	g.Init(wrappers)

	generate := func(w io.Writer) error {
		if buildX {
			printcmd("gobind %s -outdir=%s %s", bindOption, outdir, pkgPath)
		}
		if buildN {
			return nil
		}
		buf.Reset()
		if err := g.GenM(); err != nil {
			return err
		}
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(mfile, generate); err != nil {
		return "", err
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		if err := g.GenH(); err != nil {
			return err
		}
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(hfile, generate); err != nil {
		return "", err
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		if err := g.GenGoH(); err != nil {
			return err
		}
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(gohfile, generate); err != nil {
		return "", err
	}

	return fileBase, nil
}

func (b *binder) GenJavaSupport(outdir string) error {
	javaPkg, err := ctx.Import("golang.org/x/mobile/bind/java", "", build.FindOnly)
	if err != nil {
		return err
	}
	if err := copyFile(filepath.Join(outdir, "seq_android.go"), filepath.Join(javaPkg.Dir, "seq_android.go.support")); err != nil {
		return err
	}
	if err := copyFile(filepath.Join(outdir, "seq_android.c"), filepath.Join(javaPkg.Dir, "seq_android.c.support")); err != nil {
		return err
	}
	return copyFile(filepath.Join(outdir, "seq.h"), filepath.Join(javaPkg.Dir, "seq.h"))
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

func GenObjcWrappers(pkgs []*build.Package, srcDir, pkgGen string) ([]*objc.Named, error) {
	refs, err := importers.AnalyzePackages(pkgs, "ObjC/")
	if err != nil {
		return nil, err
	}
	types, err := objc.Import(refs)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	g := &bind.ObjcWrapper{
		Printer: &bind.Printer{
			IndentEach: []byte("\t"),
			Buf:        &buf,
		},
	}
	var genNames []string
	for _, emb := range refs.Embedders {
		genNames = append(genNames, emb.Name)
	}
	g.Init(types, genNames)
	for i, name := range g.Packages() {
		pkgDir := filepath.Join(pkgGen, "src", "ObjC", name)
		if err := os.MkdirAll(pkgDir, 0700); err != nil {
			return nil, err
		}
		pkgFile := filepath.Join(pkgDir, "package.go")
		generate := func(w io.Writer) error {
			if buildN {
				return nil
			}
			buf.Reset()
			g.GenPackage(i)
			_, err := io.Copy(w, &buf)
			return err
		}
		if err := writeFile(pkgFile, generate); err != nil {
			return nil, fmt.Errorf("failed to create the ObjC wrapper package %s: %v", name, err)
		}
	}
	generate := func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		g.GenGo()
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(filepath.Join(srcDir, "interfaces.go"), generate); err != nil {
		return nil, fmt.Errorf("failed to create the ObjC wrapper Go file: %v", err)
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		g.GenInterfaces()
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(filepath.Join(pkgGen, "src", "ObjC", "interfaces.go"), generate); err != nil {
		return nil, fmt.Errorf("failed to create the ObjC wrapper Go file: %v", err)
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		g.GenH()
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(filepath.Join(srcDir, "interfaces.h"), generate); err != nil {
		return nil, fmt.Errorf("failed to create the ObjC wrapper header file: %v", err)
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		g.GenM()
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(filepath.Join(srcDir, "interfaces.m"), generate); err != nil {
		return nil, fmt.Errorf("failed to create the Java classes ObjC file: %v", err)
	}
	return types, nil
}

func GenClasses(pkgs []*build.Package, srcDir, jpkgSrc string) ([]*java.Class, error) {
	refs, err := importers.AnalyzePackages(pkgs, "Java/")
	if err != nil {
		return nil, err
	}
	bClspath, err := bootClasspath()
	if err != nil {
		return nil, err
	}
	imp := &java.Importer{
		Bootclasspath: bClspath,
		Classpath:     bindClasspath,
		JavaPkg:       bindJavaPkg,
	}
	classes, err := imp.Import(refs)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	g := &bind.ClassGen{
		JavaPkg: bindJavaPkg,
		Printer: &bind.Printer{
			IndentEach: []byte("\t"),
			Buf:        &buf,
		},
	}
	g.Init(classes, refs.Embedders)
	for i, jpkg := range g.Packages() {
		pkgDir := filepath.Join(jpkgSrc, "src", "Java", jpkg)
		if err := os.MkdirAll(pkgDir, 0700); err != nil {
			return nil, err
		}
		pkgFile := filepath.Join(pkgDir, "package.go")
		generate := func(w io.Writer) error {
			if buildN {
				return nil
			}
			buf.Reset()
			g.GenPackage(i)
			_, err := io.Copy(w, &buf)
			return err
		}
		if err := writeFile(pkgFile, generate); err != nil {
			return nil, fmt.Errorf("failed to create the Java wrapper package %s: %v", jpkg, err)
		}
	}
	generate := func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		g.GenGo()
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(filepath.Join(srcDir, "classes.go"), generate); err != nil {
		return nil, fmt.Errorf("failed to create the Java classes Go file: %v", err)
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		g.GenH()
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(filepath.Join(srcDir, "classes.h"), generate); err != nil {
		return nil, fmt.Errorf("failed to create the Java classes header file: %v", err)
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		g.GenC()
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(filepath.Join(srcDir, "classes.c"), generate); err != nil {
		return nil, fmt.Errorf("failed to create the Java classes C file: %v", err)
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		g.GenInterfaces()
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(filepath.Join(jpkgSrc, "src", "Java", "interfaces.go"), generate); err != nil {
		return nil, fmt.Errorf("failed to create the Java classes interfaces file: %v", err)
	}
	return classes, nil
}

func (b *binder) GenJava(pkg *types.Package, files []*ast.File, allPkg []*types.Package, classes []*java.Class, outdir, androidDir string) error {
	jpkgname := bind.JavaPkgName(bindJavaPkg, pkg)
	javadir := filepath.Join(androidDir, strings.Replace(jpkgname, ".", "/", -1))
	var className string
	pkgName := ""
	pkgPath := ""
	if pkg != nil {
		className = strings.Title(pkg.Name())
		pkgName = pkg.Name()
		pkgPath = pkg.Path()
	} else {
		pkgName = "universe"
		className = "Universe"
	}
	javaFile := filepath.Join(javadir, className+".java")
	cFile := filepath.Join(outdir, "java_"+pkgName+".c")
	hFile := filepath.Join(outdir, pkgName+".h")
	bindOption := "-lang=java"
	if bindJavaPkg != "" {
		bindOption += " -javapkg=" + bindJavaPkg
	}

	var buf bytes.Buffer
	g := &bind.JavaGen{
		JavaPkg: bindJavaPkg,
		Generator: &bind.Generator{
			Printer: &bind.Printer{Buf: &buf, IndentEach: []byte("    ")},
			Fset:    b.fset,
			AllPkg:  allPkg,
			Pkg:     pkg,
			Files:   files,
		},
	}
	g.Init(classes)

	generate := func(w io.Writer) error {
		if buildX {
			printcmd("gobind %s -outdir=%s %s", bindOption, javadir, pkgPath)
		}
		if buildN {
			return nil
		}
		buf.Reset()
		if err := g.GenJava(); err != nil {
			return err
		}
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(javaFile, generate); err != nil {
		return err
	}
	for i, name := range g.ClassNames() {
		generate := func(w io.Writer) error {
			if buildN {
				return nil
			}
			buf.Reset()
			if err := g.GenClass(i); err != nil {
				return err
			}
			_, err := io.Copy(w, &buf)
			return err
		}
		classFile := filepath.Join(javadir, name+".java")
		if err := writeFile(classFile, generate); err != nil {
			return err
		}
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		if err := g.GenC(); err != nil {
			return err
		}
		_, err := io.Copy(w, &buf)
		return err
	}
	if err := writeFile(cFile, generate); err != nil {
		return err
	}
	generate = func(w io.Writer) error {
		if buildN {
			return nil
		}
		buf.Reset()
		if err := g.GenH(); err != nil {
			return err
		}
		_, err := io.Copy(w, &buf)
		return err
	}
	return writeFile(hFile, generate)
}

func (b *binder) GenGo(pkg *types.Package, allPkg []*types.Package, outdir string) error {
	pkgName := "go_"
	pkgPath := ""
	if pkg != nil {
		pkgName += pkg.Name()
		pkgPath = pkg.Path()
	}
	goFile := filepath.Join(outdir, pkgName+"main.go")

	generate := func(w io.Writer) error {
		if buildX {
			printcmd("gobind -lang=go -outdir=%s %s", outdir, pkgPath)
		}
		if buildN {
			return nil
		}
		conf := &bind.GeneratorConfig{
			Writer: w,
			Fset:   b.fset,
			Pkg:    pkg,
			AllPkg: allPkg,
		}
		return bind.GenGo(conf)
	}
	if err := writeFile(goFile, generate); err != nil {
		return err
	}
	return nil
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

func loadExportData(pkgs []*build.Package, env []string, args ...string) ([]*types.Package, error) {
	// Compile the package. This will produce good errors if the package
	// doesn't typecheck for some reason, and is a necessary step to
	// building the final output anyway.
	paths := make([]string, len(pkgs))
	for i, p := range pkgs {
		paths[i] = p.ImportPath
	}
	if err := goInstall(paths, env, args...); err != nil {
		return nil, err
	}

	goos, goarch := getenv(env, "GOOS"), getenv(env, "GOARCH")

	// Assemble a fake GOPATH and trick go/importer into using it.
	// Ideally the importer package would let us provide this to
	// it somehow, but this works with what's in Go 1.5 today and
	// gives us access to the gcimporter package without us having
	// to make a copy of it.
	fakegopath := filepath.Join(tmpdir, "fakegopath")
	if err := removeAll(fakegopath); err != nil {
		return nil, err
	}
	if err := mkdir(filepath.Join(fakegopath, "pkg")); err != nil {
		return nil, err
	}
	typePkgs := make([]*types.Package, len(pkgs))
	imp := importer.Default()
	for i, p := range pkgs {
		importPath := p.ImportPath
		src := filepath.Join(pkgdir(env), importPath+".a")
		dst := filepath.Join(fakegopath, "pkg/"+goos+"_"+goarch+"/"+importPath+".a")
		if err := copyFile(dst, src); err != nil {
			return nil, err
		}
		if buildN {
			typePkgs[i] = types.NewPackage(importPath, path.Base(importPath))
			continue
		}
		oldDefault := build.Default
		build.Default = ctx // copy
		build.Default.GOARCH = goarch
		build.Default.GOPATH = fakegopath
		p, err := imp.Import(importPath)
		build.Default = oldDefault
		if err != nil {
			return nil, err
		}
		typePkgs[i] = p
	}
	return typePkgs, nil
}

func parse(pkgs []*build.Package) ([][]*ast.File, error) {
	fset := token.NewFileSet()
	var astPkgs [][]*ast.File
	for _, pkg := range pkgs {
		fileNames := append(append([]string{}, pkg.GoFiles...), pkg.CgoFiles...)
		var files []*ast.File
		for _, name := range fileNames {
			f, err := parser.ParseFile(fset, filepath.Join(pkg.Dir, name), nil, parser.ParseComments)
			if err != nil {
				return nil, err
			}
			files = append(files, f)
		}
		astPkgs = append(astPkgs, files)
	}
	return astPkgs, nil
}

func newBinder(pkgs []*types.Package) (*binder, error) {
	for _, pkg := range pkgs {
		if pkg.Name() == "main" {
			return nil, fmt.Errorf("package %q (%q): can only bind a library package", pkg.Name(), pkg.Path())
		}
	}
	b := &binder{
		fset: token.NewFileSet(),
		pkgs: pkgs,
	}
	return b, nil
}
