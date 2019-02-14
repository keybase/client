// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// The java package takes the result of an AST traversal by the
// importers package and queries the java command for the type
// information for the referenced Java classes and interfaces.
//
// It is the of go/types for Java types and is used by the bind
// package to generate Go wrappers for Java API on Android.
package java

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"os/exec"
	"reflect"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/mobile/internal/importers"
)

// Class is the bind representation of a Java class or
// interface.
// Use Import to convert class references to Class.
type Class struct {
	// "java.pkg.Class.Inner"
	Name string
	// "java.pkg.Class$Inner"
	FindName string
	// JNI mangled name
	JNIName string
	// "Inner"
	PkgName string
	Funcs   []*FuncSet
	Methods []*FuncSet
	// funcMap maps function names.
	funcMap map[string]*FuncSet
	// FuncMap maps method names.
	methodMap map[string]*FuncSet
	// All methods, including methods from
	// supers.
	AllMethods []*FuncSet
	Vars       []*Var
	Supers     []string
	Final      bool
	Abstract   bool
	Interface  bool
	Throwable  bool
	// Whether the class has a no-arg constructor
	HasNoArgCon bool
}

// FuncSet is the set of overloaded variants of a function.
// If the function is not overloaded, its FuncSet contains
// one entry.
type FuncSet struct {
	Name   string
	GoName string
	Funcs  []*Func
	CommonSig
}

// CommonSig is a signature compatible with every
// overloaded variant of a FuncSet.
type CommonSig struct {
	// Variadic is set if the signature covers variants
	// with varying number of parameters.
	Variadic bool
	// HasRet is true if at least one variant returns a
	// value.
	HasRet bool
	Throws bool
	Params []*Type
	Ret    *Type
}

// Func is a Java static function or method or constructor.
type Func struct {
	FuncSig
	ArgDesc string
	// Mangled JNI name
	JNIName     string
	Static      bool
	Abstract    bool
	Final       bool
	Public      bool
	Constructor bool
	Params      []*Type
	Ret         *Type
	Decl        string
	Throws      string
}

// FuncSig uniquely identifies a Java Func.
type FuncSig struct {
	Name string
	// The method descriptor, in JNI format.
	Desc string
}

// Var is a Java member variable.
type Var struct {
	Name   string
	Static bool
	Final  bool
	Val    string
	Type   *Type
}

// Type is a Java type.
type Type struct {
	Kind  TypeKind
	Class string
	Elem  *Type
}

type TypeKind int

type Importer struct {
	Bootclasspath string
	Classpath     string
	// JavaPkg is java package name for generated classes.
	JavaPkg string

	clsMap map[string]*Class
}

// funcRef is a reference to a Java function (static method).
// It is used as a key to filter unused Java functions.
type funcRef struct {
	clsName string
	goName  string
}

type errClsNotFound struct {
	name string
}

const (
	Int TypeKind = iota
	Boolean
	Short
	Char
	Byte
	Long
	Float
	Double
	String
	Array
	Object
)

func (e *errClsNotFound) Error() string {
	return "class not found: " + e.name
}

// IsAvailable reports whether the required tools are available for
// Import to work. In particular, IsAvailable checks the existence
// of the javap binary.
func IsAvailable() bool {
	_, err := javapPath()
	return err == nil
}

func javapPath() (string, error) {
	return exec.LookPath("javap")
}

