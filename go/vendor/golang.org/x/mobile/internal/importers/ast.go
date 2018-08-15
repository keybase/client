// Copyright 2016 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The importers package uses go/ast to analyze Go packages or Go files
// and collect references to types whose package has a package prefix.
// It is used by the language specific importers to determine the set of
// wrapper types to be generated.
//
// For example, in the Go file
//
// package javaprogram
//
// import "Java/java/lang"
//
// func F() {
//     o := lang.Object.New()
//     ...
// }
//
// the java importer uses this package to determine that the "java/lang"
// package and the wrapper interface, lang.Object, needs to be generated.
// After calling AnalyzeFile or AnalyzePackages, the References result
// contains the reference to lang.Object and the names set will contain
// "New".
package importers

import (
	"errors"
	"go/ast"
	"go/build"
	"go/parser"
	"go/token"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// References is the result of analyzing a Go file or set of Go packages.
//
// For example, the Go file
//
// package pkg
//
// import "Prefix/some/Package"
//
// var A = Package.Identifier
//
// Will result in a single PkgRef with the "some/Package" package and
// the Identifier name. The Names set will contain the single name,
// "Identifier".
type References struct {
	// The list of references to identifiers in packages that are
	// identified by a package prefix.
	Refs []PkgRef
	// The list of names used in at least one selector expression.
	// Useful as a conservative upper bound on the set of identifiers
	// referenced from a set of packages.
	Names map[string]struct{}
	// Embedders is a list of struct types with prefixed types
	// embedded.
	Embedders []Struct
}

// Struct is a representation of a struct type with embedded
// types.
type Struct struct {
	Name    string
	Pkg     string
	PkgPath string
	Refs    []PkgRef
}

// PkgRef is a reference to an identifier in a package.
type PkgRef struct {
	Name string
	Pkg  string
}

type refsSaver struct {
	pkgPrefix string
	*References
	refMap       map[PkgRef]struct{}
	insideStruct bool
}

// AnalyzeFile scans the provided file for references to packages with the given
// package prefix. The list of unique (package, identifier) pairs is returned
func AnalyzeFile(file *ast.File, pkgPrefix string) (*References, error) {
	visitor := newRefsSaver(pkgPrefix)
	fset := token.NewFileSet()
	files := map[string]*ast.File{file.Name.Name: file}
	// Ignore errors (from unknown packages)
	pkg, _ := ast.NewPackage(fset, files, visitor.importer(), nil)
	ast.Walk(visitor, pkg)
	visitor.findEmbeddingStructs("", pkg)
	return visitor.References, nil
}

// AnalyzePackages scans the provided packages for references to packages with the given
// package prefix. The list of unique (package, identifier) pairs is returned
func AnalyzePackages(pkgs []*build.Package, pkgPrefix string) (*References, error) {
	visitor := newRefsSaver(pkgPrefix)
	imp := visitor.importer()
	fset := token.NewFileSet()
	for _, pkg := range pkgs {
		fileNames := append(append([]string{}, pkg.GoFiles...), pkg.CgoFiles...)
		files := make(map[string]*ast.File)
		for _, name := range fileNames {
			f, err := parser.ParseFile(fset, filepath.Join(pkg.Dir, name), nil, 0)
			if err != nil {
				return nil, err
			}
			files[name] = f
		}
		// Ignore errors (from unknown packages)
		astpkg, _ := ast.NewPackage(fset, files, imp, nil)
		ast.Walk(visitor, astpkg)
		visitor.findEmbeddingStructs(pkg.ImportPath, astpkg)
	}
	return visitor.References, nil
}

// findEmbeddingStructs finds all top level declarations embedding a prefixed type.
//
// For example:
//
// import "Prefix/some/Package"
//
// type T struct {
//     Package.Class
// }
func (v *refsSaver) findEmbeddingStructs(pkgpath string, pkg *ast.Package) {
	var names []string
	for _, obj := range pkg.Scope.Objects {
		if obj.Kind != ast.Typ || !ast.IsExported(obj.Name) {
			continue
		}
		names = append(names, obj.Name)
	}
	sort.Strings(names)
	for _, name := range names {
		obj := pkg.Scope.Objects[name]

		t, ok := obj.Decl.(*ast.TypeSpec).Type.(*ast.StructType)
		if !ok {
			continue
		}
		var refs []PkgRef
		for _, f := range t.Fields.List {
			sel, ok := f.Type.(*ast.SelectorExpr)
			if !ok {
				continue
			}
			ref, ok := v.addRef(sel)
			if !ok {
				continue
			}
			if len(f.Names) > 0 && !f.Names[0].IsExported() {
				continue
			}
			refs = append(refs, ref)
		}
		if len(refs) > 0 {
			v.Embedders = append(v.Embedders, Struct{
				Name:    obj.Name,
				Pkg:     pkg.Name,
				PkgPath: pkgpath,

				Refs: refs,
			})
		}
	}
}

func newRefsSaver(pkgPrefix string) *refsSaver {
	s := &refsSaver{
		pkgPrefix:  pkgPrefix,
		refMap:     make(map[PkgRef]struct{}),
		References: &References{},
	}
	s.Names = make(map[string]struct{})
	return s
}

func (v *refsSaver) importer() ast.Importer {
	return func(imports map[string]*ast.Object, pkgPath string) (*ast.Object, error) {
		if pkg, exists := imports[pkgPath]; exists {
			return pkg, nil
		}
		if !strings.HasPrefix(pkgPath, v.pkgPrefix) {
			return nil, errors.New("ignored")
		}
		pkg := ast.NewObj(ast.Pkg, path.Base(pkgPath))
		imports[pkgPath] = pkg
		return pkg, nil
	}
}

func (v *refsSaver) addRef(sel *ast.SelectorExpr) (PkgRef, bool) {
	x, ok := sel.X.(*ast.Ident)
	if !ok || x.Obj == nil {
		return PkgRef{}, false
	}
	imp, ok := x.Obj.Decl.(*ast.ImportSpec)
	if !ok {
		return PkgRef{}, false
	}
	pkgPath, err := strconv.Unquote(imp.Path.Value)
	if err != nil {
		return PkgRef{}, false
	}
	if !strings.HasPrefix(pkgPath, v.pkgPrefix) {
		return PkgRef{}, false
	}
	pkgPath = pkgPath[len(v.pkgPrefix):]
	ref := PkgRef{Pkg: pkgPath, Name: sel.Sel.Name}
	if _, exists := v.refMap[ref]; !exists {
		v.refMap[ref] = struct{}{}
		v.Refs = append(v.Refs, ref)
	}
	return ref, true
}

func (v *refsSaver) Visit(n ast.Node) ast.Visitor {
	switch n := n.(type) {
	case *ast.StructType:
		// Use a copy of refsSaver that only accepts exported fields. It refers
		// to the original refsSaver for collecting references.
		v2 := *v
		v2.insideStruct = true
		return &v2
	case *ast.Field:
		if v.insideStruct && len(n.Names) == 1 && !n.Names[0].IsExported() {
			return nil
		}
	case *ast.SelectorExpr:
		v.Names[n.Sel.Name] = struct{}{}
		if _, ok := v.addRef(n); ok {
			return nil
		}
	case *ast.FuncDecl:
		if n.Recv != nil { // Methods
			v.Names[n.Name.Name] = struct{}{}
		}
	}
	return v
}
