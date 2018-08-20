// Copyright 2014 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"bytes"
	"flag"
	"fmt"
	"go/ast"
	"go/build"
	"go/importer"
	"go/parser"
	"go/types"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/mobile/internal/importers"
	"golang.org/x/mobile/internal/importers/java"
	"golang.org/x/mobile/internal/importers/objc"
)

var (
	lang          = flag.String("lang", "", "target languages for bindings, either java, go, or objc. If empty, all languages are generated.")
	outdir        = flag.String("outdir", "", "result will be written to the directory instead of stdout.")
	javaPkg       = flag.String("javapkg", "", "custom Java package path prefix. Valid only with -lang=java.")
	prefix        = flag.String("prefix", "", "custom Objective-C name prefix. Valid only with -lang=objc.")
	bootclasspath = flag.String("bootclasspath", "", "Java bootstrap classpath.")
	classpath     = flag.String("classpath", "", "Java classpath.")
	tags          = flag.String("tags", "", "build tags.")
)

var usage = `The Gobind tool generates Java language bindings for Go.

For usage details, see doc.go.`

func main() {
	flag.Parse()

	run()
	os.Exit(exitStatus)
}

func run() {
	var langs []string
	if *lang != "" {
		langs = strings.Split(*lang, ",")
	} else {
		langs = []string{"go", "java", "objc"}
	}
	ctx := build.Default
	if *tags != "" {
		ctx.BuildTags = append(ctx.BuildTags, strings.Split(*tags, ",")...)
	}
	var allPkg []*build.Package
	for _, path := range flag.Args() {
		pkg, err := ctx.Import(path, ".", build.ImportComment)
		if err != nil {
			log.Fatalf("package %q: %v", path, err)
		}
		allPkg = append(allPkg, pkg)
	}
	jrefs, err := importers.AnalyzePackages(allPkg, "Java/")
	if err != nil {
		log.Fatal(err)
	}
	orefs, err := importers.AnalyzePackages(allPkg, "ObjC/")
	if err != nil {
		log.Fatal(err)
	}
	var classes []*java.Class
	if len(jrefs.Refs) > 0 {
		jimp := &java.Importer{
			Bootclasspath: *bootclasspath,
			Classpath:     *classpath,
			JavaPkg:       *javaPkg,
		}
		classes, err = jimp.Import(jrefs)
		if err != nil {
			log.Fatal(err)
		}
	}
	var otypes []*objc.Named
	if len(orefs.Refs) > 0 {
		otypes, err = objc.Import(orefs)
		if err != nil {
			log.Fatal(err)
		}
	}
	// Determine GOPATH from go env GOPATH in case the default $HOME/go GOPATH
	// is in effect.
	if out, err := exec.Command("go", "env", "GOPATH").Output(); err != nil {
		log.Fatal(err)
	} else {
		ctx.GOPATH = string(bytes.TrimSpace(out))
	}
	if len(classes) > 0 || len(otypes) > 0 {
		// After generation, reverse bindings needs to be in the GOPATH
		// for user packages to build.
		srcDir := *outdir
		if srcDir == "" {
			srcDir, err = ioutil.TempDir(os.TempDir(), "gobind-")
			if err != nil {
				log.Fatal(err)
			}
			defer os.RemoveAll(srcDir)
		} else {
			srcDir, err = filepath.Abs(srcDir)
			if err != nil {
				log.Fatal(err)
			}
		}
		if ctx.GOPATH != "" {
			ctx.GOPATH = string(filepath.ListSeparator) + ctx.GOPATH
		}
		ctx.GOPATH = srcDir + ctx.GOPATH
		if len(classes) > 0 {
			if err := genJavaPackages(srcDir, classes, jrefs.Embedders); err != nil {
				log.Fatal(err)
			}
		}
		if len(otypes) > 0 {
			if err := genObjcPackages(srcDir, otypes, orefs.Embedders); err != nil {
				log.Fatal(err)
			}
		}
	}

	typePkgs := make([]*types.Package, len(allPkg))
	astPkgs := make([][]*ast.File, len(allPkg))
	// The "source" go/importer package implicitly uses build.Default.
	oldCtx := build.Default
	build.Default = ctx
	defer func() {
		build.Default = oldCtx
	}()
	imp := importer.For("source", nil)
	for i, pkg := range allPkg {
		var err error
		typePkgs[i], err = imp.Import(pkg.ImportPath)
		if err != nil {
			errorf("%v\n", err)
			return
		}
		astPkgs[i], err = parse(pkg)
		if err != nil {
			errorf("%v\n", err)
			return
		}
	}
	for _, l := range langs {
		for i, pkg := range typePkgs {
			genPkg(l, pkg, astPkgs[i], typePkgs, classes, otypes)
		}
		// Generate the error package and support files
		genPkg(l, nil, nil, typePkgs, classes, otypes)
	}
}

func parse(pkg *build.Package) ([]*ast.File, error) {
	fileNames := append(append([]string{}, pkg.GoFiles...), pkg.CgoFiles...)
	var files []*ast.File
	for _, name := range fileNames {
		f, err := parser.ParseFile(fset, filepath.Join(pkg.Dir, name), nil, parser.ParseComments)
		if err != nil {
			return nil, err
		}
		files = append(files, f)
	}
	return files, nil
}

var exitStatus = 0

func errorf(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format, args...)
	fmt.Fprintln(os.Stderr)
	exitStatus = 1
}
