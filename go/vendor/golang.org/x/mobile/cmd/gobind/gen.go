// Copyright 2014 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/build"
	"go/token"
	"go/types"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/mobile/bind"
	"golang.org/x/mobile/internal/importers"
	"golang.org/x/mobile/internal/importers/java"
	"golang.org/x/mobile/internal/importers/objc"
)

func genPkg(lang string, p *types.Package, astFiles []*ast.File, allPkg []*types.Package, classes []*java.Class, otypes []*objc.Named) {
	fname := defaultFileName(lang, p)
	conf := &bind.GeneratorConfig{
		Fset:   fset,
		Pkg:    p,
		AllPkg: allPkg,
	}
	var pname string
	if p != nil {
		pname = p.Name()
	} else {
		pname = "universe"
	}
	var buf bytes.Buffer
	generator := &bind.Generator{
		Printer: &bind.Printer{Buf: &buf, IndentEach: []byte("\t")},
		Fset:    conf.Fset,
		AllPkg:  conf.AllPkg,
		Pkg:     conf.Pkg,
		Files:   astFiles,
	}
	switch lang {
	case "java":
		g := &bind.JavaGen{
			JavaPkg:   *javaPkg,
			Generator: generator,
		}
		g.Init(classes)

		pkgname := bind.JavaPkgName(*javaPkg, p)
		pkgDir := strings.Replace(pkgname, ".", "/", -1)
		buf.Reset()
		w, closer := writer(filepath.Join("java", pkgDir, fname))
		processErr(g.GenJava())
		io.Copy(w, &buf)
		closer()
		for i, name := range g.ClassNames() {
			buf.Reset()
			w, closer := writer(filepath.Join("java", pkgDir, name+".java"))
			processErr(g.GenClass(i))
			io.Copy(w, &buf)
			closer()
		}
		buf.Reset()
		w, closer = writer(filepath.Join("src", "gobind", pname+"_android.c"))
		processErr(g.GenC())
		io.Copy(w, &buf)
		closer()
		buf.Reset()
		w, closer = writer(filepath.Join("src", "gobind", pname+"_android.h"))
		processErr(g.GenH())
		io.Copy(w, &buf)
		closer()
		// Generate support files along with the universe package
		if p == nil {
			p, err := build.Default.Import("golang.org/x/mobile/bind", ".", build.ImportComment)
			if err != nil {
				errorf(`"golang.org/x/mobile/bind" is not found; run go get golang.org/x/mobile/bind: %v`, err)
				return
			}
			repo := filepath.Clean(filepath.Join(p.Dir, "..")) // golang.org/x/mobile directory.
			for _, javaFile := range []string{"Seq.java"} {
				src := filepath.Join(repo, "bind/java/"+javaFile)
				in, err := os.Open(src)
				if err != nil {
					errorf("failed to open Java support file: %v", err)
				}
				defer in.Close()
				w, closer := writer(filepath.Join("java", "go", javaFile))
				defer closer()
				if _, err := io.Copy(w, in); err != nil {
					errorf("failed to copy Java support file: %v", err)
					return
				}
			}
			// Copy support files
			javaPkg, err := build.Default.Import("golang.org/x/mobile/bind/java", "", build.FindOnly)
			if err != nil {
				errorf("unable to import bind/java: %v", err)
				return
			}
			copyFile(filepath.Join("src", "gobind", "seq_android.c"), filepath.Join(javaPkg.Dir, "seq_android.c.support"))
			copyFile(filepath.Join("src", "gobind", "seq_android.go"), filepath.Join(javaPkg.Dir, "seq_android.go.support"))
			copyFile(filepath.Join("src", "gobind", "seq_android.h"), filepath.Join(javaPkg.Dir, "seq_android.h"))
		}
	case "go":
		w, closer := writer(filepath.Join("src", "gobind", fname))
		conf.Writer = w
		processErr(bind.GenGo(conf))
		closer()
		w, closer = writer(filepath.Join("src", "gobind", pname+".h"))
		genPkgH(w, pname)
		io.Copy(w, &buf)
		closer()
		w, closer = writer(filepath.Join("src", "gobind", "seq.h"))
		genPkgH(w, "seq")
		io.Copy(w, &buf)
		closer()
		bindPkg, err := build.Default.Import("golang.org/x/mobile/bind", "", build.FindOnly)
		if err != nil {
			errorf("unable to import bind: %v", err)
			return
		}
		copyFile(filepath.Join("src", "gobind", "seq.go"), filepath.Join(bindPkg.Dir, "seq.go.support"))
	case "objc":
		g := &bind.ObjcGen{
			Generator: generator,
			Prefix:    *prefix,
		}
		g.Init(otypes)
		w, closer := writer(filepath.Join("src", "gobind", pname+"_darwin.h"))
		processErr(g.GenGoH())
		io.Copy(w, &buf)
		closer()
		hname := strings.Title(fname[:len(fname)-2]) + ".objc.h"
		w, closer = writer(filepath.Join("src", "gobind", hname))
		processErr(g.GenH())
		io.Copy(w, &buf)
		closer()
		mname := strings.Title(fname[:len(fname)-2]) + "_darwin.m"
		w, closer = writer(filepath.Join("src", "gobind", mname))
		conf.Writer = w
		processErr(g.GenM())
		io.Copy(w, &buf)
		closer()
		if p == nil {
			// Copy support files
			objcPkg, err := build.Default.Import("golang.org/x/mobile/bind/objc", "", build.FindOnly)
			if err != nil {
				errorf("unable to import bind/objc: %v", err)
				return
			}
			copyFile(filepath.Join("src", "gobind", "seq_darwin.m"), filepath.Join(objcPkg.Dir, "seq_darwin.m.support"))
			copyFile(filepath.Join("src", "gobind", "seq_darwin.go"), filepath.Join(objcPkg.Dir, "seq_darwin.go.support"))
			copyFile(filepath.Join("src", "gobind", "ref.h"), filepath.Join(objcPkg.Dir, "ref.h"))
			copyFile(filepath.Join("src", "gobind", "seq_darwin.h"), filepath.Join(objcPkg.Dir, "seq_darwin.h"))
		}
	default:
		errorf("unknown target language: %q", lang)
	}
}

