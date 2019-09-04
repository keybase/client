// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package bind

import (
	"fmt"
	"go/constant"
	"go/types"
	"math"
	"strings"

	"golang.org/x/mobile/internal/importers/objc"
)

// TODO(hyangah): handle method name conflicts.
//   - struct with SetF method and exported F field.
//   - method names conflicting with NSObject methods. e.g. Init
//   - interface type with InitWithRef.

// TODO(hyangah): error code/domain propagation

type ObjcGen struct {
	Prefix string // prefix arg passed by flag.

	*Generator

	// fields set by init.
	namePrefix string
	// Map of all wrapped Objc types
	wrapMap map[string]*objc.Named
	// Structs that embeds Objc wrapper types.
	ostructs map[*types.TypeName]*objcClassInfo
	modules  []string
	// Constructors is a map from Go struct types to a list
	// of exported constructor functions for the type, on the form
	// func New<Type>(...) *Type
	constructors map[*types.TypeName][]*types.Func
}

type objcClassInfo struct {
	// The Objc class this class extends.
	extends *objc.Named
	// All classes and protocols this class extends and conforms to.
	supers  []*objc.Named
	methods map[string]*objc.Func
}

func (g *ObjcGen) Init(wrappers []*objc.Named) {
	g.Generator.Init()
	g.namePrefix = g.namePrefixOf(g.Pkg)
	g.wrapMap = make(map[string]*objc.Named)
	g.constructors = make(map[*types.TypeName][]*types.Func)
	modMap := make(map[string]struct{})
	for _, w := range wrappers {
		g.wrapMap[w.GoName] = w
		if _, exists := modMap[w.Module]; !exists {
			if !w.Generated {
				g.modules = append(g.modules, w.Module)
			}
			modMap[w.Module] = struct{}{}
		}
	}
	if _, exists := modMap["Foundation"]; !exists {
		g.modules = append(g.modules, "Foundation")
	}
	g.ostructs = make(map[*types.TypeName]*objcClassInfo)
	for _, s := range g.structs {
		embds := embeddedObjcTypes(s.t)
		if len(embds) == 0 {
			continue
		}
		inf := &objcClassInfo{
			methods: make(map[string]*objc.Func),
		}
		for _, n := range embds {
			t := g.wrapMap[n]
			for _, f := range t.AllMethods {
				inf.methods[f.GoName] = f
			}
			inf.supers = append(inf.supers, t)
			if !t.Protocol {
				if inf.extends != nil {
					g.errorf("%s embeds more than one ObjC class; only one is allowed.", s.obj)
				}
				inf.extends = t
			}
		}
		g.ostructs[s.obj] = inf
	}
	for _, f := range g.funcs {
		if t := g.constructorType(f); t != nil {
			g.constructors[t] = append(g.constructors[t], f)
		}
	}
}

func (g *ObjcGen) namePrefixOf(pkg *types.Package) string {
	if pkg == nil {
		return "Universe"
	}
	p := g.Prefix
	return p + strings.Title(pkg.Name())
}

func (g *ObjcGen) GenGoH() error {
	var pkgPath string
	if g.Pkg != nil {
		pkgPath = g.Pkg.Path()
	}
	g.Printf(objcPreamble, pkgPath, g.gobindOpts(), pkgPath)
	g.Printf("#ifndef __GO_%s_H__\n", g.pkgName)
	g.Printf("#define __GO_%s_H__\n\n", g.pkgName)
	g.Printf("#include <stdint.h>\n")
	g.Printf("#include <objc/objc.h>\n")

	for _, i := range g.interfaces {
		if !i.summary.implementable {
			continue
		}
		for _, m := range i.summary.callable {
			if !g.isSigSupported(m.Type()) {
				g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", i.obj.Name(), m.Name())
				continue
			}
			g.genInterfaceMethodSignature(m, i.obj.Name(), true, g.paramName)
			g.Printf("\n")
		}
	}

	g.Printf("#endif\n")

	if len(g.err) > 0 {
		return g.err
	}
	return nil
}

func (g *ObjcGen) GenH() error {
	var pkgPath string
	if g.Pkg != nil {
		pkgPath = g.Pkg.Path()
	}
	g.Printf(objcPreamble, pkgPath, g.gobindOpts(), pkgPath)
	g.Printf("#ifndef __%s_H__\n", g.namePrefix)
	g.Printf("#define __%s_H__\n", g.namePrefix)
	g.Printf("\n")
	for _, m := range g.modules {
		g.Printf("@import %s;\n", m)
	}
	g.Printf("#include \"ref.h\"\n")
	if g.Pkg != nil {
		g.Printf("#include \"Universe.objc.h\"\n\n")
	}

	if g.Pkg != nil {
		for _, pkg := range g.Pkg.Imports() {
			if g.validPkg(pkg) {
				g.Printf("#include %q\n", g.namePrefixOf(pkg)+".objc.h")
			}
		}
	}
	g.Printf("\n")

	// Forward declaration of @class and @protocol
	for _, s := range g.structs {
		g.Printf("@class %s%s;\n", g.namePrefix, s.obj.Name())
	}
	for _, i := range g.interfaces {
		g.Printf("@protocol %s%s;\n", g.namePrefix, i.obj.Name())
		if i.summary.implementable {
			g.Printf("@class %s%s;\n", g.namePrefix, i.obj.Name())
			// Forward declaration for other cases will be handled at the beginning of GenM.
		}
	}
	if len(g.structs) > 0 || len(g.interfaces) > 0 {
		g.Printf("\n")
	}

	// @interfaces
	for _, i := range g.interfaces {
		g.genInterfaceH(i.obj, i.t)
		g.Printf("\n")
	}
	for _, s := range g.structs {
		g.genStructH(s.obj, s.t)
		g.Printf("\n")
	}

	// const
	// TODO: prefix with k?, or use a class method?
	for _, obj := range g.constants {
		if _, ok := obj.Type().(*types.Basic); !ok || !g.isSupported(obj.Type()) {
			g.Printf("// skipped const %s with unsupported type: %s\n\n", obj.Name(), obj.Type())
			continue
		}
		g.objcdoc(g.docs[obj.Name()].Doc())
		switch b := obj.Type().(*types.Basic); b.Kind() {
		case types.String, types.UntypedString:
			g.Printf("FOUNDATION_EXPORT NSString* _Nonnull const %s%s;\n", g.namePrefix, obj.Name())
		default:
			g.Printf("FOUNDATION_EXPORT const %s %s%s;\n", g.objcType(obj.Type()), g.namePrefix, obj.Name())
		}
	}
	if len(g.constants) > 0 {
		g.Printf("\n")
	}

	// var
	if len(g.vars) > 0 {
		g.Printf("@interface %s : NSObject\n", g.namePrefix)
		for _, obj := range g.vars {
			if t := obj.Type(); !g.isSupported(t) {
				g.Printf("// skipped variable %s with unsupported type: %s\n\n", obj.Name(), t)
				continue
			}
			objcType := g.objcType(obj.Type())
			g.objcdoc(g.docs[obj.Name()].Doc())
			g.Printf("+ (%s) %s;\n", objcType, objcNameReplacer(lowerFirst(obj.Name())))
			g.Printf("+ (void) set%s:(%s)v;\n", obj.Name(), objcType)
			g.Printf("\n")
		}
		g.Printf("@end\n\n")
	}

	// static functions.
	for _, obj := range g.funcs {
		g.genFuncH(obj)
		g.Printf("\n")
	}

	for _, i := range g.interfaces {
		if i.summary.implementable {
			g.Printf("@class %s%s;\n\n", g.namePrefix, i.obj.Name())
		}
	}
	for _, i := range g.interfaces {
		if i.summary.implementable {
			// @interface Interface -- similar to what genStructH does.
			g.genInterfaceInterface(i.obj, i.summary, true)
			g.Printf("\n")
		}
	}

	g.Printf("#endif\n")

	if len(g.err) > 0 {
		return g.err
	}
	return nil
}

