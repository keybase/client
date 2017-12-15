// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"strconv"
	"strings"
)

// SizeFlag is for specifying sizes with the flag package.
type SizeFlag struct {
	v *int64
}

// Get for flag interface.
func (sf SizeFlag) Get() interface{} { return *sf.v }

// String for flag interface.
func (sf SizeFlag) String() string {
	// This happens when izZeroValue() from flag.go makes a zero
	// value from the type of a flag.
	if sf.v == nil {
		return "0"
	}
	v := *sf.v
	var suffix string
	const units = "kmgt"
	var c byte
	if v%1000 == 0 {
		for i := 0; v%1000 == 0 && i < len(units); i++ {
			c = units[i]
			v /= 1000
		}
		suffix = string(c)
	} else if v%1024 == 0 {
		for i := 0; v%1024 == 0 && i < len(units); i++ {
			c = units[i]
			v /= 1024
		}
		suffix = string(c) + "i"
	}
	return fmt.Sprintf("%d%s", v, suffix)
}

// Set for flag interface.
func (sf SizeFlag) Set(raw string) error {
	i := 0
	for ; i < len(raw) && raw[i] >= '0' && raw[i] <= '9'; i++ {
	}
	val, err := strconv.ParseInt(raw[:i], 10, 64)
	if err != nil {
		return err
	}
	// constant map so concurrent access is ok.
	mult, found := sizeFlagMap[strings.ToLower(raw[i:])]
	if !found {
		return fmt.Errorf("Invalid syntax: %q, supported syntax is 0-9+(k|m|g|t)[i]", raw)
	}
	*sf.v = val * mult
	return nil
}

var sizeFlagMap = map[string]int64{
	"":   1,
	"k":  1000,
	"ki": 1024,
	"m":  1000 * 1000,
	"mi": 1024 * 1024,
	"g":  1000 * 1000 * 1000,
	"gi": 1024 * 1024 * 1024,
	"t":  1000 * 1000 * 1000 * 1000,
	"ti": 1024 * 1024 * 1024 * 1024,
}
