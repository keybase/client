// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The objc package takes the result of an AST traversal by the
// importers package and uses the clang command to dump the type
// information for the referenced ObjC classes and protocols.
//
// It is the of go/types for ObjC types and is used by the bind
// package to generate Go wrappers for ObjC API on iOS.
package objc

import (
	"bufio"
	"bytes"
	"fmt"
	"os/exec"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/mobile/internal/importers"
)

type parser struct {
	sdkPath string
	sc      *bufio.Scanner

	decl   string
	indent int
	last   string
	// Current module as parsed from the AST tree.
	module string
}

type TypeKind int

// Named represents ObjC classes and protocols.
type Named struct {
	Name       string
	GoName     string
	Module     string
	Funcs      []*Func
	Methods    []*Func
	AllMethods []*Func
	Supers     []Super
	// For deduplication of function or method
	// declarations.
	funcMap  map[string]struct{}
	Protocol bool
	// Generated is true if the type is wrapper of a
	// generated Go struct.
	Generated bool
}

// Super denotes a super class or protocol.
type Super struct {
	Name     string
	Protocol bool
}

// Func is a ObjC method, static functions as well as
// instance methods.
type Func struct {
	Sig    string
	GoName string
	Params []*Param
	Ret    *Type
	Static bool
	// Method whose name start with "init"
	Constructor bool
}

type Param struct {
	Name string
	Type *Type
}

type Type struct {
	Kind TypeKind
	// For Interface and Protocol types.
	Name string
	// For 'id' types.
	instanceType bool
	// The declared type raw from the AST.
	Decl string
	// Set if the type is a pointer to its kind. For classes
	// Indirect is true if the type is a double pointer, e.g.
	// NSObject **.
	Indirect bool
}

const (
	Unknown TypeKind = iota
	Protocol
	Class
	String
	Data
	Int
	Uint
	Short
	Ushort
	Bool
	Char
	Uchar
	Float
	Double
)

// Import returns  descriptors for a list of references to
// ObjC protocols and classes.
//
// The type information is parsed from the output of clang -cc1
// -ast-dump.
func Import(refs *importers.References) ([]*Named, error) {
	var modules []string
	modMap := make(map[string]struct{})
	typeNames := make(map[string][]string)
	typeSet := make(map[string]struct{})
	genMods := make(map[string]struct{})
	for _, emb := range refs.Embedders {
		genMods[initialUpper(emb.Pkg)] = struct{}{}
	}
	for _, ref := range refs.Refs {
		var module, name string
		if idx := strings.Index(ref.Pkg, "/"); idx != -1 {
			// ref is a static method reference.
			module = ref.Pkg[:idx]
			name = ref.Pkg[idx+1:]
		} else {
			// ref is a type name.
			module = ref.Pkg
			name = ref.Name
		}
		if _, exists := typeSet[name]; !exists {
			typeNames[module] = append(typeNames[module], name)
			typeSet[name] = struct{}{}
		}
		if _, exists := modMap[module]; !exists {
			// Include the module only if it is generated.
			if _, exists := genMods[module]; !exists {
				modMap[module] = struct{}{}
				modules = append(modules, module)
			}
		}
	}
	sdkPathOut, err := exec.Command("xcrun", "--sdk", "iphonesimulator", "--show-sdk-path").CombinedOutput()
	if err != nil {
		return nil, err
	}
	sdkPath := strings.TrimSpace(string(sdkPathOut))
	var allTypes []*Named
	typeMap := make(map[string]*Named)
	for _, module := range modules {
		types, err := importModule(string(sdkPath), module, typeNames[module], typeMap)
		if err != nil {
			return nil, fmt.Errorf("%s: %v", module, err)
		}
		allTypes = append(allTypes, types...)
	}
	// Embedders refer to every exported Go struct that will have its class
	// generated. Allow Go code to reverse bind to those classes by synthesizing
	// their descriptors.
	for _, emb := range refs.Embedders {
		module := initialUpper(emb.Pkg)
		named := &Named{
			Name:      module + emb.Name,
			GoName:    emb.Name,
			Module:    module,
			Generated: true,
		}
		for _, ref := range emb.Refs {
			t, exists := typeMap[ref.Name]
			if !exists {
				return nil, fmt.Errorf("type not found: %q", ref.Name)
			}
			named.Supers = append(named.Supers, Super{
				Name:     t.Name,
				Protocol: t.Protocol,
			})
		}
		typeMap[emb.Name] = named
		allTypes = append(allTypes, named)
	}
	initTypes(allTypes, refs, typeMap)
	// Include implicit types that are used in parameter or return values.
	newTypes := allTypes
	for len(newTypes) > 0 {
		var impTypes []*Named
		for _, t := range newTypes {
			for _, funcs := range [][]*Func{t.Funcs, t.AllMethods} {
				for _, f := range funcs {
					types := implicitFuncTypes(f)
					for _, name := range types {
						if _, exists := typeSet[name]; exists {
							continue
						}
						typeSet[name] = struct{}{}
						t, exists := typeMap[name]
						if !exists {
							return nil, fmt.Errorf("implicit type %q not found", name)
						}
						impTypes = append(impTypes, t)
					}
				}
			}
		}
		initTypes(impTypes, refs, typeMap)
		allTypes = append(allTypes, impTypes...)
		newTypes = impTypes
	}
	return allTypes, nil
}