func (g *ObjcGen) gobindOpts() string {
	opts := []string{"-lang=objc"}
	if g.Prefix != "" {
		opts = append(opts, fmt.Sprintf("-prefix=%q", g.Prefix))
	}
	return strings.Join(opts, " ")
}

func (g *ObjcGen) GenM() error {
	var pkgPath string
	if g.Pkg != nil {
		pkgPath = g.Pkg.Path()
	}
	g.Printf(objcPreamble, pkgPath, g.gobindOpts(), pkgPath)
	g.Printf("#include <Foundation/Foundation.h>\n")
	g.Printf("#include \"seq.h\"\n")
	g.Printf("#include \"_cgo_export.h\"\n")
	g.Printf("#include %q\n", g.namePrefix+".objc.h")
	g.Printf("\n")

	// struct
	for _, s := range g.structs {
		g.genStructM(s.obj, s.t)
		g.Printf("\n")
	}

	// interface
	var needProxy []*types.TypeName
	for _, i := range g.interfaces {
		if g.genInterfaceM(i.obj, i.t) {
			needProxy = append(needProxy, i.obj)
		}
		g.Printf("\n")
	}

	// const
	for _, o := range g.constants {
		g.genConstM(o)
	}
	if len(g.constants) > 0 {
		g.Printf("\n")
	}

	// vars
	if len(g.vars) > 0 {
		g.Printf("@implementation %s\n", g.namePrefix)
		for _, o := range g.vars {
			g.genVarM(o)
		}
		g.Printf("@end\n\n")
	}

	g.Printf("\n")

	for _, obj := range g.funcs {
		if !g.isSigSupported(obj.Type()) {
			g.Printf("// skipped function %s with unsupported parameter or return types\n\n", obj.Name())
			continue
		}
		g.genFuncM(obj)
		g.Printf("\n")
	}

	for _, i := range g.interfaces {
		for _, m := range i.summary.callable {
			if !g.isSigSupported(m.Type()) {
				g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", i.obj.Name(), m.Name())
				continue
			}
			g.genInterfaceMethodProxy(i.obj, m)
		}
	}

	g.Printf("__attribute__((constructor)) static void init() {\n")
	g.Indent()
	g.Printf("init_seq();\n")
	g.Outdent()
	g.Printf("}\n")

	if len(g.err) > 0 {
		return g.err
	}

	return nil
}

func (g *ObjcGen) genVarM(o *types.Var) {
	if t := o.Type(); !g.isSupported(t) {
		g.Printf("// skipped variable %s with unsupported type: %s\n\n", o.Name(), t)
		return
	}
	objcType := g.objcType(o.Type())

	// setter
	g.Printf("+ (void) set%s:(%s)v {\n", o.Name(), objcType)
	g.Indent()
	g.genWrite("v", o.Type(), modeRetained)
	g.Printf("var_set%s_%s(_v);\n", g.pkgPrefix, o.Name())
	g.genRelease("v", o.Type(), modeRetained)
	g.Outdent()
	g.Printf("}\n\n")

	// getter
	g.Printf("+ (%s) %s {\n", objcType, objcNameReplacer(lowerFirst(o.Name())))
	g.Indent()
	g.Printf("%s r0 = ", g.cgoType(o.Type()))
	g.Printf("var_get%s_%s();\n", g.pkgPrefix, o.Name())
	g.genRead("_r0", "r0", o.Type(), modeRetained)
	g.Printf("return _r0;\n")
	g.Outdent()
	g.Printf("}\n\n")
}

