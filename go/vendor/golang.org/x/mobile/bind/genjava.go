// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package bind

import (
	"fmt"
	"go/constant"
	"go/types"
	"html"
	"math"
	"reflect"
	"regexp"
	"strings"

	"golang.org/x/mobile/internal/importers/java"
)

// TODO(crawshaw): disallow basic android java type names in exported symbols.
// TODO(crawshaw): consider introducing Java functions for casting to and from interfaces at runtime.

type JavaGen struct {
	// JavaPkg is the Java package prefix for the generated classes. The prefix is prepended to the Go
	// package name to create the full Java package name.
	JavaPkg string

	*Generator

	jstructs map[*types.TypeName]*javaClassInfo
	clsMap   map[string]*java.Class
	// Constructors is a map from Go struct types to a list
	// of exported constructor functions for the type, on the form
	// func New<Type>(...) *Type
	constructors map[*types.TypeName][]*types.Func
}

type javaClassInfo struct {
	// The Java class this class extends.
	extends *java.Class
	// All Java classes and interfaces this class extends and implements.
	supers  []*java.Class
	methods map[string]*java.FuncSet
	// Does the class need a default no-arg constructor
	genNoargCon bool
}

// Init intializes the embedded Generator and initializes the Java class information
// needed to generate structs that extend Java classes and interfaces.
func (g *JavaGen) Init(classes []*java.Class) {
	g.Generator.Init()
	g.clsMap = make(map[string]*java.Class)
	for _, cls := range classes {
		g.clsMap[cls.Name] = cls
	}
	g.jstructs = make(map[*types.TypeName]*javaClassInfo)
	g.constructors = make(map[*types.TypeName][]*types.Func)
	for _, s := range g.structs {
		classes := embeddedJavaClasses(s.t)
		if len(classes) == 0 {
			continue
		}
		inf := &javaClassInfo{
			methods:     make(map[string]*java.FuncSet),
			genNoargCon: true, // java.lang.Object has a no-arg constructor
		}
		for _, n := range classes {
			cls := g.clsMap[n]
			for _, fs := range cls.AllMethods {
				hasMeth := false
				for _, f := range fs.Funcs {
					if !f.Final {
						hasMeth = true
					}
				}
				if hasMeth {
					inf.methods[fs.GoName] = fs
				}
			}
			inf.supers = append(inf.supers, cls)
			if !cls.Interface {
				if inf.extends != nil {
					g.errorf("%s embeds more than one Java class; only one is allowed.", s.obj)
				}
				if cls.Final {
					g.errorf("%s embeds final Java class %s", s.obj, cls.Name)
				}
				inf.extends = cls
				inf.genNoargCon = cls.HasNoArgCon
			}
		}
		g.jstructs[s.obj] = inf
	}
	for _, f := range g.funcs {
		if t := g.constructorType(f); t != nil {
			jinf := g.jstructs[t]
			if jinf != nil {
				sig := f.Type().(*types.Signature)
				jinf.genNoargCon = jinf.genNoargCon && sig.Params().Len() > 0
			}
			g.constructors[t] = append(g.constructors[t], f)
		}
	}
}

func (j *javaClassInfo) toJavaType(T types.Type) *java.Type {
	switch T := T.(type) {
	case *types.Basic:
		var kind java.TypeKind
		switch T.Kind() {
		case types.Bool, types.UntypedBool:
			kind = java.Boolean
		case types.Uint8:
			kind = java.Byte
		case types.Int16:
			kind = java.Short
		case types.Int32, types.UntypedRune: // types.Rune
			kind = java.Int
		case types.Int64, types.UntypedInt:
			kind = java.Long
		case types.Float32:
			kind = java.Float
		case types.Float64, types.UntypedFloat:
			kind = java.Double
		case types.String, types.UntypedString:
			kind = java.String
		default:
			return nil
		}
		return &java.Type{Kind: kind}
	case *types.Slice:
		switch e := T.Elem().(type) {
		case *types.Basic:
			switch e.Kind() {
			case types.Uint8: // Byte.
				return &java.Type{Kind: java.Array, Elem: &java.Type{Kind: java.Byte}}
			}
		}
		return nil
	case *types.Named:
		if isJavaType(T) {
			return &java.Type{Kind: java.Object, Class: classNameFor(T)}
		}
	}
	return nil
}

// lookupMethod searches the Java class descriptor for a method
// that matches the Go method.
func (j *javaClassInfo) lookupMethod(m *types.Func, hasThis bool) *java.Func {
	jm := j.methods[m.Name()]
	if jm == nil {
		// If an exact match is not found, try the method with trailing underscores
		// stripped. This way, name clashes can be avoided when overriding multiple
		// overloaded methods from Go.
		base := strings.TrimRight(m.Name(), "_")
		jm = j.methods[base]
		if jm == nil {
			return nil
		}
	}
	// A name match was found. Now use the parameter and return types to locate
	// the correct variant.
	sig := m.Type().(*types.Signature)
	params := sig.Params()
	// Convert Go parameter types to their Java counterparts, if possible.
	var jparams []*java.Type
	i := 0
	if hasThis {
		i = 1
	}
	for ; i < params.Len(); i++ {
		jparams = append(jparams, j.toJavaType(params.At(i).Type()))
	}
	var ret *java.Type
	var throws bool
	if results := sig.Results(); results.Len() > 0 {
		ret = j.toJavaType(results.At(0).Type())
		if results.Len() > 1 {
			throws = isErrorType(results.At(1).Type())
		}
	}
loop:
	for _, f := range jm.Funcs {
		if len(f.Params) != len(jparams) {
			continue
		}
		if throws != (f.Throws != "") {
			continue
		}
		if !reflect.DeepEqual(ret, f.Ret) {
			continue
		}
		for i, p := range f.Params {
			if !reflect.DeepEqual(p, jparams[i]) {
				continue loop
			}
		}
		return f
	}
	return nil
}

// ClassNames returns the list of names of the generated Java classes and interfaces.
func (g *JavaGen) ClassNames() []string {
	var names []string
	for _, s := range g.structs {
		names = append(names, g.javaTypeName(s.obj.Name()))
	}
	for _, iface := range g.interfaces {
		names = append(names, g.javaTypeName(iface.obj.Name()))
	}
	return names
}

func (g *JavaGen) GenClass(idx int) error {
	ns := len(g.structs)
	if idx < ns {
		s := g.structs[idx]
		g.genStruct(s)
	} else {
		iface := g.interfaces[idx-ns]
		g.genInterface(iface)
	}
	if len(g.err) > 0 {
		return g.err
	}
	return nil
}

func (g *JavaGen) genProxyImpl(name string) {
	g.Printf("private final int refnum;\n\n")
	g.Printf("@Override public final int incRefnum() {\n")
	g.Printf("      Seq.incGoRef(refnum, this);\n")
	g.Printf("      return refnum;\n")
	g.Printf("}\n\n")
}