func genPkgH(w io.Writer, pname string) {
	fmt.Fprintf(w, `// Code generated by gobind. DO NOT EDIT.

#ifdef __GOBIND_ANDROID__
#include "%[1]s_android.h"
#endif
#ifdef __GOBIND_DARWIN__
#include "%[1]s_darwin.h"
#endif`, pname)
}

func genObjcPackages(dir string, types []*objc.Named, embedders []importers.Struct) error {
	var buf bytes.Buffer
	cg := &bind.ObjcWrapper{
		Printer: &bind.Printer{
			IndentEach: []byte("\t"),
			Buf:        &buf,
		},
	}
	var genNames []string
	for _, emb := range embedders {
		genNames = append(genNames, emb.Name)
	}
	cg.Init(types, genNames)
	for i, opkg := range cg.Packages() {
		pkgDir := filepath.Join(dir, "src", "ObjC", opkg)
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
	objcBase := filepath.Join(dir, "src", "ObjC")
	if err := os.MkdirAll(objcBase, 0700); err != nil {
		return err
	}
	if err := ioutil.WriteFile(filepath.Join(objcBase, "interfaces.go"), buf.Bytes(), 0600); err != nil {
		return err
	}
	goBase := filepath.Join(dir, "src", "gobind")
	if err := os.MkdirAll(goBase, 0700); err != nil {
		return err
	}
	buf.Reset()
	cg.GenGo()
	if err := ioutil.WriteFile(filepath.Join(goBase, "interfaces_darwin.go"), buf.Bytes(), 0600); err != nil {
		return err
	}
	buf.Reset()
	cg.GenH()
	if err := ioutil.WriteFile(filepath.Join(goBase, "interfaces.h"), buf.Bytes(), 0600); err != nil {
		return err
	}
	buf.Reset()
	cg.GenM()
	if err := ioutil.WriteFile(filepath.Join(goBase, "interfaces_darwin.m"), buf.Bytes(), 0600); err != nil {
		return err
	}
	return nil
}

func genJavaPackages(dir string, classes []*java.Class, embedders []importers.Struct) error {
	var buf bytes.Buffer
	cg := &bind.ClassGen{
		JavaPkg: *javaPkg,
		Printer: &bind.Printer{
			IndentEach: []byte("\t"),
			Buf:        &buf,
		},
	}
	cg.Init(classes, embedders)
	for i, jpkg := range cg.Packages() {
		pkgDir := filepath.Join(dir, "src", "Java", jpkg)
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
	javaBase := filepath.Join(dir, "src", "Java")
	if err := os.MkdirAll(javaBase, 0700); err != nil {
		return err
	}
	if err := ioutil.WriteFile(filepath.Join(javaBase, "interfaces.go"), buf.Bytes(), 0600); err != nil {
		return err
	}
	goBase := filepath.Join(dir, "src", "gobind")
	if err := os.MkdirAll(goBase, 0700); err != nil {
		return err
	}
	buf.Reset()
	cg.GenGo()
	if err := ioutil.WriteFile(filepath.Join(goBase, "classes_android.go"), buf.Bytes(), 0600); err != nil {
		return err
	}
	buf.Reset()
	cg.GenH()
	if err := ioutil.WriteFile(filepath.Join(goBase, "classes.h"), buf.Bytes(), 0600); err != nil {
		return err
	}
	buf.Reset()
	cg.GenC()
	if err := ioutil.WriteFile(filepath.Join(goBase, "classes_android.c"), buf.Bytes(), 0600); err != nil {
		return err
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

func copyFile(dst, src string) {
	w, closer := writer(dst)
	f, err := os.Open(src)
	if err != nil {
		errorf("unable to open file: %v", err)
		closer()
		os.Exit(exitStatus)
	}
	if _, err := io.Copy(w, f); err != nil {
		errorf("unable to copy file: %v", err)
		f.Close()
		closer()
		os.Exit(exitStatus)
	}
	f.Close()
	closer()
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
			return "go_main.go"
		}
		return "go_" + pkg.Name() + "main.go"
	case "objc":
		if pkg == nil {
			return "Universe.m"
		}
		firstRune, size := utf8.DecodeRuneInString(pkg.Name())
		className := string(unicode.ToUpper(firstRune)) + pkg.Name()[size:]
		return *prefix + className + ".m"
	}
	errorf("unknown target language: %q", lang)
	os.Exit(exitStatus)
	return ""
}