// Import returns Java Class descriptors for a list of references.
//
// The javap command from the Java SDK is used to dump
// class information. Its output looks like this:
//
// Compiled from "System.java"
// public final class java.lang.System {
//   public static final java.io.InputStream in;
//     descriptor: Ljava/io/InputStream;
//   public static final java.io.PrintStream out;
//     descriptor: Ljava/io/PrintStream;
//   public static final java.io.PrintStream err;
//     descriptor: Ljava/io/PrintStream;
//   public static void setIn(java.io.InputStream);
//     descriptor: (Ljava/io/InputStream;)V
//
//   ...
//
// }
func (j *Importer) Import(refs *importers.References) ([]*Class, error) {
	if j.clsMap == nil {
		j.clsMap = make(map[string]*Class)
	}
	clsSet := make(map[string]struct{})
	var names []string
	for _, ref := range refs.Refs {
		// The reference could be to some/pkg.Class or some/pkg/Class.Identifier. Include both.
		pkg := strings.Replace(ref.Pkg, "/", ".", -1)
		for _, cls := range []string{pkg, pkg + "." + ref.Name} {
			if _, exists := clsSet[cls]; !exists {
				clsSet[cls] = struct{}{}
				names = append(names, cls)
			}
		}
	}
	// Make sure toString() is included; it is called when wrapping Java exception types to Go
	// errors.
	refs.Names["ToString"] = struct{}{}
	funcRefs := make(map[funcRef]struct{})
	for _, ref := range refs.Refs {
		pkgName := strings.Replace(ref.Pkg, "/", ".", -1)
		funcRefs[funcRef{pkgName, ref.Name}] = struct{}{}
	}
	classes, err := j.importClasses(names, true)
	if err != nil {
		return nil, err
	}
	j.filterReferences(classes, refs, funcRefs)
	supers, err := j.importReferencedClasses(classes)
	if err != nil {
		return nil, err
	}
	j.filterReferences(supers, refs, funcRefs)
	// Embedders refer to every exported Go struct that will have its class
	// generated. Allow Go code to reverse bind to those classes by synthesizing
	// their class descriptors.
	for _, emb := range refs.Embedders {
		n := emb.Pkg + "." + emb.Name
		if j.JavaPkg != "" {
			n = j.JavaPkg + "." + n
		}
		if _, exists := j.clsMap[n]; exists {
			continue
		}
		clsSet[n] = struct{}{}
		cls := &Class{
			Name:        n,
			FindName:    n,
			JNIName:     JNIMangle(n),
			PkgName:     emb.Name,
			HasNoArgCon: true,
		}
		for _, ref := range emb.Refs {
			jpkg := strings.Replace(ref.Pkg, "/", ".", -1)
			super := jpkg + "." + ref.Name
			if _, exists := j.clsMap[super]; !exists {
				return nil, fmt.Errorf("failed to find Java class %s, embedded by %s", super, n)
			}
			cls.Supers = append(cls.Supers, super)
		}
		classes = append(classes, cls)
		j.clsMap[cls.Name] = cls
	}
	// Include implicit classes that are used in parameter or return values.
	for _, cls := range classes {
		for _, fsets := range [][]*FuncSet{cls.Funcs, cls.Methods} {
			for _, fs := range fsets {
				for _, f := range fs.Funcs {
					names := j.implicitFuncTypes(f)
					for _, name := range names {
						if _, exists := clsSet[name]; exists {
							continue
						}
						clsSet[name] = struct{}{}
						classes = append(classes, j.clsMap[name])
					}
				}
			}
		}
	}
	for _, cls := range j.clsMap {
		j.fillFuncSigs(cls.Funcs)
		j.fillFuncSigs(cls.Methods)
		for _, m := range cls.Methods {
			j.fillSuperSigs(cls, m)
		}
	}
	for _, cls := range j.clsMap {
		j.fillAllMethods(cls)
	}
	// Include classes that appear as ancestor types for overloaded signatures.
	for _, cls := range classes {
		for _, funcs := range [][]*FuncSet{cls.Funcs, cls.AllMethods} {
			for _, f := range funcs {
				for _, p := range f.Params {
					if p == nil || p.Kind != Object {
						continue
					}
					if _, exists := clsSet[p.Class]; !exists {
						clsSet[p.Class] = struct{}{}
						classes = append(classes, j.clsMap[p.Class])
					}
				}
				if t := f.Ret; t != nil && t.Kind == Object {
					if _, exists := clsSet[t.Class]; !exists {
						clsSet[t.Class] = struct{}{}
						classes = append(classes, j.clsMap[t.Class])
					}
				}
			}
		}
	}
	for _, cls := range classes {
		j.fillJNINames(cls.Funcs)
		j.fillJNINames(cls.AllMethods)
	}
	j.fillThrowables(classes)
	return classes, nil
}