func (g *JavaGen) genStruct(s structInfo) {
	pkgPath := ""
	if g.Pkg != nil {
		pkgPath = g.Pkg.Path()
	}
	n := g.javaTypeName(s.obj.Name())
	g.Printf(javaPreamble, g.javaPkgName(g.Pkg), n, g.gobindOpts(), pkgPath)

	fields := exportedFields(s.t)
	methods := exportedMethodSet(types.NewPointer(s.obj.Type()))

	var impls []string
	jinf := g.jstructs[s.obj]
	if jinf != nil {
		impls = append(impls, "Seq.GoObject")
		for _, cls := range jinf.supers {
			if cls.Interface {
				impls = append(impls, g.javaTypeName(cls.Name))
			}
		}
	} else {
		impls = append(impls, "Seq.Proxy")
	}

	pT := types.NewPointer(s.obj.Type())
	for _, iface := range g.allIntf {
		if types.AssignableTo(pT, iface.obj.Type()) {
			n := iface.obj.Name()
			if p := iface.obj.Pkg(); p != g.Pkg {
				if n == JavaClassName(p) {
					n = n + "_"
				}
				n = fmt.Sprintf("%s.%s", g.javaPkgName(p), n)
			} else {
				n = g.javaTypeName(n)
			}
			impls = append(impls, n)
		}
	}

	doc := g.docs[n]
	g.javadoc(doc.Doc())
	g.Printf("public final class %s", n)
	if jinf != nil {
		if jinf.extends != nil {
			g.Printf(" extends %s", g.javaTypeName(jinf.extends.Name))
		}
	}
	if len(impls) > 0 {
		g.Printf(" implements %s", strings.Join(impls, ", "))
	}
	g.Printf(" {\n")
	g.Indent()

	g.Printf("static { %s.touch(); }\n\n", g.className())
	g.genProxyImpl(n)
	cons := g.constructors[s.obj]
	for _, f := range cons {
		if !g.isConsSigSupported(f.Type()) {
			g.Printf("// skipped constructor %s.%s with unsupported parameter or return types\n\n", n, f.Name())
			continue
		}
		g.genConstructor(f, n, jinf != nil)
	}
	if jinf == nil || jinf.genNoargCon {
		// constructor for Go instantiated instances.
		g.Printf("%s(int refnum) { this.refnum = refnum; Seq.trackGoRef(refnum, this); }\n\n", n)
		if len(cons) == 0 {
			// Generate default no-arg constructor
			g.Printf("public %s() { this.refnum = __New(); Seq.trackGoRef(refnum, this); }\n\n", n)
			g.Printf("private static native int __New();\n\n")
		}
	}

	for _, f := range fields {
		if t := f.Type(); !g.isSupported(t) {
			g.Printf("// skipped field %s.%s with unsupported type: %s\n\n", n, f.Name(), t)
			continue
		}

		fdoc := doc.Member(f.Name())
		g.javadoc(fdoc)
		g.Printf("public final native %s get%s();\n", g.javaType(f.Type()), f.Name())
		g.javadoc(fdoc)
		g.Printf("public final native void set%s(%s v);\n\n", f.Name(), g.javaType(f.Type()))
	}

	var isStringer bool
	for _, m := range methods {
		if !g.isSigSupported(m.Type()) {
			g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", n, m.Name())
			continue
		}
		g.javadoc(doc.Member(m.Name()))
		var jm *java.Func
		hasThis := false
		if jinf != nil {
			hasThis = g.hasThis(n, m)
			jm = jinf.lookupMethod(m, hasThis)
			if jm != nil {
				g.Printf("@Override ")
			}
		}
		g.Printf("public native ")
		g.genFuncSignature(m, jm, hasThis)
		t := m.Type().(*types.Signature)
		isStringer = isStringer || (m.Name() == "String" && t.Params().Len() == 0 && t.Results().Len() == 1 &&
			types.Identical(t.Results().At(0).Type(), types.Typ[types.String]))
	}

	if jinf == nil {
		g.genObjectMethods(n, fields, isStringer)
	}

	g.Outdent()
	g.Printf("}\n\n")
}

// isConsSigSupported reports whether the generators can handle a given
// constructor signature.
func (g *JavaGen) isConsSigSupported(t types.Type) bool {
	if !g.isSigSupported(t) {
		return false
	}
	// Skip constructors taking a single int32 argument
	// since they clash with the proxy constructors that
	// take a refnum.
	params := t.(*types.Signature).Params()
	if params.Len() != 1 {
		return true
	}
	if t, ok := params.At(0).Type().(*types.Basic); ok {
		switch t.Kind() {
		case types.Int32, types.Uint32:
			return false
		}
	}
	return true
}

// javaTypeName returns the class name of a given Go type name. If
// the type name clashes with the package class name, an underscore is
// appended.
func (g *JavaGen) javaTypeName(n string) string {
	if n == JavaClassName(g.Pkg) {
		return n + "_"
	}
	return n
}

func (g *JavaGen) javadoc(doc string) {
	if doc == "" {
		return
	}
	// JavaDoc expects HTML-escaped documentation.
	g.Printf("/**\n * %s */\n", html.EscapeString(doc))
}

// hasThis reports whether a method has an implicit "this" parameter.
func (g *JavaGen) hasThis(sName string, m *types.Func) bool {
	sig := m.Type().(*types.Signature)
	params := sig.Params()
	if params.Len() == 0 {
		return false
	}
	v := params.At(0)
	if v.Name() != "this" {
		return false
	}
	t, ok := v.Type().(*types.Named)
	if !ok {
		return false
	}
	obj := t.Obj()
	pkg := obj.Pkg()
	if pkgFirstElem(pkg) != "Java" {
		return false
	}
	clsName := classNameFor(t)
	exp := g.javaPkgName(g.Pkg) + "." + sName
	if clsName != exp {
		g.errorf("the type %s of the `this` argument to method %s.%s is not %s", clsName, sName, m.Name(), exp)
		return false
	}
	return true
}

func (g *JavaGen) genConstructor(f *types.Func, n string, jcls bool) {
	g.javadoc(g.docs[f.Name()].Doc())
	g.Printf("public %s(", n)
	g.genFuncArgs(f, nil, false)
	g.Printf(") {\n")
	g.Indent()
	sig := f.Type().(*types.Signature)
	params := sig.Params()
	if jcls {
		g.Printf("super(")
		for i := 0; i < params.Len(); i++ {
			if i > 0 {
				g.Printf(", ")
			}
			g.Printf(g.paramName(params, i))
		}
		g.Printf(");\n")
	}
	g.Printf("this.refnum = ")
	g.Printf("__%s(", f.Name())
	for i := 0; i < params.Len(); i++ {
		if i > 0 {
			g.Printf(", ")
		}
		g.Printf(g.paramName(params, i))
	}
	g.Printf(");\n")
	g.Printf("Seq.trackGoRef(refnum, this);\n")
	g.Outdent()
	g.Printf("}\n\n")
	g.Printf("private static native int __%s(", f.Name())
	g.genFuncArgs(f, nil, false)
	g.Printf(");\n\n")
}

// genFuncArgs generated Java function arguments declaration for the function f.
// If the supplied overridden java function is supplied, genFuncArgs omits the implicit
// this argument.
func (g *JavaGen) genFuncArgs(f *types.Func, jm *java.Func, hasThis bool) {
	sig := f.Type().(*types.Signature)
	params := sig.Params()
	first := 0
	if hasThis {
		// Skip the implicit this argument to the Go method
		first = 1
	}
	for i := first; i < params.Len(); i++ {
		if i > first {
			g.Printf(", ")
		}
		v := params.At(i)
		name := g.paramName(params, i)
		jt := g.javaType(v.Type())
		g.Printf("%s %s", jt, name)
	}
}