func (g *ObjcGen) genConstM(o *types.Const) {
	if _, ok := o.Type().(*types.Basic); !ok || !g.isSupported(o.Type()) {
		g.Printf("// skipped const %s with unsupported type: %s\n\n", o.Name(), o.Type())
		return
	}
	cName := fmt.Sprintf("%s%s", g.namePrefix, o.Name())
	objcType := g.objcType(o.Type())

	switch b := o.Type().(*types.Basic); b.Kind() {
	case types.Bool, types.UntypedBool:
		v := "NO"
		if constant.BoolVal(o.Val()) {
			v = "YES"
		}
		g.Printf("const BOOL %s = %s;\n", cName, v)

	case types.String, types.UntypedString:
		g.Printf("NSString* const %s = @%s;\n", cName, o.Val().ExactString())

	case types.Int, types.Int8, types.Int16, types.Int32:
		g.Printf("const %s %s = %s;\n", objcType, cName, o.Val())

	case types.Int64, types.UntypedInt:
		i, exact := constant.Int64Val(o.Val())
		if !exact {
			g.errorf("const value %s for %s cannot be represented as %s", o.Val(), o.Name(), objcType)
			return
		}
		if i == math.MinInt64 {
			// -9223372036854775808LL does not work because 922337203685477508 is
			// larger than max int64.
			g.Printf("const int64_t %s = %dLL-1;\n", cName, i+1)
		} else {
			g.Printf("const int64_t %s = %dLL;\n", cName, i)
		}

	case types.Float32, types.Float64, types.UntypedFloat:
		f, _ := constant.Float64Val(o.Val())
		if math.IsInf(f, 0) || math.Abs(f) > math.MaxFloat64 {
			g.errorf("const value %s for %s cannot be represented as double", o.Val(), o.Name())
			return
		}
		g.Printf("const %s %s = %g;\n", objcType, cName, f)

	default:
		g.errorf("unsupported const type %s for %s", b, o.Name())
	}
}

type funcSummary struct {
	name              string
	goname            string
	ret               string
	sig               *types.Signature
	params, retParams []paramInfo
	hasself           bool
	initName          string
}

type paramInfo struct {
	typ  types.Type
	name string
}

func (g *ObjcGen) funcSummary(obj *types.TypeName, f *types.Func) *funcSummary {
	sig := f.Type().(*types.Signature)
	s := &funcSummary{goname: f.Name(), sig: sig}
	var om *objc.Func
	var sigElems []string
	oinf := g.ostructs[obj]
	if oinf != nil {
		om = oinf.methods[f.Name()]
	}
	if om != nil {
		sigElems = strings.Split(om.Sig, ":")
		s.name = sigElems[0]
	} else {
		s.name = f.Name()
	}
	params := sig.Params()
	first := 0
	if oinf != nil {
		if params.Len() > 0 {
			v := params.At(0)
			if v.Name() == "self" {
				t := v.Type()
				if t, ok := t.(*types.Named); ok {
					if pkg := t.Obj().Pkg(); pkgFirstElem(pkg) == "ObjC" {
						s.hasself = true
						module := pkg.Path()[len("ObjC/"):]
						typName := module + "." + t.Obj().Name()
						exp := g.namePrefix + "." + obj.Name()
						if typName != exp {
							g.errorf("the type %s of the `this` argument to method %s is not %s", typName, f.Name(), exp)
						}
					}
				}
			}
		}
	}
	for i := first; i < params.Len(); i++ {
		p := params.At(i)
		v := paramInfo{
			typ: p.Type(),
		}
		if om != nil {
			v.name = sigElems[i-first]
		} else {
			v.name = g.paramName(params, i)
		}
		s.params = append(s.params, v)
	}
	if obj != nil {
		if pref := "New" + obj.Name(); strings.Index(f.Name(), pref) != -1 {
			s.initName = "init" + f.Name()[len(pref):]
		}
	}
	res := sig.Results()
	switch res.Len() {
	case 0:
		s.ret = "void"
	case 1:
		p := res.At(0)
		if isErrorType(p.Type()) {
			s.retParams = append(s.retParams, paramInfo{
				typ:  p.Type(),
				name: "error",
			})
			s.ret = "BOOL"
		} else {
			name := p.Name()
			if name == "" || paramRE.MatchString(name) {
				name = "ret0_"
			}
			typ := p.Type()
			s.retParams = append(s.retParams, paramInfo{typ: typ, name: name})
			s.ret = g.objcType(typ)
		}
	case 2:
		name := res.At(0).Name()
		if name == "" || paramRE.MatchString(name) {
			name = "ret0_"
		}
		typ := res.At(0).Type()
		s.retParams = append(s.retParams, paramInfo{
			typ:  typ,
			name: name,
		})
		if isNullableType(typ) {
			s.ret = g.objcType(typ) // Return is nullable, so satisfies the ObjC/Swift error protocol
		} else {
			s.ret = "BOOL" // Return is not nullable, must use an output parameter and return bool
		}

		if !isErrorType(res.At(1).Type()) {
			g.errorf("second result value must be of type error: %s", f)
			return nil
		}
		s.retParams = append(s.retParams, paramInfo{
			typ:  res.At(1).Type(),
			name: "error", // TODO(hyangah): name collision check.
		})
	default:
		// TODO(hyangah): relax the constraint on multiple return params.
		g.errorf("too many result values: %s", f)
		return nil
	}

	return s
}

func (s *funcSummary) asFunc(g *ObjcGen) string {
	var params []string
	for _, p := range s.params {
		params = append(params, g.objcParamType(p.typ)+" "+p.name)
	}
	skip := 0
	if s.returnsVal() {
		skip = 1
	}
	for _, p := range s.retParams[skip:] {
		params = append(params, g.objcType(p.typ)+"* _Nullable "+p.name)
	}
	paramContents := "void"
	if len(params) > 0 {
		paramContents = strings.Join(params, ", ")
	}
	return fmt.Sprintf("%s %s%s(%s)", s.ret, g.namePrefix, s.name, paramContents)
}

func (s *funcSummary) asMethod(g *ObjcGen) string {
	return fmt.Sprintf("(%s)%s%s", s.ret, objcNameReplacer(lowerFirst(s.name)), s.asSignature(g))
}

func (s *funcSummary) asSignature(g *ObjcGen) string {
	var params []string
	skip := 0
	if s.hasself {
		skip = 1
	}
	for i, p := range s.params[skip:] {
		var key string
		if i != 0 {
			key = p.name
		}
		params = append(params, fmt.Sprintf("%s:(%s)%s", key, g.objcParamType(p.typ), p.name))
	}
	skip = 0
	if s.returnsVal() {
		skip = 1
	}
	for _, p := range s.retParams[skip:] {
		var key string
		if len(params) > 0 {
			key = p.name
		}
		params = append(params, fmt.Sprintf("%s:(%s)%s", key, g.objcType(p.typ)+"* _Nullable", p.name))
	}
	return strings.Join(params, " ")
}