func (j *Importer) fillJNINames(funcs []*FuncSet) {
	for _, fs := range funcs {
		for _, f := range fs.Funcs {
			f.JNIName = JNIMangle(f.Name)
			if len(fs.Funcs) > 1 {
				f.JNIName += "__" + JNIMangle(f.ArgDesc)
			}
		}
	}
}

// commonType finds the most specific type common to t1 and t2.
// If t1 and t2 are both Java classes, the most specific ancestor
// class is returned.
// Else if the types are equal, their type is returned.
// Finally, nil is returned, indicating no common type.
func commonType(clsMap map[string]*Class, t1, t2 *Type) *Type {
	if t1 == nil || t2 == nil {
		return nil
	}
	if reflect.DeepEqual(t1, t2) {
		return t1
	}
	if t1.Kind != Object || t2.Kind != Object {
		// The types are fundamentally incompatible
		return nil
	}
	superSet := make(map[string]struct{})
	supers := []string{t1.Class}
	for len(supers) > 0 {
		var newSupers []string
		for _, s := range supers {
			cls := clsMap[s]
			superSet[s] = struct{}{}
			newSupers = append(newSupers, cls.Supers...)
		}
		supers = newSupers
	}
	supers = []string{t2.Class}
	for len(supers) > 0 {
		var newSupers []string
		for _, s := range supers {
			if _, exists := superSet[s]; exists {
				return &Type{Kind: Object, Class: s}
			}
			cls := clsMap[s]
			newSupers = append(newSupers, cls.Supers...)
		}
		supers = newSupers
	}
	return &Type{Kind: Object, Class: "java.lang.Object"}
}

// combineSigs finds the most specific function signature
// that covers all its overload variants.
// If a function has only one variant, its common signature
// is the signature of that variant.
func combineSigs(clsMap map[string]*Class, sigs ...CommonSig) CommonSig {
	var common CommonSig
	minp := len(sigs[0].Params)
	for i := 1; i < len(sigs); i++ {
		sig := sigs[i]
		n := len(sig.Params)
		common.Variadic = common.Variadic || sig.Variadic || n != minp
		if n < minp {
			minp = n
		}
	}
	for i, sig := range sigs {
		for j, p := range sig.Params {
			idx := j
			// If the common signature is variadic, combine all parameters in the
			// last parameter type of the shortest parameter list.
			if idx > minp {
				idx = minp
			}
			if idx < len(common.Params) {
				common.Params[idx] = commonType(clsMap, common.Params[idx], p)
			} else {
				common.Params = append(common.Params, p)
			}
		}
		common.Throws = common.Throws || sig.Throws
		common.HasRet = common.HasRet || sig.HasRet
		if i > 0 {
			common.Ret = commonType(clsMap, common.Ret, sig.Ret)
		} else {
			common.Ret = sig.Ret
		}
	}
	return common
}

// fillSuperSigs combines methods signatures with super class signatures,
// to preserve the assignability of classes to their super classes.
//
// For example, the class
//
// class A {
//   void f();
// }
//
// is by itself represented by the Go interface
//
// type A interface {
//   f()
// }
//
// However, if class
//
// class B extends A {
//   void f(int);
// }
//
// is also imported, it will be represented as
//
// type B interface {
//   f(...int32)
// }
//
// To make Go B assignable to Go A, the signature of A's f must
// be updated to f(...int32) as well.
func (j *Importer) fillSuperSigs(cls *Class, m *FuncSet) {
	for _, s := range cls.Supers {
		sup := j.clsMap[s]
		if sm, exists := sup.methodMap[m.GoName]; exists {
			sm.CommonSig = combineSigs(j.clsMap, sm.CommonSig, m.CommonSig)
		}
		j.fillSuperSigs(sup, m)
	}
}

func (v *Var) Constant() bool {
	return v.Static && v.Final && v.Val != ""
}