func (g *JavaGen) genObjectMethods(n string, fields []*types.Var, isStringer bool) {
	g.Printf("@Override public boolean equals(Object o) {\n")
	g.Indent()
	g.Printf("if (o == null || !(o instanceof %s)) {\n    return false;\n}\n", n)
	g.Printf("%s that = (%s)o;\n", n, n)
	for _, f := range fields {
		if t := f.Type(); !g.isSupported(t) {
			g.Printf("// skipped field %s.%s with unsupported type: %s\n\n", n, f.Name(), t)
			continue
		}
		nf := f.Name()
		g.Printf("%s this%s = get%s();\n", g.javaType(f.Type()), nf, nf)
		g.Printf("%s that%s = that.get%s();\n", g.javaType(f.Type()), nf, nf)
		if isJavaPrimitive(f.Type()) {
			g.Printf("if (this%s != that%s) {\n    return false;\n}\n", nf, nf)
		} else {
			g.Printf("if (this%s == null) {\n", nf)
			g.Indent()
			g.Printf("if (that%s != null) {\n    return false;\n}\n", nf)
			g.Outdent()
			g.Printf("} else if (!this%s.equals(that%s)) {\n    return false;\n}\n", nf, nf)
		}
	}
	g.Printf("return true;\n")
	g.Outdent()
	g.Printf("}\n\n")

	g.Printf("@Override public int hashCode() {\n")
	g.Printf("    return java.util.Arrays.hashCode(new Object[] {")
	idx := 0
	for _, f := range fields {
		if t := f.Type(); !g.isSupported(t) {
			continue
		}
		if idx > 0 {
			g.Printf(", ")
		}
		idx++
		g.Printf("get%s()", f.Name())
	}
	g.Printf("});\n")
	g.Printf("}\n\n")

	g.Printf("@Override public String toString() {\n")
	g.Indent()
	if isStringer {
		g.Printf("return string();\n")
	} else {
		g.Printf("StringBuilder b = new StringBuilder();\n")
		g.Printf(`b.append("%s").append("{");`, n)
		g.Printf("\n")
		for _, f := range fields {
			if t := f.Type(); !g.isSupported(t) {
				continue
			}
			n := f.Name()
			g.Printf(`b.append("%s:").append(get%s()).append(",");`, n, n)
			g.Printf("\n")
		}
		g.Printf(`return b.append("}").toString();`)
		g.Printf("\n")
	}
	g.Outdent()
	g.Printf("}\n")
}

func (g *JavaGen) genInterface(iface interfaceInfo) {
	pkgPath := ""
	if g.Pkg != nil {
		pkgPath = g.Pkg.Path()
	}
	g.Printf(javaPreamble, g.javaPkgName(g.Pkg), g.javaTypeName(iface.obj.Name()), g.gobindOpts(), pkgPath)

	var exts []string
	numM := iface.t.NumMethods()
	for _, other := range g.allIntf {
		// Only extend interfaces with fewer methods to avoid circular references
		if other.t.NumMethods() < numM && types.AssignableTo(iface.t, other.t) {
			n := other.obj.Name()
			if p := other.obj.Pkg(); p != g.Pkg {
				if n == JavaClassName(p) {
					n = n + "_"
				}
				n = fmt.Sprintf("%s.%s", g.javaPkgName(p), n)
			} else {
				n = g.javaTypeName(n)
			}
			exts = append(exts, n)
		}
	}
	doc := g.docs[iface.obj.Name()]
	g.javadoc(doc.Doc())
	g.Printf("public interface %s", g.javaTypeName(iface.obj.Name()))
	if len(exts) > 0 {
		g.Printf(" extends %s", strings.Join(exts, ", "))
	}
	g.Printf(" {\n")
	g.Indent()

	for _, m := range iface.summary.callable {
		if !g.isSigSupported(m.Type()) {
			g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", iface.obj.Name(), m.Name())
			continue
		}
		g.javadoc(doc.Member(m.Name()))
		g.Printf("public ")
		g.genFuncSignature(m, nil, false)
	}

	g.Printf("\n")

	g.Outdent()
	g.Printf("}\n\n")
}

func isJavaPrimitive(T types.Type) bool {
	b, ok := T.(*types.Basic)
	if !ok {
		return false
	}
	switch b.Kind() {
	case types.Bool, types.Uint8, types.Float32, types.Float64,
		types.Int, types.Int8, types.Int16, types.Int32, types.Int64:
		return true
	}
	return false
}

// jniType returns a string that can be used as a JNI type.
func (g *JavaGen) jniType(T types.Type) string {
	switch T := T.(type) {
	case *types.Basic:
		switch T.Kind() {
		case types.Bool, types.UntypedBool:
			return "jboolean"
		case types.Int:
			return "jlong"
		case types.Int8:
			return "jbyte"
		case types.Int16:
			return "jshort"
		case types.Int32, types.UntypedRune: // types.Rune
			return "jint"
		case types.Int64, types.UntypedInt:
			return "jlong"
		case types.Uint8: // types.Byte
			// TODO(crawshaw): Java bytes are signed, so this is
			// questionable, but vital.
			return "jbyte"
		// TODO(crawshaw): case types.Uint, types.Uint16, types.Uint32, types.Uint64:
		case types.Float32:
			return "jfloat"
		case types.Float64, types.UntypedFloat:
			return "jdouble"
		case types.String, types.UntypedString:
			return "jstring"
		default:
			g.errorf("unsupported basic type: %s", T)
			return "TODO"
		}
	case *types.Slice:
		return "jbyteArray"

	case *types.Pointer:
		if _, ok := T.Elem().(*types.Named); ok {
			return g.jniType(T.Elem())
		}
		g.errorf("unsupported pointer to type: %s", T)
	case *types.Named:
		return "jobject"
	default:
		g.errorf("unsupported jniType: %#+v, %s\n", T, T)
	}
	return "TODO"
}

func (g *JavaGen) javaBasicType(T *types.Basic) string {
	switch T.Kind() {
	case types.Bool, types.UntypedBool:
		return "boolean"
	case types.Int:
		return "long"
	case types.Int8:
		return "byte"
	case types.Int16:
		return "short"
	case types.Int32, types.UntypedRune: // types.Rune
		return "int"
	case types.Int64, types.UntypedInt:
		return "long"
	case types.Uint8: // types.Byte
		// TODO(crawshaw): Java bytes are signed, so this is
		// questionable, but vital.
		return "byte"
	// TODO(crawshaw): case types.Uint, types.Uint16, types.Uint32, types.Uint64:
	case types.Float32:
		return "float"
	case types.Float64, types.UntypedFloat:
		return "double"
	case types.String, types.UntypedString:
		return "String"
	default:
		g.errorf("unsupported basic type: %s", T)
		return "TODO"
	}
}

// javaType returns a string that can be used as a Java type.
func (g *JavaGen) javaType(T types.Type) string {
	if isErrorType(T) {
		// The error type is usually translated into an exception in
		// Java, however the type can be exposed in other ways, such
		// as an exported field.
		return "java.lang.Exception"
	} else if isJavaType(T) {
		return classNameFor(T)
	}
	switch T := T.(type) {
	case *types.Basic:
		return g.javaBasicType(T)
	case *types.Slice:
		elem := g.javaType(T.Elem())
		return elem + "[]"

	case *types.Pointer:
		if _, ok := T.Elem().(*types.Named); ok {
			return g.javaType(T.Elem())
		}
		g.errorf("unsupported pointer to type: %s", T)
	case *types.Named:
		n := T.Obj()
		nPkg := n.Pkg()
		if !isErrorType(T) && !g.validPkg(nPkg) {
			g.errorf("type %s is in %s, which is not bound", n.Name(), nPkg)
			break
		}
		// TODO(crawshaw): more checking here
		clsName := n.Name()
		if nPkg != g.Pkg {
			if clsName == JavaClassName(nPkg) {
				clsName += "_"
			}
			return fmt.Sprintf("%s.%s", g.javaPkgName(nPkg), clsName)
		} else {
			return g.javaTypeName(clsName)
		}
	default:
		g.errorf("unsupported javaType: %#+v, %s\n", T, T)
	}
	return "TODO"
}

