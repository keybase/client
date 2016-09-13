// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package bind

import (
	"bytes"
	"fmt"
	"go/token"
	"go/types"
	"io"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

type (
	ErrorList []error

	// varMode describes the lifetime of an argument or
	// return value. Modes are used to guide the conversion
	// of string and byte slice values accross the language
	// barrier. The same conversion mode must be used for
	// both the conversion before a foreign call and the
	// corresponding conversion after the call.
	// See the mode* constants for a description of
	// each mode.
	varMode int
)

const (
	// modeTransient are for function arguments that
	// are not used after the function returns.
	// Transient byte slices don't need copying
	// when passed accross the language barrier.
	modeTransient varMode = iota
	// modeRetained are for returned values and for function
	// arguments that are used after the function returns.
	// Retained byte slices need an intermediate copy.
	modeRetained
)

func (list ErrorList) Error() string {
	buf := new(bytes.Buffer)
	for i, err := range list {
		if i > 0 {
			buf.WriteRune('\n')
		}
		io.WriteString(buf, err.Error())
	}
	return buf.String()
}

// Generator contains the common Go package information
// needed for the specific Go, Java, ObjC generators.
//
// After setting Printer, Fset, AllPkg, Pkg, the Init
// method is used to initialize the auxiliary information
// about the package to be generated, Pkg.
type Generator struct {
	*Printer
	Fset   *token.FileSet
	AllPkg []*types.Package
	Pkg    *types.Package
	err    ErrorList

	// fields set by Init.
	pkgName   string
	pkgPrefix string
	funcs     []*types.Func
	constants []*types.Const
	vars      []*types.Var

	interfaces []interfaceInfo
	structs    []structInfo
	otherNames []*types.TypeName
	// allIntf contains interfaces from all bound packages.
	allIntf []interfaceInfo
}

// pkgPrefix returns a prefix that disambiguates symbol names for binding
// multiple packages.
//
// TODO(elias.naur): Avoid (and test) name clashes from multiple packages
// with the same name. Perhaps use the index from the order the package is
// generated.
func pkgPrefix(pkg *types.Package) string {
	// The error type has no package
	if pkg == nil {
		return ""
	}
	return pkg.Name()
}

func (g *Generator) Init() {
	if g.Pkg != nil {
		g.pkgName = g.Pkg.Name()
	}
	g.pkgPrefix = pkgPrefix(g.Pkg)

	if g.Pkg != nil {
		scope := g.Pkg.Scope()
		hasExported := false
		for _, name := range scope.Names() {
			obj := scope.Lookup(name)
			if !obj.Exported() {
				continue
			}
			hasExported = true
			switch obj := obj.(type) {
			case *types.Func:
				if isCallable(obj) {
					g.funcs = append(g.funcs, obj)
				}
			case *types.TypeName:
				named := obj.Type().(*types.Named)
				switch t := named.Underlying().(type) {
				case *types.Struct:
					g.structs = append(g.structs, structInfo{obj, t})
				case *types.Interface:
					g.interfaces = append(g.interfaces, interfaceInfo{obj, t, makeIfaceSummary(t)})
				default:
					g.otherNames = append(g.otherNames, obj)
				}
			case *types.Const:
				g.constants = append(g.constants, obj)
			case *types.Var:
				g.vars = append(g.vars, obj)
			default:
				g.errorf("unsupported exported type for %s: %T", obj.Name(), obj)
			}
		}
		if !hasExported {
			g.errorf("no exported names in the package %q", g.Pkg.Path())
		}
	} else {
		// Bind the single supported type from the universe scope, error.
		errType := types.Universe.Lookup("error").(*types.TypeName)
		t := errType.Type().Underlying().(*types.Interface)
		g.interfaces = append(g.interfaces, interfaceInfo{errType, t, makeIfaceSummary(t)})
	}
	for _, p := range g.AllPkg {
		scope := p.Scope()
		for _, name := range scope.Names() {
			obj := scope.Lookup(name)
			if !obj.Exported() {
				continue
			}
			if obj, ok := obj.(*types.TypeName); ok {
				named := obj.Type().(*types.Named)
				if t, ok := named.Underlying().(*types.Interface); ok {
					g.allIntf = append(g.allIntf, interfaceInfo{obj, t, makeIfaceSummary(t)})
				}
			}
		}
	}
}

func (_ *Generator) toCFlag(v bool) int {
	if v {
		return 1
	}
	return 0
}

func (g *Generator) errorf(format string, args ...interface{}) {
	g.err = append(g.err, fmt.Errorf(format, args...))
}

// cgoType returns the name of a Cgo type suitable for converting a value of
// the given type.
func (g *Generator) cgoType(t types.Type) string {
	switch t := t.(type) {
	case *types.Basic:
		switch t.Kind() {
		case types.Bool, types.UntypedBool:
			return "char"
		case types.Int:
			return "nint"
		case types.Int8:
			return "int8_t"
		case types.Int16:
			return "int16_t"
		case types.Int32, types.UntypedRune: // types.Rune
			return "int32_t"
		case types.Int64, types.UntypedInt:
			return "int64_t"
		case types.Uint8: // types.Byte
			return "uint8_t"
		// TODO(crawshaw): case types.Uint, types.Uint16, types.Uint32, types.Uint64:
		case types.Float32:
			return "float"
		case types.Float64, types.UntypedFloat:
			return "double"
		case types.String:
			return "nstring"
		default:
			g.errorf("unsupported basic type: %s", t)
		}
	case *types.Slice:
		switch e := t.Elem().(type) {
		case *types.Basic:
			switch e.Kind() {
			case types.Uint8: // Byte.
				return "nbyteslice"
			default:
				g.errorf("unsupported slice type: %s", t)
			}
		default:
			g.errorf("unsupported slice type: %s", t)
		}
	case *types.Pointer:
		if _, ok := t.Elem().(*types.Named); ok {
			return g.cgoType(t.Elem())
		}
		g.errorf("unsupported pointer to type: %s", t)
	case *types.Named:
		return "int32_t"
	default:
		g.errorf("unsupported type: %s", t)
	}
	return "TODO"
}

func (g *Generator) genInterfaceMethodSignature(m *types.Func, iName string, header bool) {
	sig := m.Type().(*types.Signature)
	params := sig.Params()
	res := sig.Results()

	if res.Len() == 0 {
		g.Printf("void ")
	} else {
		if res.Len() == 1 {
			g.Printf("%s ", g.cgoType(res.At(0).Type()))
		} else {
			if header {
				g.Printf("typedef struct cproxy%s_%s_%s_return {\n", g.pkgPrefix, iName, m.Name())
				g.Indent()
				for i := 0; i < res.Len(); i++ {
					t := res.At(i).Type()
					g.Printf("%s r%d;\n", g.cgoType(t), i)
				}
				g.Outdent()
				g.Printf("} cproxy%s_%s_%s_return;\n", g.pkgPrefix, iName, m.Name())
			}
			g.Printf("struct cproxy%s_%s_%s_return ", g.pkgPrefix, iName, m.Name())
		}
	}
	g.Printf("cproxy%s_%s_%s(int32_t refnum", g.pkgPrefix, iName, m.Name())
	for i := 0; i < params.Len(); i++ {
		t := params.At(i).Type()
		g.Printf(", %s %s", g.cgoType(t), paramName(params, i))
	}
	g.Printf(")")
	if header {
		g.Printf(";\n")
	} else {
		g.Printf(" {\n")
	}
}

func (g *Generator) validPkg(pkg *types.Package) bool {
	for _, p := range g.AllPkg {
		if p == pkg {
			return true
		}
	}
	return false
}

// isSigSupported returns whether the generators can handle a given
// function signature
func (g *Generator) isSigSupported(t types.Type) bool {
	sig := t.(*types.Signature)
	params := sig.Params()
	for i := 0; i < params.Len(); i++ {
		if !g.isSupported(params.At(i).Type()) {
			return false
		}
	}
	res := sig.Results()
	for i := 0; i < res.Len(); i++ {
		if !g.isSupported(res.At(i).Type()) {
			return false
		}
	}
	return true
}

// isSupported returns whether the generators can handle the type.
func (g *Generator) isSupported(t types.Type) bool {
	if isErrorType(t) {
		return true
	}
	switch t := t.(type) {
	case *types.Basic:
		return true
	case *types.Slice:
		switch e := t.Elem().(type) {
		case *types.Basic:
			return e.Kind() == types.Uint8
		}
	case *types.Pointer:
		switch t := t.Elem().(type) {
		case *types.Named:
			return g.validPkg(t.Obj().Pkg())
		}
	case *types.Named:
		switch t.Underlying().(type) {
		case *types.Interface, *types.Pointer:
			return g.validPkg(t.Obj().Pkg())
		}
	}
	return false
}

var paramRE = regexp.MustCompile(`^p[0-9]*$`)

// paramName replaces incompatible name with a p0-pN name.
// Missing names, or existing names of the form p[0-9] are incompatible.
// TODO(crawshaw): Replace invalid unicode names.
func paramName(params *types.Tuple, pos int) string {
	name := params.At(pos).Name()
	if name == "" || name[0] == '_' || paramRE.MatchString(name) {
		name = fmt.Sprintf("p%d", pos)
	}
	return name
}

func constExactString(o *types.Const) string {
	// TODO(hyangah): this is a temporary fix for golang.org/issues/14615.
	// Clean this up when we can require at least go 1.6 or above.

	type exactStringer interface {
		ExactString() string
	}
	v := o.Val()
	if v, ok := v.(exactStringer); ok {
		return v.ExactString()
	}
	// TODO: warning?
	return v.String()
}

func lowerFirst(s string) string {
	if s == "" {
		return ""
	}

	var conv []rune
	for len(s) > 0 {
		r, n := utf8.DecodeRuneInString(s)
		if !unicode.IsUpper(r) {
			if l := len(conv); l > 1 {
				conv[l-1] = unicode.ToUpper(conv[l-1])
			}
			return string(conv) + s
		}
		conv = append(conv, unicode.ToLower(r))
		s = s[n:]
	}
	return string(conv)
}

// newNameSanitizer returns a functions that replaces all dashes and dots
// with underscores, as well as avoiding reserved words by suffixing such
// identifiers with underscores.
func newNameSanitizer(res []string) func(s string) string {
	reserved := make(map[string]bool)
	for _, word := range res {
		reserved[word] = true
	}
	symbols := strings.NewReplacer(
		"-", "_",
		".", "_",
	)
	return func(s string) string {
		if reserved[s] {
			return s + "_"
		}
		return symbols.Replace(s)
	}
}
