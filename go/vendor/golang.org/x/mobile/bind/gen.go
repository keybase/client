// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package bind

import (
	"bytes"
	"fmt"
	"go/ast"
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

// interfaceInfo comes from Init and collects the auxillary information
// needed to generate bindings for an exported Go interface in a bound
// package.
type interfaceInfo struct {
	obj     *types.TypeName
	t       *types.Interface
	summary ifaceSummary
}

// structInfo comes from Init and collects the auxillary information
// needed to generate bindings for an exported Go struct in a bound
// package.
type structInfo struct {
	obj *types.TypeName
	t   *types.Struct
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
	Files  []*ast.File
	Pkg    *types.Package
	err    ErrorList

	// fields set by init.
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

	docs pkgDocs
}

// A pkgDocs maps the name of each exported package-level declaration to its extracted documentation.
type pkgDocs map[string]*pkgDoc

type pkgDoc struct {
	doc string
	// Struct or interface fields and methods.
	members map[string]string
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
		g.parseDocs()
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
				named, ok := obj.Type().(*types.Named)
				if !ok {
					continue
				}
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
				named, ok := obj.Type().(*types.Named)
				if !ok {
					continue
				}
				if t, ok := named.Underlying().(*types.Interface); ok {
					g.allIntf = append(g.allIntf, interfaceInfo{obj, t, makeIfaceSummary(t)})
				}
			}
		}
	}
}

// parseDocs extracts documentation from a package in a form useful for lookups.
func (g *Generator) parseDocs() {
	d := make(pkgDocs)
	for _, f := range g.Files {
		for _, decl := range f.Decls {
			switch decl := decl.(type) {
			case *ast.GenDecl:
				for _, spec := range decl.Specs {
					switch spec := spec.(type) {
					case *ast.TypeSpec:
						d.addType(spec, decl.Doc)
					case *ast.ValueSpec:
						d.addValue(spec, decl.Doc)
					}
				}
			case *ast.FuncDecl:
				d.addFunc(decl)
			}
		}
	}
	g.docs = d
}

func (d pkgDocs) addValue(t *ast.ValueSpec, outerDoc *ast.CommentGroup) {
	for _, n := range t.Names {
		if !ast.IsExported(n.Name) {
			continue
		}
		doc := t.Doc
		if doc == nil {
			doc = outerDoc
		}
		if doc != nil {
			d[n.Name] = &pkgDoc{doc: doc.Text()}
		}
	}
}

func (d pkgDocs) addFunc(f *ast.FuncDecl) {
	doc := f.Doc
	if doc == nil {
		return
	}
	fn := f.Name.Name
	if !ast.IsExported(fn) {
		return
	}
	if r := f.Recv; r != nil {
		// f is a method.
		n := typeName(r.List[0].Type)
		pd, exists := d[n]
		if !exists {
			pd = &pkgDoc{members: make(map[string]string)}
			d[n] = pd
		}
		pd.members[fn] = doc.Text()
	} else {
		// f is a function.
		d[fn] = &pkgDoc{doc: doc.Text()}
	}
}

func (d pkgDocs) addType(t *ast.TypeSpec, outerDoc *ast.CommentGroup) {
	if !ast.IsExported(t.Name.Name) {
		return
	}
	doc := t.Doc
	if doc == nil {
		doc = outerDoc
	}
	pd := d[t.Name.Name]
	pd = &pkgDoc{members: make(map[string]string)}
	d[t.Name.Name] = pd
	if doc != nil {
		pd.doc = doc.Text()
	}
	var fields *ast.FieldList
	switch t := t.Type.(type) {
	case *ast.StructType:
		fields = t.Fields
	case *ast.InterfaceType:
		fields = t.Methods
	}
	if fields != nil {
		for _, field := range fields.List {
			if field.Doc != nil {
				if field.Names == nil {
					// Anonymous field. Extract name from its type.
					if n := typeName(field.Type); ast.IsExported(n) {
						pd.members[n] = field.Doc.Text()
					}
				}
				for _, n := range field.Names {
					if ast.IsExported(n.Name) {
						pd.members[n.Name] = field.Doc.Text()
					}
				}
			}
		}
	}
}

// typeName returns the type name T for expressions on the
// T, *T, **T (etc.) form.
func typeName(t ast.Expr) string {
	switch t := t.(type) {
	case *ast.StarExpr:
		return typeName(t.X)
	case *ast.Ident:
		return t.Name
	case *ast.SelectorExpr:
		return t.Sel.Name
	default:
		return ""
	}
}

func (d *pkgDoc) Doc() string {
	if d == nil {
		return ""
	}
	return d.doc
}

func (d *pkgDoc) Member(n string) string {
	if d == nil {
		return ""
	}
	return d.members[n]
}

// constructorType returns the type T for a function of the forms:
//
// func NewT...(...) *T
// func NewT...(...) (*T, error)
func (g *Generator) constructorType(f *types.Func) *types.TypeName {
	sig := f.Type().(*types.Signature)
	res := sig.Results()
	if res.Len() != 1 && !(res.Len() == 2 && isErrorType(res.At(1).Type())) {
		return nil
	}
	rt := res.At(0).Type()
	pt, ok := rt.(*types.Pointer)
	if !ok {
		return nil
	}
	nt, ok := pt.Elem().(*types.Named)
	if !ok {
		return nil
	}
	obj := nt.Obj()
	if !strings.HasPrefix(f.Name(), "New"+obj.Name()) {
		return nil
	}
	return obj
}

func toCFlag(v bool) int {
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

func (g *Generator) genInterfaceMethodSignature(m *types.Func, iName string, header bool, g_paramName func(*types.Tuple, int) string) {
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
		g.Printf(", %s %s", g.cgoType(t), g_paramName(params, i))
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

// isSigSupported reports whether the generators can handle a given
// function signature.
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

// isSupported reports whether the generators can handle the type.
func (g *Generator) isSupported(t types.Type) bool {
	if isErrorType(t) || isWrapperType(t) {
		return true
	}
	switch t := t.(type) {
	case *types.Basic:
		switch t.Kind() {
		case types.Bool, types.UntypedBool,
			types.Int,
			types.Int8, types.Uint8, // types.Byte
			types.Int16,
			types.Int32, types.UntypedRune, // types.Rune
			types.Int64, types.UntypedInt,
			types.Float32,
			types.Float64, types.UntypedFloat,
			types.String, types.UntypedString:
			return true
		}
		return false
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

// basicParamName replaces incompatible name with a p0-pN name.
// Missing names, or existing names of the form p[0-9] are incompatible.
func basicParamName(params *types.Tuple, pos int) string {
	name := params.At(pos).Name()
	if name == "" || name[0] == '_' || paramRE.MatchString(name) {
		name = fmt.Sprintf("p%d", pos)
	}
	return name
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