func (g *JavaGen) genJNIFuncSignature(o *types.Func, sName string, jm *java.Func, proxy, isjava bool) {
	sig := o.Type().(*types.Signature)
	res := sig.Results()

	var ret string
	switch res.Len() {
	case 2:
		ret = g.jniType(res.At(0).Type())
	case 1:
		if isErrorType(res.At(0).Type()) {
			ret = "void"
		} else {
			ret = g.jniType(res.At(0).Type())
		}
	case 0:
		ret = "void"
	default:
		g.errorf("too many result values: %s", o)
		return
	}

	g.Printf("JNIEXPORT %s JNICALL\n", ret)
	g.Printf("Java_%s_", g.jniPkgName())
	if sName != "" {
		if proxy {
			g.Printf(java.JNIMangle(g.className()))
			// 0024 is the mangled form of $, for naming inner classes.
			g.Printf("_00024proxy%s", sName)
		} else {
			g.Printf(java.JNIMangle(g.javaTypeName(sName)))
		}
	} else {
		g.Printf(java.JNIMangle(g.className()))
	}
	g.Printf("_")
	if jm != nil {
		g.Printf(jm.JNIName)
	} else {
		oName := javaNameReplacer(lowerFirst(o.Name()))
		g.Printf(java.JNIMangle(oName))
	}
	g.Printf("(JNIEnv* env, ")
	if sName != "" {
		g.Printf("jobject __this__")
	} else {
		g.Printf("jclass _clazz")
	}
	params := sig.Params()
	i := 0
	if isjava && params.Len() > 0 && params.At(0).Name() == "this" {
		// Skip the implicit this argument, if any.
		i = 1
	}
	for ; i < params.Len(); i++ {
		g.Printf(", ")
		v := sig.Params().At(i)
		name := g.paramName(params, i)
		jt := g.jniType(v.Type())
		g.Printf("%s %s", jt, name)
	}
	g.Printf(")")
}

func (g *JavaGen) jniPkgName() string {
	return strings.Replace(java.JNIMangle(g.javaPkgName(g.Pkg)), ".", "_", -1)
}

var javaLetterDigitRE = regexp.MustCompile(`[0-9a-zA-Z$_]`)

func (g *JavaGen) paramName(params *types.Tuple, pos int) string {
	name := basicParamName(params, pos)
	if !javaLetterDigitRE.MatchString(name) {
		name = fmt.Sprintf("p%d", pos)
	}
	return javaNameReplacer(name)
}

func (g *JavaGen) genFuncSignature(o *types.Func, jm *java.Func, hasThis bool) {
	sig := o.Type().(*types.Signature)
	res := sig.Results()

	var returnsError bool
	var ret string
	switch res.Len() {
	case 2:
		if !isErrorType(res.At(1).Type()) {
			g.errorf("second result value must be of type error: %s", o)
			return
		}
		returnsError = true
		ret = g.javaType(res.At(0).Type())
	case 1:
		if isErrorType(res.At(0).Type()) {
			returnsError = true
			ret = "void"
		} else {
			ret = g.javaType(res.At(0).Type())
		}
	case 0:
		ret = "void"
	default:
		g.errorf("too many result values: %s", o)
		return
	}

	g.Printf("%s ", ret)
	if jm != nil {
		g.Printf(jm.Name)
	} else {
		g.Printf(javaNameReplacer(lowerFirst(o.Name())))
	}
	g.Printf("(")
	g.genFuncArgs(o, jm, hasThis)
	g.Printf(")")
	if returnsError {
		if jm != nil {
			if jm.Throws == "" {
				g.errorf("%s declares an error return value but the overriden method does not throw", o)
				return
			}
			g.Printf(" throws %s", jm.Throws)
		} else {
			g.Printf(" throws Exception")
		}
	}
	g.Printf(";\n")
}

func (g *JavaGen) genVar(o *types.Var) {
	if t := o.Type(); !g.isSupported(t) {
		g.Printf("// skipped variable %s with unsupported type: %s\n\n", o.Name(), t)
		return
	}
	jType := g.javaType(o.Type())

	doc := g.docs[o.Name()].Doc()
	// setter
	g.javadoc(doc)
	g.Printf("public static native void set%s(%s v);\n", o.Name(), jType)

	// getter
	g.javadoc(doc)
	g.Printf("public static native %s get%s();\n\n", jType, o.Name())
}

// genCRetClear clears the result value from a JNI call if an exception was
// raised.
func (g *JavaGen) genCRetClear(varName string, t types.Type, exc string) {
	g.Printf("if (%s != NULL) {\n", exc)
	g.Indent()
	switch t := t.(type) {
	case *types.Basic:
		switch t.Kind() {
		case types.String:
			g.Printf("%s = NULL;\n", varName)
		default:
			g.Printf("%s = 0;\n", varName)
		}
	case *types.Slice, *types.Named, *types.Pointer:
		g.Printf("%s = NULL;\n", varName)
	}
	g.Outdent()
	g.Printf("}\n")
}

func (g *JavaGen) genJavaToC(varName string, t types.Type, mode varMode) {
	switch t := t.(type) {
	case *types.Basic:
		switch t.Kind() {
		case types.String:
			g.Printf("nstring _%s = go_seq_from_java_string(env, %s);\n", varName, varName)
		default:
			g.Printf("%s _%s = (%s)%s;\n", g.cgoType(t), varName, g.cgoType(t), varName)
		}
	case *types.Slice:
		switch e := t.Elem().(type) {
		case *types.Basic:
			switch e.Kind() {
			case types.Uint8: // Byte.
				g.Printf("nbyteslice _%s = go_seq_from_java_bytearray(env, %s, %d);\n", varName, varName, toCFlag(mode == modeRetained))
			default:
				g.errorf("unsupported type: %s", t)
			}
		default:
			g.errorf("unsupported type: %s", t)
		}
	case *types.Named:
		switch u := t.Underlying().(type) {
		case *types.Interface:
			g.Printf("int32_t _%s = go_seq_to_refnum(env, %s);\n", varName, varName)
		default:
			g.errorf("unsupported named type: %s / %T", u, u)
		}
	case *types.Pointer:
		g.Printf("int32_t _%s = go_seq_to_refnum(env, %s);\n", varName, varName)
	default:
		g.Printf("%s _%s = (%s)%s;\n", g.cgoType(t), varName, g.cgoType(t), varName)
	}
}

func (g *JavaGen) genCToJava(toName, fromName string, t types.Type, mode varMode) {
	switch t := t.(type) {
	case *types.Basic:
		switch t.Kind() {
		case types.String:
			g.Printf("jstring %s = go_seq_to_java_string(env, %s);\n", toName, fromName)
		case types.Bool:
			g.Printf("jboolean %s = %s ? JNI_TRUE : JNI_FALSE;\n", toName, fromName)
		default:
			g.Printf("%s %s = (%s)%s;\n", g.jniType(t), toName, g.jniType(t), fromName)
		}
	case *types.Slice:
		switch e := t.Elem().(type) {
		case *types.Basic:
			switch e.Kind() {
			case types.Uint8: // Byte.
				g.Printf("jbyteArray %s = go_seq_to_java_bytearray(env, %s, %d);\n", toName, fromName, toCFlag(mode == modeRetained))
			default:
				g.errorf("unsupported type: %s", t)
			}
		default:
			g.errorf("unsupported type: %s", t)
		}
	case *types.Pointer:
		// TODO(crawshaw): test *int
		// TODO(crawshaw): test **Generator
		switch t := t.Elem().(type) {
		case *types.Named:
			g.genFromRefnum(toName, fromName, t, t.Obj())
		default:
			g.errorf("unsupported type %s", t)
		}
	case *types.Named:
		switch t.Underlying().(type) {
		case *types.Interface, *types.Pointer:
			g.genFromRefnum(toName, fromName, t, t.Obj())
		default:
			g.errorf("unsupported, direct named type %s", t)
		}
	default:
		g.Printf("%s %s = (%s)%s;\n", g.jniType(t), toName, g.jniType(t), fromName)
	}
}

