// Copyright 2014 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"flag"
	"fmt"
	"go/ast"
	"go/build"
	"go/importer"
	"go/parser"
	"go/token"
	"go/types"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/mobile/internal/importers"
	"golang.org/x/mobile/internal/importers/java"
)

var (
	lang          = flag.String("lang", "java", "target language for bindings, either java, go, or objc (experimental).")
	outdir        = flag.String("outdir", "", "result will be written to the directory instead of stdout.")
	javaPkg       = flag.String("javapkg", "", "custom Java package path prefix. Valid only with -lang=java.")
	prefix        = flag.String("prefix", "", "custom Objective-C name prefix. Valid only with -lang=objc.")
	bootclasspath = flag.String("bootclasspath", "", "Java bootstrap classpath.")
	classpath     = flag.String("classpath", "", "Java classpath.")
)

var usage = `The Gobind tool generates Java language bindings for Go.

For usage details, see doc.go.`

func main() {
	flag.Parse()

	if *lang != "java" && *javaPkg != "" {
		log.Fatalf("Invalid option -javapkg for gobind -lang=%s", *lang)
	} else if *lang != "objc" && *prefix != "" {
		log.Fatalf("Invalid option -prefix for gobind -lang=%s", *lang)
	}

	oldCtx := build.Default
	ctx := &build.Default
	var allPkg []*build.Package
	for _, path := range flag.Args() {
		pkg, err := ctx.Import(path, ".", build.ImportComment)
		if err != nil {
			log.Fatalf("package %q: %v", path, err)
		}
		allPkg = append(allPkg, pkg)
	}
	var classes []*java.Class
	refs, err := importers.AnalyzePackages(allPkg, "Java/")
	if err != nil {
		log.Fatal(err)
	}
	if len(refs.Refs) > 0 {
		imp := &java.Importer{
			Bootclasspath: *bootclasspath,
			Classpath:     *classpath,
			JavaPkg:       *javaPkg,
		}
		classes, err = imp.Import(refs)
		if err != nil {
			log.Fatal(err)
		}
		if len(classes) > 0 {
			tmpGopath, err := ioutil.TempDir(os.TempDir(), "gobind-")
			if err != nil {
				log.Fatal(err)
			}
			defer os.RemoveAll(tmpGopath)
			if err := genJavaPackages(ctx, tmpGopath, classes, refs.Embedders); err != nil {
				log.Fatal(err)
			}
			gopath := ctx.GOPATH
			if gopath != "" {
				gopath = string(filepath.ListSeparator)
			}
			ctx.GOPATH = gopath + tmpGopath
		}
	}

	// Make sure the export data for any imported packages are up to date.
	cmd := exec.Command("go", "install")
	cmd.Args = append(cmd.Args, flag.Args()...)
	cmd.Env = append(os.Environ(), "GOPATH="+ctx.GOPATH)
	cmd.Env = append(cmd.Env, "GOROOT="+ctx.GOROOT)
	if err := cmd.Run(); err != nil {
		// Only report I/O errors. Errors from go install is expected for as-yet
		// undefined Java wrappers.
		if _, ok := err.(*exec.ExitError); !ok {
			fmt.Fprintf(os.Stderr, "%s failed: %v", strings.Join(cmd.Args, " "), err)
			os.Exit(1)
		}
	}

	typePkgs := make([]*types.Package, len(allPkg))
	fset := token.NewFileSet()
	conf := &types.Config{
		Importer: importer.Default(),
	}
	conf.Error = func(err error) {
		// Ignore errors. They're probably caused by as-yet undefined
		// Java wrappers.
	}
	for i, pkg := range allPkg {
		var files []*ast.File
		for _, name := range pkg.GoFiles {
			f, err := parser.ParseFile(fset, filepath.Join(pkg.Dir, name), nil, 0)
			if err != nil {
				log.Fatalf("Failed to parse Go file %s: %v", name, err)
			}
			files = append(files, f)
		}
		tpkg, _ := conf.Check(pkg.Name, fset, files, nil)
		typePkgs[i] = tpkg
	}
	build.Default = oldCtx
	for _, pkg := range typePkgs {
		genPkg(pkg, typePkgs, classes)
	}
	// Generate the error package and support files
	genPkg(nil, typePkgs, classes)
	os.Exit(exitStatus)
}

var exitStatus = 0

func errorf(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format, args...)
	fmt.Fprintln(os.Stderr)
	exitStatus = 1
}