// Mangle a name according to
// http://docs.oracle.com/javase/6/docs/technotes/guides/jni/spec/design.html#wp16696
//
// TODO: Support unicode characters
func JNIMangle(s string) string {
	var m []byte
	for i := 0; i < len(s); i++ {
		switch c := s[i]; c {
		case '.', '/':
			m = append(m, '_')
		case '$':
			m = append(m, "_00024"...)
		case '_':
			m = append(m, "_1"...)
		case ';':
			m = append(m, "_2"...)
		case '[':
			m = append(m, "_3"...)
		default:
			m = append(m, c)
		}
	}
	return string(m)
}

func (t *Type) Type() string {
	switch t.Kind {
	case Int:
		return "int"
	case Boolean:
		return "boolean"
	case Short:
		return "short"
	case Char:
		return "char"
	case Byte:
		return "byte"
	case Long:
		return "long"
	case Float:
		return "float"
	case Double:
		return "double"
	case String:
		return "String"
	case Array:
		return t.Elem.Type() + "[]"
	case Object:
		return t.Class
	default:
		panic("invalid kind")
	}
}

func (t *Type) JNIType() string {
	switch t.Kind {
	case Int:
		return "jint"
	case Boolean:
		return "jboolean"
	case Short:
		return "jshort"
	case Char:
		return "jchar"
	case Byte:
		return "jbyte"
	case Long:
		return "jlong"
	case Float:
		return "jfloat"
	case Double:
		return "jdouble"
	case String:
		return "jstring"
	case Array:
		return "jarray"
	case Object:
		return "jobject"
	default:
		panic("invalid kind")
	}
}

func (t *Type) CType() string {
	switch t.Kind {
	case Int, Boolean, Short, Char, Byte, Long, Float, Double:
		return t.JNIType()
	case String:
		return "nstring"
	case Array:
		if t.Elem.Kind != Byte {
			panic("unsupported array type")
		}
		return "nbyteslice"
	case Object:
		return "jint"
	default:
		panic("invalid kind")
	}
}

func (t *Type) JNICallType() string {
	switch t.Kind {
	case Int:
		return "Int"
	case Boolean:
		return "Boolean"
	case Short:
		return "Short"
	case Char:
		return "Char"
	case Byte:
		return "Byte"
	case Long:
		return "Long"
	case Float:
		return "Float"
	case Double:
		return "Double"
	case String, Object, Array:
		return "Object"
	default:
		panic("invalid kind")
	}
}

func (j *Importer) filterReferences(classes []*Class, refs *importers.References, funcRefs map[funcRef]struct{}) {
	for _, cls := range classes {
		var filtered []*FuncSet
		for _, f := range cls.Funcs {
			if _, exists := funcRefs[funcRef{cls.Name, f.GoName}]; exists {
				filtered = append(filtered, f)
			}
		}
		cls.Funcs = filtered
		filtered = nil
		for _, m := range cls.Methods {
			if _, exists := refs.Names[m.GoName]; exists {
				filtered = append(filtered, m)
			}
		}
		cls.Methods = filtered
	}
}

// importClasses imports the named classes from the classpaths of the Importer.
func (j *Importer) importClasses(names []string, allowMissingClasses bool) ([]*Class, error) {
	if len(names) == 0 {
		return nil, nil
	}
	args := []string{"-J-Duser.language=en", "-s", "-protected", "-constants"}
	args = append(args, "-classpath", j.Classpath)
	if j.Bootclasspath != "" {
		args = append(args, "-bootclasspath", j.Bootclasspath)
	}
	args = append(args, names...)
	javapPath, err := javapPath()
	if err != nil {
		return nil, err
	}
	javap := exec.Command(javapPath, args...)
	out, err := javap.CombinedOutput()
	if err != nil {
		if _, ok := err.(*exec.ExitError); !ok {
			return nil, fmt.Errorf("javap failed: %v", err)
		}
		// Not every name is a Java class so an exit error from javap is not
		// fatal.
	}
	s := bufio.NewScanner(bytes.NewBuffer(out))
	var classes []*Class
	for _, name := range names {
		cls, err := j.scanClass(s, name)
		if err != nil {
			_, notfound := err.(*errClsNotFound)
			if notfound && allowMissingClasses {
				continue
			}
			if notfound && name != "android.databinding.DataBindingComponent" {
				return nil, err
			}
			// The Android Databinding library generates android.databinding.DataBindingComponent
			// too late in the build process for the gobind plugin to import it. Synthesize a class
			// for it instead.
			cls = &Class{
				Name:      name,
				FindName:  name,
				Interface: true,
				PkgName:   "databinding",
				JNIName:   JNIMangle(name),
			}
		}
		classes = append(classes, cls)
		j.clsMap[name] = cls
	}
	return classes, nil
}