func (g *JavaGen) genFromRefnum(toName, fromName string, t types.Type, o *types.TypeName) {
	oPkg := o.Pkg()
	isJava := isJavaType(o.Type())
	if !isErrorType(o.Type()) && !g.validPkg(oPkg) && !isJava {
		g.errorf("type %s is defined in package %s, which is not bound", t, oPkg)
		return
	}
	p := pkgPrefix(oPkg)
	g.Printf("jobject %s = go_seq_from_refnum(env, %s, ", toName, fromName)
	if isJava {
		g.Printf("NULL, NULL")
	} else {
		g.Printf("proxy_class_%s_%s, proxy_class_%s_%s_cons", p, o.Name(), p, o.Name())
	}
	g.Printf(");\n")
}

func (g *JavaGen) gobindOpts() string {
	opts := []string{"-lang=java"}
	if g.JavaPkg != "" {
		opts = append(opts, "-javapkg="+g.JavaPkg)
	}
	return strings.Join(opts, " ")
}

var javaNameReplacer = newNameSanitizer([]string{
	"abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
	"class", "const", "continue", "default", "do", "double", "else", "enum",
	"extends", "final", "finally", "float", "for", "goto", "if", "implements",
	"import", "instanceof", "int", "interface", "long", "native", "new", "package",
	"private", "protected", "public", "return", "short", "static", "strictfp",
	"super", "switch", "synchronized", "this", "throw", "throws", "transient",
	"try", "void", "volatile", "while", "false", "null", "true"})

func (g *JavaGen) javaPkgName(pkg *types.Package) string {
	return JavaPkgName(g.JavaPkg, pkg)
}

// JavaPkgName returns the Java package name for a Go package
// given a pkg prefix. If the prefix is empty, "go" is used
// instead.
func JavaPkgName(pkgPrefix string, pkg *types.Package) string {
	if pkg == nil {
		return "go"
	}
	s := javaNameReplacer(pkg.Name())
	if pkgPrefix == "" {
		return s
	}
	return pkgPrefix + "." + s
}

func (g *JavaGen) className() string {
	return JavaClassName(g.Pkg)
}

// JavaClassName returns the name of the Java class that
// contains Go package level identifiers.
func JavaClassName(pkg *types.Package) string {
	if pkg == nil {
		return "Universe"
	}
	return javaNameReplacer(strings.Title(pkg.Name()))
}

func (g *JavaGen) genConst(o *types.Const) {
	if _, ok := o.Type().(*types.Basic); !ok || !g.isSupported(o.Type()) {
		g.Printf("// skipped const %s with unsupported type: %s\n\n", o.Name(), o.Type())
		return
	}
	// TODO(hyangah): should const names use upper cases + "_"?
	// TODO(hyangah): check invalid names.
	jType := g.javaType(o.Type())
	val := o.Val().ExactString()
	switch b := o.Type().(*types.Basic); b.Kind() {
	case types.Int64, types.UntypedInt:
		i, exact := constant.Int64Val(o.Val())
		if !exact {
			g.errorf("const value %s for %s cannot be represented as %s", val, o.Name(), jType)
			return
		}
		val = fmt.Sprintf("%dL", i)

	case types.Float32:
		f, _ := constant.Float32Val(o.Val())
		val = fmt.Sprintf("%gf", f)

	case types.Float64, types.UntypedFloat:
		f, _ := constant.Float64Val(o.Val())
		if math.IsInf(f, 0) || math.Abs(f) > math.MaxFloat64 {
			g.errorf("const value %s for %s cannot be represented as %s", val, o.Name(), jType)
			return
		}
		val = fmt.Sprintf("%g", f)
	}
	g.javadoc(g.docs[o.Name()].Doc())
	g.Printf("public static final %s %s = %s;\n", g.javaType(o.Type()), o.Name(), val)
}

func (g *JavaGen) genJNIField(o *types.TypeName, f *types.Var) {
	if t := f.Type(); !g.isSupported(t) {
		g.Printf("// skipped field %s with unsupported type: %s\n\n", o.Name(), t)
		return
	}
	n := java.JNIMangle(g.javaTypeName(o.Name()))
	// setter
	g.Printf("JNIEXPORT void JNICALL\n")
	g.Printf("Java_%s_%s_set%s(JNIEnv *env, jobject this, %s v) {\n", g.jniPkgName(), n, java.JNIMangle(f.Name()), g.jniType(f.Type()))
	g.Indent()
	g.Printf("int32_t o = go_seq_to_refnum_go(env, this);\n")
	g.genJavaToC("v", f.Type(), modeRetained)
	g.Printf("proxy%s_%s_%s_Set(o, _v);\n", g.pkgPrefix, o.Name(), f.Name())
	g.genRelease("v", f.Type(), modeRetained)
	g.Outdent()
	g.Printf("}\n\n")

	// getter
	g.Printf("JNIEXPORT %s JNICALL\n", g.jniType(f.Type()))
	g.Printf("Java_%s_%s_get%s(JNIEnv *env, jobject this) {\n", g.jniPkgName(), n, java.JNIMangle(f.Name()))
	g.Indent()
	g.Printf("int32_t o = go_seq_to_refnum_go(env, this);\n")
	g.Printf("%s r0 = ", g.cgoType(f.Type()))
	g.Printf("proxy%s_%s_%s_Get(o);\n", g.pkgPrefix, o.Name(), f.Name())
	g.genCToJava("_r0", "r0", f.Type(), modeRetained)
	g.Printf("return _r0;\n")
	g.Outdent()
	g.Printf("}\n\n")
}

func (g *JavaGen) genJNIVar(o *types.Var) {
	if t := o.Type(); !g.isSupported(t) {
		g.Printf("// skipped variable %s with unsupported type: %s\n\n", o.Name(), t)
		return
	}
	n := java.JNIMangle(g.javaTypeName(o.Name()))
	// setter
	g.Printf("JNIEXPORT void JNICALL\n")
	g.Printf("Java_%s_%s_set%s(JNIEnv *env, jclass clazz, %s v) {\n", g.jniPkgName(), java.JNIMangle(g.className()), n, g.jniType(o.Type()))
	g.Indent()
	g.genJavaToC("v", o.Type(), modeRetained)
	g.Printf("var_set%s_%s(_v);\n", g.pkgPrefix, o.Name())
	g.genRelease("v", o.Type(), modeRetained)
	g.Outdent()
	g.Printf("}\n\n")

	// getter
	g.Printf("JNIEXPORT %s JNICALL\n", g.jniType(o.Type()))
	g.Printf("Java_%s_%s_get%s(JNIEnv *env, jclass clazz) {\n", g.jniPkgName(), java.JNIMangle(g.className()), n)
	g.Indent()
	g.Printf("%s r0 = ", g.cgoType(o.Type()))
	g.Printf("var_get%s_%s();\n", g.pkgPrefix, o.Name())
	g.genCToJava("_r0", "r0", o.Type(), modeRetained)
	g.Printf("return _r0;\n")
	g.Outdent()
	g.Printf("}\n\n")
}