func implicitFuncTypes(f *Func) []string {
	var types []string
	if rt := f.Ret; rt != nil && !rt.instanceType && (rt.Kind == Class || rt.Kind == Protocol) {
		types = append(types, rt.Name)
	}
	for _, p := range f.Params {
		if t := p.Type; !t.instanceType && (t.Kind == Class || t.Kind == Protocol) {
			types = append(types, t.Name)
		}
	}
	return types
}

func initTypes(types []*Named, refs *importers.References, typeMap map[string]*Named) {
	for _, t := range types {
		fillAllMethods(t, typeMap)
	}
	// Move constructors to functions. They are represented in Go
	// as functions.
	for _, t := range types {
		var methods []*Func
		for _, f := range t.AllMethods {
			if f.Constructor {
				f.Static = true
				t.Funcs = append(t.Funcs, f)
			} else {
				methods = append(methods, f)
			}
		}
		t.AllMethods = methods
	}
	for _, t := range types {
		mangleMethodNames(t.AllMethods)
		mangleMethodNames(t.Funcs)
	}
	filterReferences(types, refs, typeMap)
	for _, t := range types {
		resolveInstanceTypes(t, t.Funcs)
		resolveInstanceTypes(t, t.AllMethods)
	}
}

func filterReferences(types []*Named, refs *importers.References, typeMap map[string]*Named) {
	refFuncs := make(map[[2]string]struct{})
	for _, ref := range refs.Refs {
		if sep := strings.Index(ref.Pkg, "/"); sep != -1 {
			pkgName := ref.Pkg[sep+1:]
			n := typeMap[pkgName]
			if n == nil {
				continue
			}
			refFuncs[[...]string{pkgName, ref.Name}] = struct{}{}
		}
	}
	for _, t := range types {
		var filtered []*Func
		for _, f := range t.Funcs {
			if _, exists := refFuncs[[...]string{t.GoName, f.GoName}]; exists {
				filtered = append(filtered, f)
			}
		}
		t.Funcs = filtered
		filtered = nil
		for _, m := range t.Methods {
			if _, exists := refs.Names[m.GoName]; exists {
				filtered = append(filtered, m)
			}
		}
		t.Methods = filtered
		filtered = nil
		for _, m := range t.AllMethods {
			if _, exists := refs.Names[m.GoName]; exists {
				filtered = append(filtered, m)
			}
		}
		t.AllMethods = filtered
	}
}