// importReferencedClasses imports all implicit classes (super types, parameter and
// return types) for the given classes not already imported.
func (j *Importer) importReferencedClasses(classes []*Class) ([]*Class, error) {
	var allCls []*Class
	// Include methods from extended or implemented classes.
	for {
		set := make(map[string]struct{})
		for _, cls := range classes {
			j.unknownImplicitClasses(cls, set)
		}
		if len(set) == 0 {
			break
		}
		var names []string
		for n := range set {
			names = append(names, n)
		}
		newCls, err := j.importClasses(names, false)
		if err != nil {
			return nil, err
		}
		allCls = append(allCls, newCls...)
		classes = newCls
	}
	return allCls, nil
}

func (j *Importer) implicitFuncTypes(f *Func) []string {
	var unk []string
	if rt := f.Ret; rt != nil && rt.Kind == Object {
		unk = append(unk, rt.Class)
	}
	for _, t := range f.Params {
		if t.Kind == Object {
			unk = append(unk, t.Class)
		}
	}
	return unk
}

func (j *Importer) unknownImplicitClasses(cls *Class, set map[string]struct{}) {
	for _, fsets := range [][]*FuncSet{cls.Funcs, cls.Methods} {
		for _, fs := range fsets {
			for _, f := range fs.Funcs {
				names := j.implicitFuncTypes(f)
				for _, name := range names {
					if _, exists := j.clsMap[name]; !exists {
						set[name] = struct{}{}
					}
				}
			}
		}
	}
	for _, n := range cls.Supers {
		if s, exists := j.clsMap[n]; exists {
			j.unknownImplicitClasses(s, set)
		} else {
			set[n] = struct{}{}
		}
	}
}

func (j *Importer) implicitFuncClasses(funcs []*FuncSet, impl []string) []string {
	var l []string
	for _, fs := range funcs {
		for _, f := range fs.Funcs {
			if rt := f.Ret; rt != nil && rt.Kind == Object {
				l = append(l, rt.Class)
			}
			for _, t := range f.Params {
				if t.Kind == Object {
					l = append(l, t.Class)
				}
			}
		}
	}
	return impl
}