func (g *JavaGen) genJNIConstructor(f *types.Func, sName string) {
	if !g.isConsSigSupported(f.Type()) {
		return
	}
	sig := f.Type().(*types.Signature)
	res := sig.Results()

	g.Printf("JNIEXPORT jint JNICALL\n")
	g.Printf("Java_%s_%s_%s(JNIEnv *env, jclass clazz", g.jniPkgName(), java.JNIMangle(g.javaTypeName(sName)), java.JNIMangle("__"+f.Name()))
	params := sig.Params()
	for i := 0; i < params.Len(); i++ {
		v := params.At(i)
		jt := g.jniType(v.Type())
		g.Printf(", %s %s", jt, g.paramName(params, i))
	}
	g.Printf(") {\n")
	g.Indent()
	for i := 0; i < params.Len(); i++ {
		name := g.paramName(params, i)
		g.genJavaToC(name, params.At(i).Type(), modeTransient)
	}
	// Constructors always return a mandatory *T and an optional error
	if res.Len() == 1 {
		g.Printf("int32_t refnum = proxy%s__%s(", g.pkgPrefix, f.Name())
	} else {
		g.Printf("struct proxy%s__%s_return res = proxy%s__%s(", g.pkgPrefix, f.Name(), g.pkgPrefix, f.Name())
	}
	for i := 0; i < params.Len(); i++ {
		if i > 0 {
			g.Printf(", ")
		}
		g.Printf("_%s", g.paramName(params, i))
	}
	g.Printf(");\n")
	for i := 0; i < params.Len(); i++ {
		g.genRelease(g.paramName(params, i), params.At(i).Type(), modeTransient)
	}
	// Extract multi returns and handle errors
	if res.Len() == 2 {
		g.Printf("int32_t refnum = res.r0;\n")
		g.genCToJava("_err", "res.r1", res.At(1).Type(), modeRetained)
		g.Printf("go_seq_maybe_throw_exception(env, _err);\n")
	}
	g.Printf("return refnum;\n")
	g.Outdent()
	g.Printf("}\n\n")
}

func (g *JavaGen) genJNIFunc(o *types.Func, sName string, jm *java.Func, proxy, isjava bool) {
	if !g.isSigSupported(o.Type()) {
		n := o.Name()
		if sName != "" {
			n = sName + "." + n
		}
		g.Printf("// skipped function %s with unsupported parameter or return types\n\n", n)
		return
	}
	g.genJNIFuncSignature(o, sName, jm, proxy, isjava)

	g.Printf(" {\n")
	g.Indent()
	g.genJNIFuncBody(o, sName, jm, isjava)
	g.Outdent()
	g.Printf("}\n\n")
}

func (g *JavaGen) genJNIFuncBody(o *types.Func, sName string, jm *java.Func, isjava bool) {
	sig := o.Type().(*types.Signature)
	res := sig.Results()
	if sName != "" {
		g.Printf("int32_t o = go_seq_to_refnum_go(env, __this__);\n")
	}
	params := sig.Params()
	first := 0
	if isjava && params.Len() > 0 && params.At(0).Name() == "this" {
		// Start after the implicit this argument.
		first = 1
		g.Printf("int32_t _%s = go_seq_to_refnum(env, __this__);\n", g.paramName(params, 0))
	}
	for i := first; i < params.Len(); i++ {
		name := g.paramName(params, i)
		g.genJavaToC(name, params.At(i).Type(), modeTransient)
	}
	resPrefix := ""
	if res.Len() > 0 {
		if res.Len() == 1 {
			g.Printf("%s r0 = ", g.cgoType(res.At(0).Type()))
		} else {
			resPrefix = "res."
			g.Printf("struct proxy%s_%s_%s_return res = ", g.pkgPrefix, sName, o.Name())
		}
	}
	g.Printf("proxy%s_%s_%s(", g.pkgPrefix, sName, o.Name())
	if sName != "" {
		g.Printf("o")
	}
	// Pass all arguments, including the implicit this argument.
	for i := 0; i < params.Len(); i++ {
		if i > 0 || sName != "" {
			g.Printf(", ")
		}
		g.Printf("_%s", g.paramName(params, i))
	}
	g.Printf(");\n")
	for i := first; i < params.Len(); i++ {
		g.genRelease(g.paramName(params, i), params.At(i).Type(), modeTransient)
	}
	for i := 0; i < res.Len(); i++ {
		tn := fmt.Sprintf("_r%d", i)
		t := res.At(i).Type()
		g.genCToJava(tn, fmt.Sprintf("%sr%d", resPrefix, i), t, modeRetained)
	}
	// Go backwards so that any exception is thrown before
	// the return.
	for i := res.Len() - 1; i >= 0; i-- {
		t := res.At(i).Type()
		if !isErrorType(t) {
			g.Printf("return _r%d;\n", i)
		} else {
			g.Printf("go_seq_maybe_throw_exception(env, _r%d);\n", i)
		}
	}
}

// genRelease cleans up arguments that weren't copied in genJavaToC.
func (g *JavaGen) genRelease(varName string, t types.Type, mode varMode) {
	switch t := t.(type) {
	case *types.Basic:
	case *types.Slice:
		switch e := t.Elem().(type) {
		case *types.Basic:
			switch e.Kind() {
			case types.Uint8: // Byte.
				if mode == modeTransient {
					g.Printf("go_seq_release_byte_array(env, %s, _%s.ptr);\n", varName, varName)
				}
			}
		}
	}
}

func (g *JavaGen) genMethodInterfaceProxy(oName string, m *types.Func) {
	if !g.isSigSupported(m.Type()) {
		g.Printf("// skipped method %s with unsupported parameter or return types\n\n", oName)
		return
	}
	sig := m.Type().(*types.Signature)
	params := sig.Params()
	res := sig.Results()
	g.genInterfaceMethodSignature(m, oName, false, g.paramName)
	g.Indent()
	g.Printf("JNIEnv *env = go_seq_push_local_frame(%d);\n", params.Len())
	g.Printf("jobject o = go_seq_from_refnum(env, refnum, proxy_class_%s_%s, proxy_class_%s_%s_cons);\n", g.pkgPrefix, oName, g.pkgPrefix, oName)
	for i := 0; i < params.Len(); i++ {
		pn := g.paramName(params, i)
		g.genCToJava("_"+pn, pn, params.At(i).Type(), modeTransient)
	}
	if res.Len() > 0 && !isErrorType(res.At(0).Type()) {
		t := res.At(0).Type()
		g.Printf("%s res = (*env)->Call%sMethod(env, o, ", g.jniType(t), g.jniCallType(t))
	} else {
		g.Printf("(*env)->CallVoidMethod(env, o, ")
	}
	g.Printf("mid_%s_%s", oName, m.Name())
	for i := 0; i < params.Len(); i++ {
		g.Printf(", _%s", g.paramName(params, i))
	}
	g.Printf(");\n")
	var retName string
	if res.Len() > 0 {
		t := res.At(0).Type()
		if res.Len() == 2 || isErrorType(t) {
			g.Printf("jobject exc = go_seq_get_exception(env);\n")
			errType := types.Universe.Lookup("error").Type()
			g.genJavaToC("exc", errType, modeRetained)
			retName = "_exc"
		}
		if !isErrorType(t) {
			if res.Len() == 2 {
				g.genCRetClear("res", t, "exc")
			}
			g.genJavaToC("res", t, modeRetained)
			retName = "_res"
		}

		if res.Len() > 1 {
			g.Printf("cproxy%s_%s_%s_return sres = {\n", g.pkgPrefix, oName, m.Name())
			g.Printf("	_res, _exc\n")
			g.Printf("};\n")
			retName = "sres"
		}
	}
	g.Printf("go_seq_pop_local_frame(env);\n")
	if retName != "" {
		g.Printf("return %s;\n", retName)
	}
	g.Outdent()
	g.Printf("}\n\n")
}

