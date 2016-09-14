// Copyright 2014 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"bytes"
	"go/token"
	"go/types"
	"io"
	"os"
	"path/filepath"
	"unicode"
	"unicode/utf8"

	"golang.org/x/mobile/bind"
)

func genPkg(p *types.Package, allPkg []*types.Package) {
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
		g.Init()

		buf.Reset()
		w, closer := writer(fname)
		processErr(g.GenJava())
		io.Copy(w, &buf)
		closer()
		for i, name := range g.ClassNames() {
			buf.Reset()
			w, closer := writer(name + ".java")
			processErr(g.GenClass(i))
			io.Copy(w, &buf)
			closer()
		}
		buf.Reset()
		cname := "java_" + p.Name() + ".c"
		w, closer = writer(cname)
		processErr(g.GenC())
		io.Copy(w, &buf)
		closer()
		buf.Reset()
		hname := p.Name() + ".h"
		w, closer = writer(hname)
		processErr(g.GenH())
		io.Copy(w, &buf)
		closer()
	case "go":
		w, closer := writer(fname)
		conf.Writer = w
		processErr(bind.GenGo(conf))
		closer()
	case "objc":
		gohname := p.Name() + ".h"
		w, closer := writer(gohname)
		conf.Writer = w
		processErr(bind.GenObjc(conf, *prefix, bind.ObjcGoH))
		closer()
		hname := fname[:len(fname)-2] + ".h"
		w, closer = writer(hname)
		conf.Writer = w
		processErr(bind.GenObjc(conf, *prefix, bind.ObjcH))
		closer()
		w, closer = writer(fname)
		conf.Writer = w
		processErr(bind.GenObjc(conf, *prefix, bind.ObjcM))
		closer()
	default:
		errorf("unknown target language: %q", *lang)
	}
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
		firstRune, size := utf8.DecodeRuneInString(pkg.Name())
		className := string(unicode.ToUpper(firstRune)) + pkg.Name()[size:]
		return className + ".java"
	case "go":
		return "go_" + pkg.Name() + ".go"
	case "objc":
		firstRune, size := utf8.DecodeRuneInString(pkg.Name())
		className := string(unicode.ToUpper(firstRune)) + pkg.Name()[size:]
		return "Go" + className + ".m"
	}
	errorf("unknown target language: %q", lang)
	os.Exit(exitStatus)
	return ""
}