// mangleMethodsNames assigns unique Go names to ObjC methods. If a method name is unique
// within the same method list, its name is used with its first letter in upper case.
// Multiple methods with the same name have their full signature appended, with : removed.
func mangleMethodNames(allFuncs []*Func) {
	goName := func(n string, constructor bool) string {
		if constructor {
			n = "new" + n[len("init"):]
		}
		return initialUpper(n)
	}
	overloads := make(map[string][]*Func)
	for i, f := range allFuncs {
		// Copy function so each class can have its own
		// name mangling.
		f := *f
		allFuncs[i] = &f
		f.GoName = goName(f.Sig, f.Constructor)
		if colon := strings.Index(f.GoName, ":"); colon != -1 {
			f.GoName = f.GoName[:colon]
		}
		overloads[f.GoName] = append(overloads[f.GoName], &f)
	}
	fallbacks := make(map[string][]*Func)
	for _, funcs := range overloads {
		if len(funcs) == 1 {
			continue
		}
		for _, f := range funcs {
			sig := f.Sig
			if strings.HasSuffix(sig, ":") {
				sig = sig[:len(sig)-1]
			}
			sigElems := strings.Split(f.Sig, ":")
			for i := 0; i < len(sigElems); i++ {
				sigElems[i] = initialUpper(sigElems[i])
			}
			name := strings.Join(sigElems, "")
			f.GoName = goName(name, f.Constructor)
			fallbacks[f.GoName] = append(fallbacks[f.GoName], f)
		}
	}
	for _, funcs := range fallbacks {
		if len(funcs) == 1 {
			continue
		}
		for _, f := range funcs {
			name := strings.Replace(f.Sig, ":", "_", -1)
			f.GoName = goName(name, f.Constructor)
		}
	}
}

func resolveInstanceType(n *Named, t *Type) *Type {
	if !t.instanceType || t.Kind != Protocol {
		return t
	}
	// Copy and update the type name for instancetype types
	ct := *t
	ct.instanceType = false
	ct.Decl = n.Name + " *"
	if n.Name == "NSString" {
		ct.Kind = String
		ct.Name = ""
	} else {
		ct.Kind = Class
		ct.Name = n.Name
	}
	return &ct
}

func resolveInstanceTypes(n *Named, funcs []*Func) {
	for _, f := range funcs {
		for _, p := range f.Params {
			p.Type = resolveInstanceType(n, p.Type)
		}
		if f.Ret != nil {
			f.Ret = resolveInstanceType(n, f.Ret)
		}
	}
}

func fillAllMethods(n *Named, typeMap map[string]*Named) {
	if len(n.AllMethods) > 0 {
		return
	}
	if len(n.Supers) == 0 {
		n.AllMethods = n.Methods
		return
	}
	for _, sup := range n.Supers {
		super := lookup(sup.Name, sup.Protocol, typeMap)
		fillAllMethods(super, typeMap)
	}
	methods := make(map[string]struct{})
	for _, sup := range n.Supers {
		super := lookup(sup.Name, sup.Protocol, typeMap)
		for _, f := range super.AllMethods {
			if _, exists := methods[f.Sig]; !exists {
				methods[f.Sig] = struct{}{}
				n.AllMethods = append(n.AllMethods, f)
			}
		}
	}
	for _, f := range n.Methods {
		if _, exists := methods[f.Sig]; !exists {
			n.AllMethods = append(n.AllMethods, f)
		}
	}
}

const (
	frameworksPath = "/System/Library/Frameworks/"
)

// importModule parses ObjC type information with clang -cc1 -ast-dump.
//
// TODO: Use module.map files to precisely model the @import Module.Identifier
// directive. For now, importModules assumes the single umbrella header
// file Module.framework/Headers/Module.h contains every declaration.
func importModule(sdkPath, module string, identifiers []string, typeMap map[string]*Named) ([]*Named, error) {
	hFile := fmt.Sprintf(sdkPath+frameworksPath+"%s.framework/Headers/%[1]s.h", module)
	clang := exec.Command("xcrun", "--sdk", "iphonesimulator", "clang", "-cc1", "-triple", "x86_64-apple-ios8.0.0-simulator", "-isysroot", sdkPath, "-ast-dump", "-fblocks", "-fobjc-arc", "-x", "objective-c", hFile)
	out, err := clang.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("clang failed to parse module: %v: %s", err, out)
	}
	p := &parser{
		sdkPath: sdkPath,
		sc:      bufio.NewScanner(bytes.NewBuffer(out)),
	}
	if err := p.parseModule(module, typeMap); err != nil {
		return nil, err
	}
	var types []*Named
	for _, ident := range identifiers {
		named, exists := typeMap[ident]
		if !exists {
			return nil, fmt.Errorf("no such type: %s", ident)
		}
		types = append(types, named)
	}
	return types, nil
}