func (g *JavaGen) GenH() error {
	pkgPath := ""
	if g.Pkg != nil {
		pkgPath = g.Pkg.Path()
	}
	g.Printf(hPreamble, g.gobindOpts(), pkgPath, g.className())
	for _, iface := range g.interfaces {
		g.Printf("extern jclass proxy_class_%s_%s;\n", g.pkgPrefix, iface.obj.Name())
		g.Printf("extern jmethodID proxy_class_%s_%s_cons;\n", g.pkgPrefix, iface.obj.Name())
		g.Printf("\n")
		for _, m := range iface.summary.callable {
			if !g.isSigSupported(m.Type()) {
				g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", iface.obj.Name(), m.Name())
				continue
			}
			g.genInterfaceMethodSignature(m, iface.obj.Name(), true, g.paramName)
			g.Printf("\n")
		}
	}
	for _, s := range g.structs {
		g.Printf("extern jclass proxy_class_%s_%s;\n", g.pkgPrefix, s.obj.Name())
		g.Printf("extern jmethodID proxy_class_%s_%s_cons;\n", g.pkgPrefix, s.obj.Name())
	}
	g.Printf("#endif\n")
	if len(g.err) > 0 {
		return g.err
	}
	return nil
}

func (g *JavaGen) jniCallType(t types.Type) string {
	switch t := t.(type) {
	case *types.Basic:
		switch t.Kind() {
		case types.Bool, types.UntypedBool:
			return "Boolean"
		case types.Int:
			return "Long"
		case types.Int8, types.Uint8: // types.Byte
			return "Byte"
		case types.Int16:
			return "Short"
		case types.Int32, types.UntypedRune: // types.Rune
			return "Int"
		case types.Int64, types.UntypedInt:
			return "Long"
		case types.Float32:
			return "Float"
		case types.Float64, types.UntypedFloat:
			return "Double"
		case types.String, types.UntypedString:
			return "Object"
		default:
			g.errorf("unsupported basic type: %s", t)
		}
	case *types.Slice:
		return "Object"
	case *types.Pointer:
		if _, ok := t.Elem().(*types.Named); ok {
			return g.jniCallType(t.Elem())
		}
		g.errorf("unsupported pointer to type: %s", t)
	case *types.Named:
		return "Object"
	default:
		return "Object"
	}
	return "TODO"
}

func (g *JavaGen) jniClassSigPrefix(pkg *types.Package) string {
	return strings.Replace(g.javaPkgName(pkg), ".", "/", -1) + "/"
}

func (g *JavaGen) jniSigType(T types.Type) string {
	if isErrorType(T) {
		return "Ljava/lang/Exception;"
	}
	switch T := T.(type) {
	case *types.Basic:
		switch T.Kind() {
		case types.Bool, types.UntypedBool:
			return "Z"
		case types.Int:
			return "J"
		case types.Int8:
			return "B"
		case types.Int16:
			return "S"
		case types.Int32, types.UntypedRune: // types.Rune
			return "I"
		case types.Int64, types.UntypedInt:
			return "J"
		case types.Uint8: // types.Byte
			return "B"
		case types.Float32:
			return "F"
		case types.Float64, types.UntypedFloat:
			return "D"
		case types.String, types.UntypedString:
			return "Ljava/lang/String;"
		default:
			g.errorf("unsupported basic type: %s", T)
			return "TODO"
		}
	case *types.Slice:
		return "[" + g.jniSigType(T.Elem())
	case *types.Pointer:
		if _, ok := T.Elem().(*types.Named); ok {
			return g.jniSigType(T.Elem())
		}
		g.errorf("unsupported pointer to type: %s", T)
	case *types.Named:
		return "L" + g.jniClassSigPrefix(T.Obj().Pkg()) + g.javaTypeName(T.Obj().Name()) + ";"
	default:
		g.errorf("unsupported jniType: %#+v, %s\n", T, T)
	}
	return "TODO"
}

func (g *JavaGen) GenC() error {
	var pkgName, pkgPath string
	if g.Pkg != nil {
		pkgName = g.Pkg.Name()
		pkgPath = g.Pkg.Path()
	} else {
		pkgName = "universe"
	}
	g.Printf(cPreamble, g.gobindOpts(), pkgPath)
	g.Printf("#include %q\n", pkgName+".h")
	if g.Pkg != nil {
		for _, pkg := range g.Pkg.Imports() {
			if g.validPkg(pkg) {
				g.Printf("#include \"%s.h\"\n", pkg.Name())
			}
		}
	}
	g.Printf("\n")

	for _, iface := range g.interfaces {
		g.Printf("jclass proxy_class_%s_%s;\n", g.pkgPrefix, iface.obj.Name())
		g.Printf("jmethodID proxy_class_%s_%s_cons;\n", g.pkgPrefix, iface.obj.Name())
		for _, m := range iface.summary.callable {
			if !g.isSigSupported(m.Type()) {
				g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", iface.obj.Name(), m.Name())
				continue
			}
			g.Printf("static jmethodID mid_%s_%s;\n", iface.obj.Name(), m.Name())
		}
	}
	for _, s := range g.structs {
		g.Printf("jclass proxy_class_%s_%s;\n", g.pkgPrefix, s.obj.Name())
		g.Printf("jmethodID proxy_class_%s_%s_cons;\n", g.pkgPrefix, s.obj.Name())
	}
	g.Printf("\n")
	g.Printf("JNIEXPORT void JNICALL\n")
	g.Printf("Java_%s_%s__1init(JNIEnv *env, jclass _unused) {\n", g.jniPkgName(), java.JNIMangle(g.className()))
	g.Indent()
	g.Printf("jclass clazz;\n")
	for _, s := range g.structs {
		if jinf, ok := g.jstructs[s.obj]; ok {
			// Leave the class and constructor NULL for Java classes with no
			// default constructor.
			if !jinf.genNoargCon {
				continue
			}
		}
		g.Printf("clazz = (*env)->FindClass(env, %q);\n", g.jniClassSigPrefix(s.obj.Pkg())+g.javaTypeName(s.obj.Name()))
		g.Printf("proxy_class_%s_%s = (*env)->NewGlobalRef(env, clazz);\n", g.pkgPrefix, s.obj.Name())
		g.Printf("proxy_class_%s_%s_cons = (*env)->GetMethodID(env, clazz, \"<init>\", \"(I)V\");\n", g.pkgPrefix, s.obj.Name())
	}
	for _, iface := range g.interfaces {
		pkg := iface.obj.Pkg()
		g.Printf("clazz = (*env)->FindClass(env, %q);\n", g.jniClassSigPrefix(pkg)+JavaClassName(pkg)+"$proxy"+iface.obj.Name())
		g.Printf("proxy_class_%s_%s = (*env)->NewGlobalRef(env, clazz);\n", g.pkgPrefix, iface.obj.Name())
		g.Printf("proxy_class_%s_%s_cons = (*env)->GetMethodID(env, clazz, \"<init>\", \"(I)V\");\n", g.pkgPrefix, iface.obj.Name())
		if isErrorType(iface.obj.Type()) {
			// As a special case, Java Exceptions are passed to Go pretending to implement the Go error interface.
			// To complete the illusion, use the Throwable.getMessage method for proxied calls to the error.Error method.
			g.Printf("clazz = (*env)->FindClass(env, \"java/lang/Throwable\");\n")
			g.Printf("mid_error_Error = (*env)->GetMethodID(env, clazz, \"getMessage\", \"()Ljava/lang/String;\");\n")
			continue
		}
		g.Printf("clazz = (*env)->FindClass(env, %q);\n", g.jniClassSigPrefix(pkg)+g.javaTypeName(iface.obj.Name()))
		for _, m := range iface.summary.callable {
			if !g.isSigSupported(m.Type()) {
				g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", iface.obj.Name(), m.Name())
				continue
			}
			sig := m.Type().(*types.Signature)
			res := sig.Results()
			retSig := "V"
			if res.Len() > 0 {
				if t := res.At(0).Type(); !isErrorType(t) {
					retSig = g.jniSigType(t)
				}
			}
			var jniParams string
			params := sig.Params()
			for i := 0; i < params.Len(); i++ {
				jniParams += g.jniSigType(params.At(i).Type())
			}
			g.Printf("mid_%s_%s = (*env)->GetMethodID(env, clazz, %q, \"(%s)%s\");\n",
				iface.obj.Name(), m.Name(), javaNameReplacer(lowerFirst(m.Name())), jniParams, retSig)
		}
		g.Printf("\n")
	}
	g.Outdent()
	g.Printf("}\n\n")
	for _, f := range g.funcs {
		g.genJNIFunc(f, "", nil, false, false)
	}
	for _, s := range g.structs {
		sName := s.obj.Name()
		cons := g.constructors[s.obj]
		jinf := g.jstructs[s.obj]
		for _, f := range cons {
			g.genJNIConstructor(f, sName)
		}
		if len(cons) == 0 && (jinf == nil || jinf.genNoargCon) {
			g.Printf("JNIEXPORT jint JNICALL\n")
			g.Printf("Java_%s_%s_%s(JNIEnv *env, jclass clazz) {\n", g.jniPkgName(), java.JNIMangle(g.javaTypeName(sName)), java.JNIMangle("__New"))
			g.Indent()
			g.Printf("return new_%s_%s();\n", g.pkgPrefix, sName)
			g.Outdent()
			g.Printf("}\n\n")
		}

		for _, m := range exportedMethodSet(types.NewPointer(s.obj.Type())) {
			var jm *java.Func
			if jinf != nil {
				jm = jinf.lookupMethod(m, g.hasThis(s.obj.Name(), m))
			}
			g.genJNIFunc(m, sName, jm, false, jinf != nil)
		}
		for _, f := range exportedFields(s.t) {
			g.genJNIField(s.obj, f)
		}
	}
	for _, iface := range g.interfaces {
		for _, m := range iface.summary.callable {
			g.genJNIFunc(m, iface.obj.Name(), nil, true, false)
			g.genMethodInterfaceProxy(iface.obj.Name(), m)
		}
	}
	for _, v := range g.vars {
		g.genJNIVar(v)
	}
	if len(g.err) > 0 {
		return g.err
	}
	return nil
}