func (j *Importer) scanClass(s *bufio.Scanner, name string) (*Class, error) {
	if !s.Scan() {
		return nil, fmt.Errorf("%s: missing javap header", name)
	}
	head := s.Text()
	if errPref := "Error: "; strings.HasPrefix(head, errPref) {
		msg := head[len(errPref):]
		if strings.HasPrefix(msg, "class not found: "+name) {
			return nil, &errClsNotFound{name}
		}
		return nil, errors.New(msg)
	}
	if !strings.HasPrefix(head, "Compiled from ") {
		return nil, fmt.Errorf("%s: unexpected header: %s", name, head)
	}
	if !s.Scan() {
		return nil, fmt.Errorf("%s: missing javap class declaration", name)
	}
	clsDecl := s.Text()
	cls, err := j.scanClassDecl(name, clsDecl)
	if err != nil {
		return nil, err
	}
	cls.JNIName = JNIMangle(cls.Name)
	clsElems := strings.Split(cls.Name, ".")
	cls.PkgName = clsElems[len(clsElems)-1]
	var funcs []*Func
	for s.Scan() {
		decl := strings.TrimSpace(s.Text())
		if decl == "}" {
			break
		} else if decl == "" {
			continue
		}
		if !s.Scan() {
			return nil, fmt.Errorf("%s: missing descriptor for member %q", name, decl)
		}
		desc := strings.TrimSpace(s.Text())
		desc = strings.TrimPrefix(desc, "descriptor: ")
		var static, final, abstract, public bool
		// Trim modifiders from the declaration.
	loop:
		for {
			idx := strings.Index(decl, " ")
			if idx == -1 {
				break
			}
			keyword := decl[:idx]
			switch keyword {
			case "public":
				public = true
			case "protected", "native":
				// ignore
			case "static":
				static = true
			case "final":
				final = true
			case "abstract":
				abstract = true
			default:
				// Hopefully we reached the declaration now.
				break loop
			}
			decl = decl[idx+1:]
		}
		// Trim ending ;
		decl = decl[:len(decl)-1]
		if idx := strings.Index(decl, "("); idx != -1 {
			f, err := j.scanMethod(decl, desc, idx)
			if err != nil {
				return nil, fmt.Errorf("%s: %v", name, err)
			}
			if f != nil {
				f.Static = static
				f.Abstract = abstract
				f.Public = public || cls.Interface
				f.Final = final
				f.Constructor = f.Name == cls.FindName
				if f.Constructor {
					cls.HasNoArgCon = cls.HasNoArgCon || len(f.Params) == 0
					f.Public = f.Public && !cls.Abstract
					f.Name = "new"
					f.Ret = &Type{Class: name, Kind: Object}
				}
				funcs = append(funcs, f)
			}
		} else {
			// Member is a variable
			v, err := j.scanVar(decl, desc)
			if err != nil {
				return nil, fmt.Errorf("%s: %v", name, err)
			}
			if v != nil && public {
				v.Static = static
				v.Final = final
				cls.Vars = append(cls.Vars, v)
			}
		}
	}
	for _, f := range funcs {
		var m map[string]*FuncSet
		var l *[]*FuncSet
		goName := initialUpper(f.Name)
		if f.Static || f.Constructor {
			m = cls.funcMap
			l = &cls.Funcs
		} else {
			m = cls.methodMap
			l = &cls.Methods
		}
		fs, exists := m[goName]
		if !exists {
			fs = &FuncSet{
				Name:   f.Name,
				GoName: goName,
			}
			m[goName] = fs
			*l = append(*l, fs)
		}
		fs.Funcs = append(fs.Funcs, f)
	}
	return cls, nil
}

func (j *Importer) scanClassDecl(name string, decl string) (*Class, error) {
	isRoot := name == "java.lang.Object"
	cls := &Class{
		Name:        name,
		funcMap:     make(map[string]*FuncSet),
		methodMap:   make(map[string]*FuncSet),
		HasNoArgCon: isRoot,
	}
	const (
		stMod = iota
		stName
		stExt
		stImpl
	)
	superClsDecl := isRoot
	st := stMod
	var w []byte
	// if > 0, we're inside a generics declaration
	gennest := 0
	for i := 0; i < len(decl); i++ {
		c := decl[i]
		switch c {
		default:
			if gennest == 0 {
				w = append(w, c)
			}
		case '>':
			gennest--
		case '<':
			gennest++
		case '{':
			if !superClsDecl && !cls.Interface {
				cls.Supers = append(cls.Supers, "java.lang.Object")
			}
			return cls, nil
		case ' ', ',':
			if gennest > 0 {
				break
			}
			switch w := string(w); w {
			default:
				switch st {
				case stName:
					if strings.Replace(w, "$", ".", -1) != strings.Replace(name, "$", ".", -1) {
						return nil, fmt.Errorf("unexpected name %q in class declaration: %q", w, decl)
					}
					cls.FindName = w
				case stExt:
					superClsDecl = true
					cls.Supers = append(cls.Supers, w)
				case stImpl:
					if !cls.Interface {
						cls.Supers = append(cls.Supers, w)
					}
				default:
					return nil, fmt.Errorf("unexpected %q in class declaration: %q", w, decl)
				}
			case "":
				// skip
			case "public":
				if st != stMod {
					return nil, fmt.Errorf("unexpected %q in class declaration: %q", w, decl)
				}
			case "abstract":
				if st != stMod {
					return nil, fmt.Errorf("unexpected %q in class declaration: %q", w, decl)
				}
				cls.Abstract = true
			case "final":
				if st != stMod {
					return nil, fmt.Errorf("unexpected %q in class declaration: %q", w, decl)
				}
				cls.Final = true
			case "interface":
				cls.Interface = true
				fallthrough
			case "class":
				if st != stMod {
					return nil, fmt.Errorf("unexpected %q in class declaration: %q", w, decl)
				}
				st = stName
			case "extends":
				if st != stName {
					return nil, fmt.Errorf("unexpected %q in class declaration: %q", w, decl)
				}
				st = stExt
			case "implements":
				if st != stName && st != stExt {
					return nil, fmt.Errorf("unexpected %q in class declaration: %q", w, decl)
				}
				st = stImpl
			}
			w = w[:0]
		}
	}
	return nil, fmt.Errorf("missing ending { in class declaration: %q", decl)
}