func (p *parser) scanLine() bool {
	for {
		l := p.last
		if l == "" {
			if !p.sc.Scan() {
				return false
			}
			l = p.sc.Text()
		} else {
			p.last = ""
		}
		indent := (strings.Index(l, "-") + 1) / 2
		switch {
		case indent > p.indent:
			// Skip
		case indent < p.indent:
			p.indent--
			p.last = l
			return false
		case indent == p.indent:
			p.decl = l[p.indent*2:]
			return true
		}
	}
}

func (p *parser) parseModule(module string, typeMap map[string]*Named) (err error) {
	defer func() {
		if rerr := recover(); rerr != nil {
			err = rerr.(error)
		}
	}()
	if !p.scanLine() {
		return nil
	}
	// A header file AST starts with
	//
	// TranslationUnitDecl 0x103833ad0 <<invalid sloc>> <invalid sloc>
	if w := p.scanWord(); w != "TranslationUnitDecl" {
		return fmt.Errorf("unexpected AST root: %q", w)
	}
	p.indent++
	for {
		if !p.scanLine() {
			break
		}
		switch w := p.scanWord(); w {
		case "ObjCCategoryDecl":
			// ObjCCategoryDecl 0x103d9bdb8 <line:48:1, line:63:2> line:48:12 NSDateCreation
			// |-ObjCInterface 0x103d9a788 'NSDate'
			// Skip the node address, the source code range, position.
			p.scanWord()
			p.parseLocation()
			catName := p.scanWord()
			p.indent++
			if !p.scanLine() {
				return fmt.Errorf("no interface for category %s", catName)
			}
			if w := p.scanWord(); w != "ObjCInterface" {
				return fmt.Errorf("unexpected declaaration %s for category %s", w, catName)
			}
			p.scanWord()
			clsName := p.scanWord()
			clsName = clsName[1 : len(clsName)-1]
			named := lookup(clsName, false, typeMap)
			if named == nil {
				return fmt.Errorf("category %s references unknown class %s", catName, clsName)
			}
			p.parseInterface(named)
		case "ObjCInterfaceDecl", "ObjCProtocolDecl":
			// ObjCProtocolDecl 0x104116450 <line:15:1, line:47:2> line:15:11 NSObject
			// or
			// ObjCInterfaceDecl 0x1041ca480 <line:17:29, line:64:2> line:17:40 UIResponder

			prot := w == "ObjCProtocolDecl"

			// Skip the node address, the source code range, position.
			p.scanWord()
			if strings.HasPrefix(p.decl, "prev ") {
				p.scanWord()
				p.scanWord()
			}
			p.parseLocation()
			if strings.HasPrefix(p.decl, "implicit ") {
				p.scanWord()
			}
			name := p.decl
			named := p.lookupOrCreate(name, prot, typeMap)
			p.indent++
			p.parseInterface(named)
		default:
		}
	}
	return nil
}

func lookup(name string, prot bool, typeMap map[string]*Named) *Named {
	var mangled string
	if prot {
		mangled = name + "P"
	} else {
		mangled = name + "C"
	}
	if n := typeMap[mangled]; n != nil {
		return n
	}
	return typeMap[name]
}

// lookupOrCreate looks up the type name in the type map. If it doesn't exist, it creates
// and returns a new type. If it does exist, it returns the existing type. If there are both
// a class and a protocol with the same name, their type names are mangled by prefixing
// 'C' or 'P' and then re-inserted into the type map.
func (p *parser) lookupOrCreate(name string, prot bool, typeMap map[string]*Named) *Named {
	mangled := name + "C"
	otherMangled := name + "P"
	if prot {
		mangled, otherMangled = otherMangled, mangled
	}
	named, exists := typeMap[mangled]
	if exists {
		return named
	}
	named, exists = typeMap[name]
	if exists {
		if named.Protocol == prot {
			return named
		}
		// Both a class and a protocol exists with the same name.
		delete(typeMap, name)
		named.GoName = otherMangled
		typeMap[otherMangled] = named
		named = &Named{
			GoName: mangled,
		}
	} else {
		named = &Named{
			GoName: name,
		}
	}
	named.Name = name
	named.Protocol = prot
	named.funcMap = make(map[string]struct{})
	named.Module = p.module
	typeMap[named.GoName] = named
	return named
}