func (s *funcSummary) asInitSignature(g *ObjcGen) string {
	var params []string
	for i, p := range s.params {
		var key string
		if i > 0 {
			key = p.name
		}
		params = append(params, fmt.Sprintf("%s:(%s)%s", key, g.objcParamType(p.typ), p.name))
	}
	return strings.Join(params, " ")
}

func (s *funcSummary) callMethod(g *ObjcGen) string {
	var params []string
	for i, p := range s.params {
		var key string
		if i != 0 {
			key = p.name
		}
		params = append(params, fmt.Sprintf("%s:_%s", key, p.name))
	}
	skip := 0
	if s.returnsVal() {
		skip = 1
	}
	for _, p := range s.retParams[skip:] {
		var key string
		if len(params) > 0 {
			key = p.name
		}
		params = append(params, fmt.Sprintf("%s:&%s", key, p.name))
	}
	return fmt.Sprintf("%s%s", objcNameReplacer(lowerFirst(s.name)), strings.Join(params, " "))
}

func (s *funcSummary) returnsVal() bool {
	return (len(s.retParams) == 1 && !isErrorType(s.retParams[0].typ)) || (len(s.retParams) == 2 && isNullableType(s.retParams[0].typ))
}

func (g *ObjcGen) paramName(params *types.Tuple, pos int) string {
	name := basicParamName(params, pos)
	return objcNameReplacer(name)
}

func (g *ObjcGen) genFuncH(obj *types.Func) {
	if !g.isSigSupported(obj.Type()) {
		g.Printf("// skipped function %s with unsupported parameter or return types\n\n", obj.Name())
		return
	}
	if s := g.funcSummary(nil, obj); s != nil {
		g.objcdoc(g.docs[obj.Name()].Doc())
		g.Printf("FOUNDATION_EXPORT %s;\n", s.asFunc(g))
	}
}

func (g *ObjcGen) genFuncM(obj *types.Func) {
	s := g.funcSummary(nil, obj)
	if s == nil {
		return
	}
	g.Printf("%s {\n", s.asFunc(g))
	g.Indent()
	g.genFunc(s, "")
	g.Outdent()
	g.Printf("}\n")
}

func (g *ObjcGen) genGetter(oName string, f *types.Var) {
	t := f.Type()
	g.Printf("- (%s)%s {\n", g.objcType(t), objcNameReplacer(lowerFirst(f.Name())))
	g.Indent()
	g.Printf("int32_t refnum = go_seq_go_to_refnum(self._ref);\n")
	g.Printf("%s r0 = ", g.cgoType(f.Type()))
	g.Printf("proxy%s_%s_%s_Get(refnum);\n", g.pkgPrefix, oName, f.Name())
	g.genRead("_r0", "r0", f.Type(), modeRetained)
	g.Printf("return _r0;\n")
	g.Outdent()
	g.Printf("}\n\n")
}

func (g *ObjcGen) genSetter(oName string, f *types.Var) {
	t := f.Type()

	g.Printf("- (void)set%s:(%s)v {\n", f.Name(), g.objcType(t))
	g.Indent()
	g.Printf("int32_t refnum = go_seq_go_to_refnum(self._ref);\n")
	g.genWrite("v", f.Type(), modeRetained)
	g.Printf("proxy%s_%s_%s_Set(refnum, _v);\n", g.pkgPrefix, oName, f.Name())
	g.genRelease("v", f.Type(), modeRetained)
	g.Outdent()
	g.Printf("}\n\n")
}

func (g *ObjcGen) genWrite(varName string, t types.Type, mode varMode) {
	switch t := t.(type) {
	case *types.Basic:
		switch t.Kind() {
		case types.String:
			g.Printf("nstring _%s = go_seq_from_objc_string(%s);\n", varName, varName)
		default:
			g.Printf("%s _%s = (%s)%s;\n", g.cgoType(t), varName, g.cgoType(t), varName)
		}
	case *types.Slice:
		switch e := t.Elem().(type) {
		case *types.Basic:
			switch e.Kind() {
			case types.Uint8: // Byte.
				g.Printf("nbyteslice _%s = go_seq_from_objc_bytearray(%s, %d);\n", varName, varName, toCFlag(mode == modeRetained))
			default:
				g.errorf("unsupported type: %s", t)
			}
		default:
			g.errorf("unsupported type: %s", t)
		}
	case *types.Named:
		switch u := t.Underlying().(type) {
		case *types.Interface:
			g.genRefWrite(varName)
		default:
			g.errorf("unsupported named type: %s / %T", u, u)
		}
	case *types.Pointer:
		g.genRefWrite(varName)
	default:
		g.Printf("%s _%s = (%s)%s;\n", g.cgoType(t), varName, g.cgoType(t), varName)
	}
}

func (g *ObjcGen) genRefWrite(varName string) {
	g.Printf("int32_t _%s;\n", varName)
	g.Printf("if ([%s conformsToProtocol:@protocol(goSeqRefInterface)]) {\n", varName)
	g.Indent()
	g.Printf("id<goSeqRefInterface> %[1]s_proxy = (id<goSeqRefInterface>)(%[1]s);\n", varName)
	g.Printf("_%s = go_seq_go_to_refnum(%s_proxy._ref);\n", varName, varName)
	g.Outdent()
	g.Printf("} else {\n")
	g.Indent()
	g.Printf("_%s = go_seq_to_refnum(%s);\n", varName, varName)
	g.Outdent()
	g.Printf("}\n")
}

