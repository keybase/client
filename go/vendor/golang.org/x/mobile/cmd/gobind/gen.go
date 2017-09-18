// Copyright 2014 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"bytes"
	"fmt"
	"go/build"
	"go/token"
	"go/types"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/mobile/bind"
	"golang.org/x/mobile/internal/importers"
	"golang.org/x/mobile/internal/importers/java"
)

func genPkg(p *types.Package, allPkg []*types.Package, classes []*java.Class) {
	fname := defaultFileName(*lang, p)
	conf := &bind.GeneratorConfig{
		Fset:   fset,
		Pkg:    p,
		AllPkg: allPkg,
	}
	switch *lang {
	case "java":
		var buf bytes.Buffer
		g := &bind.JavaGen{
			JavaPkg: *javaPkg,
			Generator: &bind.Generator{
				Printer: &bind.Printer{Buf: &buf, IndentEach: []byte("    ")},
				Fset:    conf.Fset,
				AllPkg:  conf.AllPkg,
				Pkg:     conf.Pkg,
			},
		}
		g.Init(classes)

		pkgname := bind.JavaPkgName(*javaPkg, p)
		pkgDir := strings.Replace(pkgname, ".", "/", -1)
		buf.Reset()
		w, closer := writer(filepath.Join(pkgDir, fname))
		processErr(g.GenJava())
		io.Copy(w, &buf)
		closer()
		for i, name := range g.ClassNames() {
			buf.Reset()
			w, closer := writer(filepath.Join(pkgDir, name+".java"))
			processErr(g.GenClass(i))
			io.Copy(w, &buf)
			closer()
		}
		buf.Reset()
		pn := "universe"
		if p != nil {
			pn = p.Name()
		}
		cname := "java_" + pn + ".c"
		w, closer = writer(cname)
		processErr(g.GenC())
		io.Copy(w, &buf)
		closer()
		buf.Reset()
		hname := pn + ".h"
		w, closer = writer(hname)
		processErr(g.GenH())
		io.Copy(w, &buf)
		closer()
		// Generate support files along with the universe package
		if p == nil {
			p, err := build.Default.Import("golang.org/x/mobile/bind", ".", build.ImportComment)
			if err != nil {
				errorf(`"golang.org/x/mobile/bind" is not found; run go get golang.org/x/mobile/bind: %v`)
				return
			}
			repo := filepath.Clean(filepath.Join(p.Dir, "..")) // golang.org/x/mobile directory.
			for _, javaFile := range []string{"Seq.java", "LoadJNI.java"} {
				src := filepath.Join(repo, "bind/java/"+javaFile)
				in, err := os.Open(src)
				if err != nil {
					errorf("failed to open Java support file: %v", err)
				}
				defer in.Close()
				w, closer := writer(filepath.Join("go", javaFile))
				defer closer()
				if _, err := io.Copy(w, in); err != nil {
					errorf("failed to copy Java support file: %v", err)
					return
				}
			}
		}
	case "go":
		w, closer := writer(fname)
		conf.Writer = w
		processErr(bind.GenGo(conf))
		closer()
	case "objc":
		var gohname string
		if p != nil {
			gohname = p.Name() + ".h"
		} else {
			gohname = "GoUniverse.h"
		}
		var buf bytes.Buffer
		g := &bind.ObjcGen{
			Generator: &bind.Generator{
				Printer: &bind.Printer{Buf: &buf, IndentEach: []byte("\t")},
				Fset:    conf.Fset,
				AllPkg:  conf.AllPkg,
				Pkg:     conf.Pkg,
			},
			Prefix: *prefix,
		}
		g.Init(nil)

		w, closer := writer(gohname)
		processErr(g.GenGoH())
		io.Copy(w, &buf)
		closer()
		hname := fname[:len(fname)-2] + ".h"
		w, closer = writer(hname)
		processErr(g.GenH())
		io.Copy(w, &buf)
		closer()
		w, closer = writer(fname)
		conf.Writer = w
		processErr(g.GenM())
		io.Copy(w, &buf)
		closer()
	default:
		errorf("unknown target language: %q", *lang)
	}
}

func genJavaPackages(ctx *build.Context, dir string, classes []*java.Class, embedders []importers.Struct) error {
	var buf bytes.Buffer
	cg := &bind.ClassGen{
		JavaPkg: *javaPkg,
		Printer: &bind.Printer{
			IndentEach: []byte("\t"),
			Buf:        &buf,
		},
	}
	cg.Init(classes, embedders)
	pkgBase := filepath.Join(dir, "src", "Java")
	if err := os.MkdirAll(pkgBase, 0700); err != nil {
		return err
	}
	for i, jpkg := range cg.Packages() {
		pkgDir := filepath.Join(pkgBase, jpkg)
		if err := os.MkdirAll(pkgDir, 0700); err != nil {
			return err
		}
		pkgFile := filepath.Join(pkgDir, "package.go")
		buf.Reset()
		cg.GenPackage(i)
		if err := ioutil.WriteFile(pkgFile, buf.Bytes(), 0600); err != nil {
			return err
		}
	}
	buf.Reset()
	cg.GenInterfaces()
	clsFile := filepath.Join(pkgBase, "interfaces.go")
	if err := ioutil.WriteFile(clsFile, buf.Bytes(), 0600); err != nil {
		return err
	}

	cmd := exec.Command(
		"go",
		"install",
		"-pkgdir="+filepath.Join(dir, "pkg", ctx.GOOS+"_"+ctx.GOARCH),
		"Java/...",
	)
	cmd.Env = append(os.Environ(), "GOPATH="+dir)
	cmd.Env = append(cmd.Env, "GOROOT="+ctx.GOROOT)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to go install the generated Java wrappers: %v: %s", err, string(out))
	}
	return nil
}

func processErr(err error) {
	if err != nil {
		if list, _ := err.(bind.ErrorList); len(list) > 0 {
			for _, err := range list {
				errorf("%v", err)
			}
		} else {
			errorf("%v", err)
		}
	}
}

var fset = token.NewFileSet()

func writer(fname string) (w io.Writer, closer func()) {
	if *outdir == "" {
		return os.Stdout, func() { return }
	}

	name := filepath.Join(*outdir, fname)
	dir := filepath.Dir(name)
	if err := os.MkdirAll(dir, 0755); err != nil {
		errorf("invalid output dir: %v", err)
		os.Exit(exitStatus)
	}

	f, err := os.Create(name)
	if err != nil {
		errorf("invalid output dir: %v", err)
		os.Exit(exitStatus)
	}
	closer = func() {
		if err := f.Close(); err != nil {
			errorf("error in closing output file: %v", err)
		}
	}
	return f, closer
}

func defaultFileName(lang string, pkg *types.Package) string {
	switch lang {
	case "java":
		if pkg == nil {
			return "Universe.java"
		}
		firstRune, size := utf8.DecodeRuneInString(pkg.Name())
		className := string(unicode.ToUpper(firstRune)) + pkg.Name()[size:]
		return className + ".java"
	case "go":
		if pkg == nil {
			return "go_universe.go"
		}
		return "go_" + pkg.Name() + ".go"
	case "objc":
		if pkg == nil {
			return "GoUniverse.m"
		}
		firstRune, size := utf8.DecodeRuneInString(pkg.Name())
		className := string(unicode.ToUpper(firstRune)) + pkg.Name()[size:]
		return "Go" + className + ".m"
	}
	errorf("unknown target language: %q", lang)
	os.Exit(exitStatus)
	return ""
}