func (p *parser) parseInterface(n *Named) {
	for {
		more := p.scanLine()
		if !more {
			break
		}
		switch w := p.scanWord(); w {
		case "super":
			if w := p.scanWord(); w != "ObjCInterface" {
				panic(fmt.Errorf("unknown super type: %s", w))
			}
			// Skip node address.
			p.scanWord()
			super := p.scanWord()
			// Remove single quotes
			super = super[1 : len(super)-1]
			n.Supers = append(n.Supers, Super{super, false})
		case "ObjCProtocol":
			p.scanWord()
			super := p.scanWord()
			super = super[1 : len(super)-1]
			n.Supers = append(n.Supers, Super{super, true})
		case "ObjCMethodDecl":
			f := p.parseMethod()
			if f == nil {
				continue
			}
			var key string
			if f.Static {
				key = "+" + f.Sig
			} else {
				key = "-" + f.Sig
			}
			if _, exists := n.funcMap[key]; !exists {
				n.funcMap[key] = struct{}{}
				if f.Static {
					n.Funcs = append(n.Funcs, f)
				} else {
					n.Methods = append(n.Methods, f)
				}
			}
		}
	}
}

func (p *parser) parseMethod() *Func {
	// ObjCMethodDecl 0x103bdfb80 <line:17:1, col:27> col:1 - isEqual: 'BOOL':'_Bool'

	// Skip the address, range, position.
	p.scanWord()
	p.parseLocation()
	if strings.HasPrefix(p.decl, "implicit") {
		p.scanWord()
	}
	f := new(Func)
	switch w := p.scanWord(); w {
	case "+":
		f.Static = true
	case "-":
		f.Static = false
	default:
		panic(fmt.Errorf("unknown method type for %q", w))
	}
	f.Sig = p.scanWord()
	if f.Sig == "dealloc" {
		// ARC forbids dealloc
		return nil
	}
	if strings.HasPrefix(f.Sig, "init") {
		f.Constructor = true
	}
	f.Ret = p.parseType()
	p.indent++
	for {
		more := p.scanLine()
		if !more {
			break
		}
		switch p.scanWord() {
		case "UnavailableAttr":
			p.indent--
			return nil
		case "ParmVarDecl":
			f.Params = append(f.Params, p.parseParameter())
		}
	}
	return f
}

func (p *parser) parseParameter() *Param {
	// ParmVarDecl 0x1041caca8 <col:70, col:80> col:80 event 'UIEvent * _Nullable':'UIEvent *'

	// Skip address, source range, position.
	p.scanWord()
	p.parseLocation()
	return &Param{Name: p.scanWord(), Type: p.parseType()}
}

func (p *parser) parseType() *Type {
	// NSUInteger':'unsigned long'
	s := strings.SplitN(p.decl, ":", 2)
	decl := s[0]
	var canon string
	if len(s) == 2 {
		canon = s[1]
	} else {
		canon = decl
	}
	// unquote the type
	canon = canon[1 : len(canon)-1]
	if canon == "void" {
		return nil
	}
	decl = decl[1 : len(decl)-1]
	instancetype := strings.HasPrefix(decl, "instancetype")
	// Strip modifiers
	mods := []string{"__strong", "__unsafe_unretained", "const", "__strong", "_Nonnull", "_Nullable", "__autoreleasing"}
	for _, mod := range mods {
		if idx := strings.Index(canon, mod); idx != -1 {
			canon = canon[:idx] + canon[idx+len(mod):]
		}
		if idx := strings.Index(decl, mod); idx != -1 {
			decl = decl[:idx] + decl[idx+len(mod):]
		}
	}
	canon = strings.TrimSpace(canon)
	decl = strings.TrimSpace(decl)
	t := &Type{
		Decl:         decl,
		instanceType: instancetype,
	}
	switch canon {
	case "int", "long", "long long":
		t.Kind = Int
	case "unsigned int", "unsigned long", "unsigned long long":
		t.Kind = Uint
	case "short":
		t.Kind = Short
	case "unsigned short":
		t.Kind = Ushort
	case "char":
		t.Kind = Char
	case "unsigned char":
		t.Kind = Uchar
	case "float":
		t.Kind = Float
	case "double":
		t.Kind = Double
	case "_Bool":
		t.Kind = Bool
	case "NSString *":
		t.Kind = String
	case "NSData *":
		t.Kind = Data
	default:
		switch {
		case strings.HasPrefix(canon, "enum"):
			t.Kind = Int
		case strings.HasPrefix(canon, "id"):
			_, gen := p.splitGeneric(canon)
			t.Kind = Protocol
			t.Name = gen
		default:
			if ind := strings.Count(canon, "*"); 1 <= ind && ind <= 2 {
				space := strings.Index(canon, " ")
				name := canon[:space]
				name, _ = p.splitGeneric(name)
				t.Kind = Class
				t.Name = name
				t.Indirect = ind > 1
			}
		}
	}
	return t
}