func (g *ObjcGen) genRefRead(toName, fromName string, t types.Type) {
	ptype := g.refTypeBase(t)
	g.Printf("%s* %s = nil;\n", ptype, toName)
	g.Printf("GoSeqRef* %s_ref = go_seq_from_refnum(%s);\n", toName, fromName)
	g.Printf("if (%s_ref != NULL) {\n", toName)
	g.Printf("	%s = %s_ref.obj;\n", toName, toName)
	g.Printf("	if (%s == nil) {\n", toName)
	if isObjcType(t) {
		g.Printf("		LOG_FATAL(@\"unexpected NULL reference\");\n")
	} else {
		g.Printf("		%s = [[%s alloc] initWithRef:%s_ref];\n", toName, ptype, toName)
	}
	g.Printf("	}\n")
	g.Printf("}\n")
}

func (g *ObjcGen) genRead(toName, fromName string, t types.Type, mode varMode) {
	switch t := t.(type) {
	case *types.Basic:
		switch t.Kind() {
		case types.String:
			g.Printf("NSString *%s = go_seq_to_objc_string(%s);\n", toName, fromName)
		case types.Bool:
			g.Printf("BOOL %s = %s ? YES : NO;\n", toName, fromName)
		default:
			g.Printf("%s %s = (%s)%s;\n", g.objcType(t), toName, g.objcType(t), fromName)
		}
	case *types.Slice:
		switch e := t.Elem().(type) {
		case *types.Basic:
			switch e.Kind() {
			case types.Uint8: // Byte.
				g.Printf("NSData *%s = go_seq_to_objc_bytearray(%s, %d);\n", toName, fromName, toCFlag(mode == modeRetained))
			default:
				g.errorf("unsupported type: %s", t)
			}
		default:
			g.errorf("unsupported type: %s", t)
		}
	case *types.Pointer:
		switch t := t.Elem().(type) {
		case *types.Named:
			g.genRefRead(toName, fromName, types.NewPointer(t))
		default:
			g.errorf("unsupported type %s", t)
		}
	case *types.Named:
		switch t.Underlying().(type) {
		case *types.Interface, *types.Pointer:
			g.genRefRead(toName, fromName, t)
		default:
			g.errorf("unsupported, direct named type %s", t)
		}
	default:
		g.Printf("%s %s = (%s)%s;\n", g.objcType(t), toName, g.objcType(t), fromName)
	}
}

func (g *ObjcGen) genFunc(s *funcSummary, objName string) {
	skip := 0
	if objName != "" {
		g.Printf("int32_t refnum = go_seq_go_to_refnum(self._ref);\n")
		if s.hasself {
			skip = 1
			g.Printf("int32_t _self = go_seq_to_refnum(self);\n")
		}
	}
	for _, p := range s.params[skip:] {
		g.genWrite(p.name, p.typ, modeTransient)
	}
	resPrefix := ""
	if len(s.retParams) > 0 {
		if len(s.retParams) == 1 {
			g.Printf("%s r0 = ", g.cgoType(s.retParams[0].typ))
		} else {
			resPrefix = "res."
			g.Printf("struct proxy%s_%s_%s_return res = ", g.pkgPrefix, objName, s.goname)
		}
	}
	g.Printf("proxy%s_%s_%s(", g.pkgPrefix, objName, s.goname)
	if objName != "" {
		g.Printf("refnum")
		if s.hasself {
			g.Printf(", _self")
		}
	}
	for i, p := range s.params[skip:] {
		if i > 0 || objName != "" {
			g.Printf(", ")
		}
		g.Printf("_%s", p.name)
	}
	g.Printf(");\n")
	for _, p := range s.params {
		g.genRelease(p.name, p.typ, modeTransient)
	}

	for i, r := range s.retParams {
		g.genRead("_"+r.name, fmt.Sprintf("%sr%d", resPrefix, i), r.typ, modeRetained)
	}
	skip = 0
	if s.returnsVal() {
		skip = 1
	}
	for _, p := range s.retParams[skip:] {
		if isErrorType(p.typ) {
			g.Printf("if (_%s != nil && %s != nil) {\n", p.name, p.name)
			g.Indent()
			g.Printf("*%s = _%s;\n", p.name, p.name)
			g.Outdent()
			g.Printf("}\n")
		} else {
			g.Printf("*%s = _%s;\n", p.name, p.name)
		}
	}

	if n := len(s.retParams); n > 0 {
		var (
			first = s.retParams[0]
			last  = s.retParams[n-1]
		)
		if (n == 1 && isErrorType(last.typ)) || (n == 2 && !isNullableType(first.typ) && isErrorType(last.typ)) {
			g.Printf("return (_%s == nil);\n", last.name)
		} else {
			if s.returnsVal() && isErrorType(last.typ) {
				g.Printf("if (_%s != nil) {\n", last.name)
				g.Indent()
				g.Printf("return nil;\n")
				g.Outdent()
				g.Printf("}\n")
			}
			g.Printf("return _%s;\n", first.name)
		}
	}
}

func (g *ObjcGen) genInterfaceInterface(obj *types.TypeName, summary ifaceSummary, isProtocol bool) {
	doc := g.docs[obj.Name()]
	g.objcdoc(doc.Doc())
	g.Printf("@interface %[1]s%[2]s : ", g.namePrefix, obj.Name())
	if isErrorType(obj.Type()) {
		g.Printf("NSError")
	} else {
		g.Printf("NSObject")
	}
	prots := []string{"goSeqRefInterface"}
	if isProtocol {
		prots = append(prots, fmt.Sprintf("%[1]s%[2]s", g.namePrefix, obj.Name()))
	}
	g.Printf(" <%s>", strings.Join(prots, ", "))
	g.Printf(" {\n}\n")
	g.Printf("@property(strong, readonly) _Nonnull id _ref;\n")
	g.Printf("\n")
	g.Printf("- (nonnull instancetype)initWithRef:(_Nonnull id)ref;\n")
	for _, m := range summary.callable {
		if !g.isSigSupported(m.Type()) {
			g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", obj.Name(), m.Name())
			continue
		}
		s := g.funcSummary(nil, m)
		g.objcdoc(doc.Member(m.Name()))
		g.Printf("- %s;\n", s.asMethod(g))
	}
	g.Printf("@end\n")
}

