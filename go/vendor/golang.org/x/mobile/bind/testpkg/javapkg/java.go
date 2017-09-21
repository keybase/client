// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build android

package javapkg

import (
	"Java/java/lang/Float"
	"Java/java/lang/Integer"
	"Java/java/lang/System"
	"Java/java/util/Collections"
	"Java/java/util/jar/JarFile"
	"fmt"
)

func SystemCurrentTimeMillis() int64 {
	return System.CurrentTimeMillis()
}

func FloatMin() float32 {
	return Float.MIN_VALUE
}

func ManifestName() string {
	return JarFile.MANIFEST_NAME
}

func IntegerBytes() int {
	return Integer.SIZE
}

func IntegerValueOf(v int32) int32 {
	i, _ := Integer.ValueOf(v)
	return i.IntValue()
}

func IntegerDecode(v string) (int32, error) {
	i, err := Integer.Decode(v)
	if err != nil {
		return 0, fmt.Errorf("wrapped error: %v", err)
	}
	// Call methods from super class
	i.HashCode()
	return i.IntValue(), nil
}

func IntegerParseInt(v string, radix int32) (int32, error) {
	return Integer.ParseInt(v, radix)
}

func ProvokeRuntimeException() (err error) {
	defer func() {
		err = recover().(error)
	}()
	Collections.Copy(nil, nil)
	return
}