func (p *parser) splitGeneric(decl string) (string, string) {
	// NSArray<KeyType>
	if br := strings.Index(decl, "<"); br != -1 {
		return decl[:br], decl[br+1 : len(decl)-1]
	} else {
		return decl, ""
	}
}

func (p *parser) parseSrcPos() {
	const invPref = "<invalid sloc>"
	if strings.HasPrefix(p.decl, invPref) {
		p.decl = p.decl[len(invPref):]
		return
	}
	var loc string
	const scrPref = "<scratch space>"
	if strings.HasPrefix(p.decl, scrPref) {
		// <scratch space>:130:1
		p.decl = p.decl[len(scrPref):]
		loc = "line" + p.scanWord()
	} else {
		// line:17:2, col:18 or, a file location:
		// /.../UIKit.framework/Headers/UISelectionFeedbackGenerator.h:16:1
		loc = p.scanWord()
	}
	locs := strings.SplitN(loc, ":", 2)
	if len(locs) != 2 && len(locs) != 3 {
		panic(fmt.Errorf("invalid source position: %q", loc))
	}
	switch loc := locs[0]; loc {
	case "line", "col":
	default:
		if !strings.HasPrefix(loc, p.sdkPath) {
			panic(fmt.Errorf("invalid source position: %q", loc))
		}
		loc = loc[len(p.sdkPath):]
		switch {
		case strings.HasPrefix(loc, "/usr/include/objc/"):
			p.module = "Foundation"
		case strings.HasPrefix(loc, frameworksPath):
			loc = loc[len(frameworksPath):]
			i := strings.Index(loc, ".framework")
			if i == -1 {
				panic(fmt.Errorf("invalid source position: %q", loc))
			}
			p.module = loc[:i]
			// Some types are declared in CoreFoundation.framework
			// even though they belong in Foundation in Objective-C.
			if p.module == "CoreFoundation" {
				p.module = "Foundation"
			}
		default:
		}
	}
}

func (p *parser) parseLocation() {
	// Source ranges are on the form: <line:17:29, line:64:2>.
	if !strings.HasPrefix(p.decl, "<") {
		panic(fmt.Errorf("1no source range first in %s", p.decl))
	}
	p.decl = p.decl[1:]
	p.parseSrcPos()
	if strings.HasPrefix(p.decl, ", ") {
		p.decl = p.decl[2:]
		p.parseSrcPos()
	}
	if !strings.HasPrefix(p.decl, "> ") {
		panic(fmt.Errorf("no source range first in %s", p.decl))
	}
	p.decl = p.decl[2:]
	p.parseSrcPos()
}

func (p *parser) scanWord() string {
	i := 0
loop:
	for ; i < len(p.decl); i++ {
		switch p.decl[i] {
		case ' ', '>', ',':
			break loop
		}
	}
	w := p.decl[:i]
	p.decl = p.decl[i:]
	for len(p.decl) > 0 && p.decl[0] == ' ' {
		p.decl = p.decl[1:]
	}
	return w
}

func initialUpper(s string) string {
	if s == "" {
		return ""
	}
	r, n := utf8.DecodeRuneInString(s)
	return string(unicode.ToUpper(r)) + s[n:]
}

func (t *Named) ObjcType() string {
	if t.Protocol {
		return fmt.Sprintf("id<%s> _Nullable", t.Name)
	} else {
		return t.Name + " * _Nullable"
	}
}