func (j *Importer) scanVar(decl, desc string) (*Var, error) {
	v := new(Var)
	const eq = " = "
	idx := strings.Index(decl, eq)
	if idx != -1 {
		val, ok := j.parseJavaValue(decl[idx+len(eq):])
		if !ok {
			// Skip constants that cannot be represented in Go
			return nil, nil
		}
		v.Val = val
	} else {
		idx = len(decl)
	}
	for i := idx - 1; i >= 0; i-- {
		if i == 0 || decl[i-1] == ' ' {
			v.Name = decl[i:idx]
			break
		}
	}
	if v.Name == "" {
		return nil, fmt.Errorf("unable to parse member name from declaration: %q", decl)
	}
	typ, _, err := j.parseJavaType(desc)
	if err != nil {
		return nil, fmt.Errorf("invalid type signature for %s: %q", v.Name, desc)
	}
	v.Type = typ
	return v, nil
}

func (j *Importer) scanMethod(decl, desc string, parenIdx int) (*Func, error) {
	// Member is a method
	f := new(Func)
	f.Desc = desc
	for i := parenIdx - 1; i >= 0; i-- {
		if i == 0 || decl[i-1] == ' ' {
			f.Name = decl[i:parenIdx]
			break
		}
	}
	if f.Name == "" {
		return nil, fmt.Errorf("unable to parse method name from declaration: %q", decl)
	}
	if desc[0] != '(' {
		return nil, fmt.Errorf("invalid descriptor for method %s: %q", f.Name, desc)
	}
	const throws = " throws "
	if idx := strings.Index(decl, throws); idx != -1 {
		f.Throws = decl[idx+len(throws):]
	}
	i := 1
	for desc[i] != ')' {
		typ, n, err := j.parseJavaType(desc[i:])
		if err != nil {
			return nil, fmt.Errorf("invalid descriptor for method %s: %v", f.Name, err)
		}
		i += n
		f.Params = append(f.Params, typ)
	}
	f.ArgDesc = desc[1:i]
	i++ // skip ending )
	if desc[i] != 'V' {
		typ, _, err := j.parseJavaType(desc[i:])
		if err != nil {
			return nil, fmt.Errorf("invalid descriptor for method %s: %v", f.Name, err)
		}
		f.Ret = typ
	}
	return f, nil
}

func (j *Importer) fillThrowables(classes []*Class) {
	thrCls, ok := j.clsMap["java.lang.Throwable"]
	if !ok {
		// If Throwable isn't in the class map
		// no imported class inherits from Throwable
		return
	}
	for _, cls := range classes {
		j.fillThrowableFor(cls, thrCls)
	}
}

func (j *Importer) fillThrowableFor(cls, thrCls *Class) {
	if cls.Interface || cls.Throwable {
		return
	}
	cls.Throwable = cls == thrCls
	for _, name := range cls.Supers {
		sup := j.clsMap[name]
		j.fillThrowableFor(sup, thrCls)
		cls.Throwable = cls.Throwable || sup.Throwable
	}
}