func (g *JavaGen) GenJava() error {
	pkgPath := ""
	if g.Pkg != nil {
		pkgPath = g.Pkg.Path()
	}
	g.Printf(javaPreamble, g.javaPkgName(g.Pkg), g.className(), g.gobindOpts(), pkgPath)

	g.Printf("public abstract class %s {\n", g.className())
	g.Indent()
	g.Printf("static {\n")
	g.Indent()
	g.Printf("Seq.touch(); // for loading the native library\n")
	if g.Pkg != nil {
		for _, p := range g.Pkg.Imports() {
			if g.validPkg(p) {
				g.Printf("%s.%s.touch();\n", g.javaPkgName(p), JavaClassName(p))
			}
		}
	}
	g.Printf("_init();\n")
	g.Outdent()
	g.Printf("}\n\n")
	g.Printf("private %s() {} // uninstantiable\n\n", g.className())
	g.Printf("// touch is called from other bound packages to initialize this package\n")
	g.Printf("public static void touch() {}\n\n")
	g.Printf("private static native void _init();\n\n")

	for _, iface := range g.interfaces {
		n := iface.obj.Name()
		g.Printf("private static final class proxy%s", n)
		if isErrorType(iface.obj.Type()) {
			g.Printf(" extends Exception")
		}
		g.Printf(" implements Seq.Proxy, %s {\n", g.javaTypeName(n))
		g.Indent()
		g.genProxyImpl("proxy" + n)
		g.Printf("proxy%s(int refnum) { this.refnum = refnum; Seq.trackGoRef(refnum, this); }\n\n", n)

		if isErrorType(iface.obj.Type()) {
			g.Printf("@Override public String getMessage() { return error(); }\n\n")
		}
		for _, m := range iface.summary.callable {
			if !g.isSigSupported(m.Type()) {
				g.Printf("// skipped method %s.%s with unsupported parameter or return types\n\n", n, m.Name())
				continue
			}
			g.Printf("public native ")
			g.genFuncSignature(m, nil, false)
		}

		g.Outdent()
		g.Printf("}\n")
	}

	g.Printf("\n")

	for _, c := range g.constants {
		g.genConst(c)
	}
	g.Printf("\n")
	for _, v := range g.vars {
		g.genVar(v)
	}
	for _, f := range g.funcs {
		if !g.isSigSupported(f.Type()) {
			g.Printf("// skipped function %s with unsupported parameter or return types\n\n", f.Name())
			continue
		}
		g.javadoc(g.docs[f.Name()].Doc())
		g.Printf("public static native ")
		g.genFuncSignature(f, nil, false)
	}

	g.Outdent()
	g.Printf("}\n")

	if len(g.err) > 0 {
		return g.err
	}
	return nil
}

// embeddedJavaClasses returns the possible empty list of Java types embedded
// in the given struct type.
func embeddedJavaClasses(t *types.Struct) []string {
	clsSet := make(map[string]struct{})
	var classes []string
	for i := 0; i < t.NumFields(); i++ {
		f := t.Field(i)
		if !f.Exported() {
			continue
		}
		if t := f.Type(); isJavaType(t) {
			cls := classNameFor(t)
			if _, exists := clsSet[cls]; !exists {
				clsSet[cls] = struct{}{}
				classes = append(classes, cls)
			}
		}
	}
	return classes
}

func classNameFor(t types.Type) string {
	obj := t.(*types.Named).Obj()
	pkg := obj.Pkg()
	return strings.Replace(pkg.Path()[len("Java/"):], "/", ".", -1) + "." + obj.Name()
}

func isJavaType(t types.Type) bool {
	return typePkgFirstElem(t) == "Java"
}

const (
	javaPreamble = `// Java class %[1]s.%[2]s is a proxy for talking to a Go program.
//   gobind %[3]s %[4]s
//
// File is generated by gobind. Do not edit.
package %[1]s;

import go.Seq;

`
	cPreamble = `// JNI functions for the Go <=> Java bridge.
//   gobind %[1]s %[2]s
//
// File is generated by gobind. Do not edit.

#include <android/log.h>
#include <stdint.h>
#include "seq.h"
#include "_cgo_export.h"
`

	hPreamble = `// JNI function headers for the Go <=> Java bridge.
//   gobind %[1]s %[2]s
//
// File is generated by gobind. Do not edit.

#ifndef __%[3]s_H__
#define __%[3]s_H__

#include <jni.h>

`
)