func (g *ObjcGen) genInterfaceH(obj *types.TypeName, t *types.Interface) {
	summary := makeIfaceSummary(t)
	if !summary.implementable {
		g.genInterfaceInterface(obj, summary, false)
		return
	}
	g.Printf("@protocol %s%s <NSObject>\n", g.namePrefix, obj.Name())
	for _, m := range makeIfaceSummary(t).callable {
		if !g.isSigSupported(m.Type()) {
			g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", obj.Name(), m.Name())
			continue
		}
		s := g.funcSummary(nil, m)
		g.Printf("- %s;\n", s.asMethod(g))
	}
	g.Printf("@end\n")
}

func (g *ObjcGen) genInterfaceM(obj *types.TypeName, t *types.Interface) bool {
	summary := makeIfaceSummary(t)

	// @implementation Interface -- similar to what genStructM does.
	g.Printf("@implementation %s%s {\n", g.namePrefix, obj.Name())
	g.Printf("}\n")
	g.Printf("\n")
	g.Printf("- (nonnull instancetype)initWithRef:(id)ref {\n")
	g.Indent()
	if isErrorType(obj.Type()) {
		g.Printf("if (self) {\n")
		g.Printf("	__ref = ref;\n")
		g.Printf("	self = [super initWithDomain:@\"go\" code:1 userInfo:@{NSLocalizedDescriptionKey: [self error]}];\n")
		g.Printf("}\n")
	} else {
		g.Printf("self = [super init];\n")
		g.Printf("if (self) { __ref = ref; }\n")
	}
	g.Printf("return self;\n")
	g.Outdent()
	g.Printf("}\n")
	g.Printf("\n")

	for _, m := range summary.callable {
		if !g.isSigSupported(m.Type()) {
			g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", obj.Name(), m.Name())
			continue
		}
		s := g.funcSummary(nil, m)
		g.Printf("- %s {\n", s.asMethod(g))
		g.Indent()
		g.genFunc(s, obj.Name())
		g.Outdent()
		g.Printf("}\n\n")
	}
	g.Printf("@end\n")
	g.Printf("\n")

	return summary.implementable
}

func (g *ObjcGen) genInterfaceMethodProxy(obj *types.TypeName, m *types.Func) {
	oName := obj.Name()
	s := g.funcSummary(nil, m)
	g.genInterfaceMethodSignature(m, oName, false, g.paramName)
	g.Indent()
	g.Printf("@autoreleasepool {\n")
	g.Indent()
	g.Printf("%s* o = go_seq_objc_from_refnum(refnum);\n", g.refTypeBase(obj.Type()))
	for _, p := range s.params {
		g.genRead("_"+p.name, p.name, p.typ, modeTransient)
	}

	// call method
	for _, p := range s.retParams {
		if isErrorType(p.typ) {
			g.Printf("NSError* %s = nil;\n", p.name)
		} else {
			g.Printf("%s %s;\n", g.objcType(p.typ), p.name)
		}
	}

	if isErrorType(obj.Type()) && m.Name() == "Error" {
		// As a special case, ObjC NSErrors are passed to Go pretending to implement the Go error interface.
		// They don't actually have an Error method, so calls to to it needs to be rerouted.
		g.Printf("%s = [o localizedDescription];\n", s.retParams[0].name)
	} else {
		if s.ret == "void" {
			g.Printf("[o %s];\n", s.callMethod(g))
		} else if !s.returnsVal() {
			g.Printf("%s returnVal = [o %s];\n", s.ret, s.callMethod(g))
		} else {
			g.Printf("%s = [o %s];\n", s.retParams[0].name, s.callMethod(g))
		}
	}

	if len(s.retParams) > 0 {
		if len(s.retParams) == 1 && !isErrorType(s.retParams[0].typ) {
			p := s.retParams[0]
			g.genWrite(p.name, p.typ, modeRetained)
			g.Printf("return _%s;\n", p.name)
		} else {
			var rets []string
			for _, p := range s.retParams {
				if isErrorType(p.typ) {
					g.Printf("NSError *_%s = nil;\n", p.name)
					if !s.returnsVal() {
						g.Printf("if (!returnVal) {\n")
					} else {
						g.Printf("if (%s != nil) {\n", p.name)
					}
					g.Indent()
					g.Printf("_%[1]s = %[1]s;\n", p.name)
					g.Outdent()
					g.Printf("}\n")
					g.genWrite("_"+p.name, p.typ, modeRetained)
					rets = append(rets, "__"+p.name)
				} else {
					g.genWrite(p.name, p.typ, modeRetained)
					rets = append(rets, "_"+p.name)
				}
			}
			if len(rets) > 1 {
				g.Printf("cproxy%s_%s_%s_return _sres = {\n", g.pkgPrefix, oName, m.Name())
				g.Printf("  %s\n", strings.Join(rets, ", "))
				g.Printf("};\n")
				g.Printf("return _sres;\n")
			} else {
				g.Printf("return %s;\n", rets[0])
			}
		}
	}
	g.Outdent()
	g.Printf("}\n")
	g.Outdent()
	g.Printf("}\n\n")
}

// genRelease cleans up arguments that weren't copied in genWrite.
func (g *ObjcGen) genRelease(varName string, t types.Type, mode varMode) {
	switch t := t.(type) {
	case *types.Slice:
		switch e := t.Elem().(type) {
		case *types.Basic:
			switch e.Kind() {
			case types.Uint8: // Byte.
				if mode == modeTransient {
					// If the argument was not mutable, go_seq_from_objc_bytearray created a copy.
					// Free it here.
					g.Printf("if (![%s isKindOfClass:[NSMutableData class]]) {\n", varName)
					g.Printf("  free(_%s.ptr);\n", varName)
					g.Printf("}\n")
				}
			}
		}
	}
}