func commonSig(f *Func) CommonSig {
	return CommonSig{
		Params: f.Params,
		Ret:    f.Ret,
		HasRet: f.Ret != nil,
		Throws: f.Throws != "",
	}
}

func (j *Importer) fillFuncSigs(funcs []*FuncSet) {
	for _, fs := range funcs {
		var sigs []CommonSig
		for _, f := range fs.Funcs {
			sigs = append(sigs, commonSig(f))
		}
		fs.CommonSig = combineSigs(j.clsMap, sigs...)
	}
}

func (j *Importer) fillAllMethods(cls *Class) {
	if len(cls.AllMethods) > 0 {
		return
	}
	for _, supName := range cls.Supers {
		super := j.clsMap[supName]
		j.fillAllMethods(super)
	}
	var fsets []*FuncSet
	fsets = append(fsets, cls.Methods...)
	for _, supName := range cls.Supers {
		super := j.clsMap[supName]
		fsets = append(fsets, super.AllMethods...)
	}
	sigs := make(map[FuncSig]struct{})
	methods := make(map[string]*FuncSet)
	for _, fs := range fsets {
		clsFs, exists := methods[fs.Name]
		if !exists {
			clsFs = &FuncSet{
				Name:      fs.Name,
				GoName:    fs.GoName,
				CommonSig: fs.CommonSig,
			}
			cls.AllMethods = append(cls.AllMethods, clsFs)
			methods[fs.Name] = clsFs
		} else {
			// Combine the (overloaded) signature with the other variants.
			clsFs.CommonSig = combineSigs(j.clsMap, clsFs.CommonSig, fs.CommonSig)
		}
		for _, f := range fs.Funcs {
			if _, exists := sigs[f.FuncSig]; exists {
				continue
			}
			sigs[f.FuncSig] = struct{}{}
			clsFs.Funcs = append(clsFs.Funcs, f)
		}
	}
}

func (j *Importer) parseJavaValue(v string) (string, bool) {
	v = strings.TrimRight(v, "ldf")
	switch v {
	case "", "NaN", "Infinity", "-Infinity":
		return "", false
	default:
		if v[0] == '\'' {
			// Skip character constants, since they can contain invalid code points
			// that are unacceptable to Go.
			return "", false
		}
		return v, true
	}
}

func (j *Importer) parseJavaType(desc string) (*Type, int, error) {
	t := new(Type)
	var n int
	if desc == "" {
		return t, n, errors.New("empty type signature")
	}
	n++
	switch desc[0] {
	case 'Z':
		t.Kind = Boolean
	case 'B':
		t.Kind = Byte
	case 'C':
		t.Kind = Char
	case 'S':
		t.Kind = Short
	case 'I':
		t.Kind = Int
	case 'J':
		t.Kind = Long
	case 'F':
		t.Kind = Float
	case 'D':
		t.Kind = Double
	case 'L':
		var clsName string
		for i := n; i < len(desc); i++ {
			if desc[i] == ';' {
				clsName = strings.Replace(desc[n:i], "/", ".", -1)
				clsName = strings.Replace(clsName, "$", ".", -1)
				n += i - n + 1
				break
			}
		}
		if clsName == "" {
			return t, n, errors.New("missing ; in class type signature")
		}
		if clsName == "java.lang.String" {
			t.Kind = String
		} else {
			t.Kind = Object
			t.Class = clsName
		}
	case '[':
		et, n2, err := j.parseJavaType(desc[n:])
		if err != nil {
			return t, n, err
		}
		n += n2
		t.Kind = Array
		t.Elem = et
	default:
		return t, n, fmt.Errorf("invalid type signature: %s", desc)
	}
	return t, n, nil
}

func initialUpper(s string) string {
	if s == "" {
		return ""
	}
	r, n := utf8.DecodeRuneInString(s)
	return string(unicode.ToUpper(r)) + s[n:]
}