func (g *ObjcGen) genStructH(obj *types.TypeName, t *types.Struct) {
	doc := g.docs[obj.Name()]
	g.objcdoc(doc.Doc())
	g.Printf("@interface %s%s : ", g.namePrefix, obj.Name())
	oinf := g.ostructs[obj]
	var prots []string
	if oinf != nil {
		for _, sup := range oinf.supers {
			if !sup.Protocol {
				g.Printf(sup.Name)
			} else {
				prots = append(prots, sup.Name)
			}
		}
	} else {
		g.Printf("NSObject")
		prots = append(prots, "goSeqRefInterface")
	}
	pT := types.NewPointer(obj.Type())
	for _, iface := range g.allIntf {
		p := iface.obj.Pkg()
		if g.Pkg != nil && g.Pkg != p {
			// To avoid header include cycles, only declare implementation of interfaces
			// from imported packages. TODO(elias.naur): Include every interface that
			// doesn't introduce an include cycle.
			found := false
			for _, imp := range g.Pkg.Imports() {
				if imp == p {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		obj := iface.obj
		if types.AssignableTo(pT, obj.Type()) {
			n := fmt.Sprintf("%s%s", g.namePrefixOf(obj.Pkg()), obj.Name())
			prots = append(prots, n)
		}
	}

	if len(prots) > 0 {
		g.Printf(" <%s>", strings.Join(prots, ", "))
	}
	g.Printf(" {\n")
	g.Printf("}\n")
	g.Printf("@property(strong, readonly) _Nonnull id _ref;\n")
	g.Printf("\n")
	g.Printf("- (nonnull instancetype)initWithRef:(_Nonnull id)ref;\n")
	cons := g.constructors[obj]
	if oinf == nil {
		for _, f := range cons {
			if !g.isSigSupported(f.Type()) {
				g.Printf("// skipped constructor %s.%s with unsupported parameter or return types\n\n", obj.Name(), f.Name())
				continue
			}
			g.genInitH(obj, f)
		}
	}
	if oinf != nil || len(cons) == 0 {
		// default constructor won't return nil
		g.Printf("- (nonnull instancetype)init;\n")
	}

	// accessors to exported fields.
	for _, f := range exportedFields(t) {
		if t := f.Type(); !g.isSupported(t) {
			g.Printf("// skipped field %s.%s with unsupported type: %s\n\n", obj.Name(), f.Name(), t)
			continue
		}
		name, typ := f.Name(), g.objcType(f.Type())
		g.objcdoc(doc.Member(f.Name()))

		// properties are atomic by default so explicitly say otherwise
		g.Printf("@property (nonatomic) %s %s;\n", typ, objcNameReplacer(lowerFirst(name)))
	}

	// exported methods
	for _, m := range exportedMethodSet(types.NewPointer(obj.Type())) {
		if !g.isSigSupported(m.Type()) {
			g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", obj.Name(), m.Name())
			continue
		}
		s := g.funcSummary(obj, m)
		g.objcdoc(doc.Member(m.Name()))
		g.Printf("- %s;\n", s.asMethod(g))
	}
	g.Printf("@end\n")
}

func (g *ObjcGen) objcdoc(doc string) {
	if doc == "" {
		return
	}
	g.Printf("/**\n * %s */\n", doc)
}

func (g *ObjcGen) genStructM(obj *types.TypeName, t *types.Struct) {
	fields := exportedFields(t)
	methods := exportedMethodSet(types.NewPointer(obj.Type()))

	g.Printf("\n")
	oinf := g.ostructs[obj]
	g.Printf("@implementation %s%s {\n", g.namePrefix, obj.Name())
	g.Printf("}\n\n")
	g.Printf("- (nonnull instancetype)initWithRef:(_Nonnull id)ref {\n")
	g.Indent()
	g.Printf("self = [super init];\n")
	g.Printf("if (self) { __ref = ref; }\n")
	g.Printf("return self;\n")
	g.Outdent()
	g.Printf("}\n\n")
	cons := g.constructors[obj]
	if oinf == nil {
		for _, f := range cons {
			if !g.isSigSupported(f.Type()) {
				g.Printf("// skipped constructor %s.%s with unsupported parameter or return types\n\n", obj, f.Name())
				continue
			}
			g.genInitM(obj, f)
		}
	}
	if oinf != nil || len(cons) == 0 {
		g.Printf("- (nonnull instancetype)init {\n")
		g.Indent()
		g.Printf("self = [super init];\n")
		g.Printf("if (self) {\n")
		g.Indent()
		g.Printf("__ref = go_seq_from_refnum(new_%s_%s());\n", g.pkgPrefix, obj.Name())
		g.Outdent()
		g.Printf("}\n")
		g.Printf("return self;\n")
		g.Outdent()
		g.Printf("}\n\n")
	}

	for _, f := range fields {
		if !g.isSupported(f.Type()) {
			g.Printf("// skipped unsupported field %s with type %s\n\n", f.Name(), f.Type())
			continue
		}
		g.genGetter(obj.Name(), f)
		g.genSetter(obj.Name(), f)
	}

	for _, m := range methods {
		if !g.isSigSupported(m.Type()) {
			g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", obj.Name(), m.Name())
			continue
		}
		s := g.funcSummary(obj, m)
		g.Printf("- %s {\n", s.asMethod(g))
		g.Indent()
		g.genFunc(s, obj.Name())
		g.Outdent()
		g.Printf("}\n\n")
	}
	g.Printf("@end\n\n")
}

func (g *ObjcGen) genInitH(obj *types.TypeName, f *types.Func) {
	s := g.funcSummary(obj, f)
	doc := g.docs[f.Name()]
	g.objcdoc(doc.Doc())

	// custom inits can return nil in Go so make them nullable
	g.Printf("- (nullable instancetype)%s%s;\n", s.initName, s.asInitSignature(g))
}

func (g *ObjcGen) genInitM(obj *types.TypeName, f *types.Func) {
	s := g.funcSummary(obj, f)
	g.Printf("- (instancetype)%s%s {\n", s.initName, s.asInitSignature(g))
	g.Indent()
	g.Printf("self = [super init];\n")
	g.Printf("if (!self) return nil;\n")
	for _, p := range s.params {
		g.genWrite(p.name, p.typ, modeTransient)
	}
	// Constructors always return a mandatory *T and an optional error
	if len(s.retParams) == 1 {
		g.Printf("%s refnum = ", g.cgoType(s.retParams[0].typ))
	} else {
		g.Printf("struct proxy%s__%s_return res = ", g.pkgPrefix, s.goname)
	}
	g.Printf("proxy%s__%s(", g.pkgPrefix, s.goname)
	for i, p := range s.params {
		if i > 0 {
			g.Printf(", ")
		}
		g.Printf("_%s", p.name)
	}
	g.Printf(");\n")
	for _, p := range s.params {
		g.genRelease(p.name, p.typ, modeTransient)
	}
	if len(s.retParams) == 2 {
		g.Printf("int32_t refnum = res.r0;\n")
		g.Printf("GoSeqRef *_err = go_seq_from_refnum(res.r1);\n")
	}
	g.Printf("__ref = go_seq_from_refnum(refnum);\n")
	if len(s.retParams) == 2 {
		g.Printf("if (_err != NULL)\n")
		g.Printf("	return nil;\n")
	}
	g.Printf("return self;\n")
	g.Outdent()
	g.Printf("}\n\n")
}

func (g *ObjcGen) errorf(format string, args ...interface{}) {
	g.err = append(g.err, fmt.Errorf(format, args...))
}

func (g *ObjcGen) refTypeBase(typ types.Type) string {
	switch typ := typ.(type) {
	case *types.Pointer:
		if _, ok := typ.Elem().(*types.Named); ok {
			return g.objcType(typ.Elem())
		}
	case *types.Named:
		n := typ.Obj()
		if isObjcType(typ) {
			return g.wrapMap[n.Name()].Name
		}
		if isErrorType(typ) || g.validPkg(n.Pkg()) {
			switch typ.Underlying().(type) {
			case *types.Interface, *types.Struct:
				return g.namePrefixOf(n.Pkg()) + n.Name()
			}
		}
	}

	// fallback to whatever objcType returns. This must not happen.
	return g.objcType(typ)
}

func (g *ObjcGen) objcParamType(t types.Type) string {

	switch typ := t.(type) {
	case *types.Basic:
		switch typ.Kind() {
		case types.String, types.UntypedString:
			return "NSString* _Nullable"
		}
	}

	return g.objcType(t)

}

func (g *ObjcGen) objcType(typ types.Type) string {

	if isErrorType(typ) {
		return "NSError* _Nullable"
	}

	switch typ := typ.(type) {
	case *types.Basic:
		switch typ.Kind() {
		case types.Bool, types.UntypedBool:
			return "BOOL"
		case types.Int:
			return "long"
		case types.Int8:
			return "int8_t"
		case types.Int16:
			return "int16_t"
		case types.Int32, types.UntypedRune: // types.Rune
			return "int32_t"
		case types.Int64, types.UntypedInt:
			return "int64_t"
		case types.Uint8:
			// byte is an alias of uint8, and the alias is lost.
			return "byte"
		case types.Uint16:
			return "uint16_t"
		case types.Uint32:
			return "uint32_t"
		case types.Uint64:
			return "uint64_t"
		case types.Float32:
			return "float"
		case types.Float64, types.UntypedFloat:
			return "double"
		case types.String, types.UntypedString:
			return "NSString* _Nonnull"
		default:
			g.errorf("unsupported type: %s", typ)
			return "TODO"
		}
	case *types.Slice:
		elem := g.objcType(typ.Elem())
		// Special case: NSData seems to be a better option for byte slice.
		if elem == "byte" {
			return "NSData* _Nullable"
		}
		// TODO(hyangah): support other slice types: NSArray or CFArrayRef.
		// Investigate the performance implication.
		g.errorf("unsupported type: %s", typ)
		return "TODO"
	case *types.Pointer:
		if _, ok := typ.Elem().(*types.Named); ok {
			return g.objcType(typ.Elem()) + "* _Nullable"
		}
		g.errorf("unsupported pointer to type: %s", typ)
		return "TODO"
	case *types.Named:
		n := typ.Obj()
		if isObjcType(typ) {
			w := g.wrapMap[n.Name()]
			return w.ObjcType()
		}
		if !isErrorType(typ) && !g.validPkg(n.Pkg()) {
			g.errorf("type %s is in package %s, which is not bound", n.Name(), n.Pkg().Name())
			return "TODO"
		}
		switch t := typ.Underlying().(type) {
		case *types.Interface:
			if makeIfaceSummary(t).implementable {
				return "id<" + g.namePrefixOf(n.Pkg()) + n.Name() + "> _Nullable"
			} else {
				return g.namePrefixOf(n.Pkg()) + n.Name() + "* _Nullable"
			}
		case *types.Struct:
			return g.namePrefixOf(n.Pkg()) + n.Name()
		}
		g.errorf("unsupported, named type %s", typ)
		return "TODO"
	default:
		g.errorf("unsupported type: %#+v, %s", typ, typ)
		return "TODO"
	}
}

// embeddedObjcTypes returns the possible empty list of Objc types embedded
// in the given struct type.
func embeddedObjcTypes(t *types.Struct) []string {
	typeSet := make(map[string]struct{})
	var typs []string
	for i := 0; i < t.NumFields(); i++ {
		f := t.Field(i)
		if !f.Exported() {
			continue
		}
		if ft := f.Type(); isObjcType(ft) {
			name := ft.(*types.Named).Obj().Name()
			if _, exists := typeSet[name]; !exists {
				typeSet[name] = struct{}{}
				typs = append(typs, name)
			}
		}
	}
	return typs
}

func isObjcType(t types.Type) bool {
	return typePkgFirstElem(t) == "ObjC"
}

var objcNameReplacer = newNameSanitizer([]string{
	"bool", "bycopy", "byref", "char", "const", "double", "float",
	"id", "in", "init", "inout", "int", "long", "nil", "oneway",
	"out", "self", "short", "signed", "super", "unsigned", "void",
	"volatile"})

const (
	objcPreamble = `// Objective-C API for talking to %[1]s Go package.
//   gobind %[2]s %[3]s
//
// File is generated by gobind. Do not edit.

`
)
