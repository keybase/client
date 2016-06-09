// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/keybase/go-codec/codec"
)

const (
	// TlfHandleExtensionDateFormat is the date format for the TlfHandleExtension string.
	TlfHandleExtensionDateFormat = "2006-01-02"
	// TlfHandleExtensionDateRegex is the regular expression matching the TlfHandleExtension
	// date member in string form.
	TlfHandleExtensionDateRegex = "2[0-9]{3}-[0-9]{2}-[0-9]{2}"
	// TlfHandleExtensionNumberRegex is the regular expression matching the TlfHandleExtension
	// number member in string form.
	TlfHandleExtensionNumberRegex = "[0-9]+"
	// TlfHandleExtensionConflictString is the string identifying a conflict extension.
	TlfHandleExtensionConflictString = "conflicted copy"
	// TlfHandleExtensionFinalizedString is the string identifying a finalized extension.
	TlfHandleExtensionFinalizedString = "finalized"
	// TlfHandleExtensionTypeRegex is the regular expression matching the TlfHandleExtension
	// type string.
	TlfHandleExtensionTypeRegex = TlfHandleExtensionConflictString + "|" +
		TlfHandleExtensionFinalizedString
	// TlfHandleExtensionFormat is the formate string for a TlfHandleExtension.
	TlfHandleExtensionFormat = "(%s %s%s)"
)

// TlfHandleExtensionType is the type of extension.
type TlfHandleExtensionType int

const (
	// TlfHandleExtensionConflict means the handle conflicted as a result of a social
	// assertion resolution.
	TlfHandleExtensionConflict TlfHandleExtensionType = iota
	// TlfHandleExtensionFinalized means the folder ended up with no more valid writers as
	// a result of an account reset.
	TlfHandleExtensionFinalized
	// TlfHandleExtensionUnknown means the type is unknown.
	TlfHandleExtensionUnknown
)

// String implements the fmt.Stringer interface for TlfHandleExtensionType
func (et TlfHandleExtensionType) String() string {
	switch et {
	case TlfHandleExtensionConflict:
		return TlfHandleExtensionConflictString
	case TlfHandleExtensionFinalized:
		return TlfHandleExtensionFinalizedString
	}
	return "<unknown extension type>"
}

// ParseTlfHandleExtensionType parses an extension type from a string.
func ParseTlfHandleExtensionType(s string) TlfHandleExtensionType {
	switch s {
	case TlfHandleExtensionConflictString:
		return TlfHandleExtensionConflict
	case TlfHandleExtensionFinalizedString:
		return TlfHandleExtensionFinalized
	}
	return TlfHandleExtensionUnknown
}

// ErrTlfHandleExtensionInvalidString is returned when a given string is not parsable as a
// valid extension suffix.
var ErrTlfHandleExtensionInvalidString = errors.New("Invalid TLF handle extension string")

// ErrTlfHandleExtensionInvalidNumber is returned when an invalid number is used in an
// extension definition. Handle extension numbers present in the string must be >1. Numbers
// passed to NewTlfHandleExtension must be >0.
var ErrTlfHandleExtensionInvalidNumber = errors.New("Invalid TLF handle extension number")

// TlfHandleExtensionRegex is the compiled regular expression matching a valid combination
// of TLF handle extensions in string form.
var TlfHandleExtensionRegex = regexp.MustCompile(
	fmt.Sprintf("\\"+TlfHandleExtensionFormat,
		"("+TlfHandleExtensionTypeRegex+")",
		"("+TlfHandleExtensionDateRegex+")",
		"(?: #("+TlfHandleExtensionNumberRegex+"))?\\"),
)

// TlfHandleExtension is information which identifies a particular extension.
type TlfHandleExtension struct {
	Date   int64                  `codec:"date"`
	Number uint16                 `codec:"num"`
	Type   TlfHandleExtensionType `codec:"type"`
	codec.UnknownFieldSetHandler
}

// String implements the fmt.Stringer interface for TlfHandleExtension.
// Ex: "(conflicted copy 2016-05-09 #2)"
func (e TlfHandleExtension) String() string {
	date := time.Unix(e.Date, 0).UTC().Format(TlfHandleExtensionDateFormat)
	var num string
	if e.Number > 1 {
		num = " #"
		num += strconv.FormatUint(uint64(e.Number), 10)
	}
	return fmt.Sprintf(TlfHandleExtensionFormat, e.Type.String(), date, num)
}

// NewTlfHandleExtension returns a new TlfHandleExtension struct populated with the current
// date and conflict number.
func NewTlfHandleExtension(extType TlfHandleExtensionType, num uint16) (
	*TlfHandleExtension, error) {
	return newTlfHandleExtension(extType, num, wallClock{})
}

// NewTestTlfHandleExtensionWithClock returns a new TlfHandleExtension using a passed clock.
func NewTestTlfHandleExtensionWithClock(extType TlfHandleExtensionType,
	num uint16, clock Clock) (*TlfHandleExtension, error) {
	return newTlfHandleExtension(extType, num, clock)
}

// Implementation of the Clock interface to return a static time for testing.
type staticTestTlfHandleExtensionClock struct {
}

// Now implements the Clock interface for staticTestTlfHandleExtensionClock.
func (c staticTestTlfHandleExtensionClock) Now() time.Time {
	// 2016-03-14
	return time.Unix(1457913600, 0)
}

// NewTestTlfHandleExtensionStaticTime returns a new TlfHandleExtension struct populated with
// a static date for testing.
func NewTestTlfHandleExtensionStaticTime(extType TlfHandleExtensionType, num uint16) (
	*TlfHandleExtension, error) {
	return newTlfHandleExtension(extType, num, staticTestTlfHandleExtensionClock{})
}

// Helper to instantiate a TlfHandleExtension object.
func newTlfHandleExtension(extType TlfHandleExtensionType, num uint16, clock Clock) (
	*TlfHandleExtension, error) {
	if num == 0 {
		return nil, ErrTlfHandleExtensionInvalidNumber
	}
	// mask out everything but the date
	date := clock.Now().UTC().Format(TlfHandleExtensionDateFormat)
	now, err := time.Parse(TlfHandleExtensionDateFormat, date)
	if err != nil {
		return nil, err
	}
	return &TlfHandleExtension{
		Date:   now.UTC().Unix(),
		Number: num,
		Type:   extType,
	}, nil
}

// parseTlfHandleExtension parses a TlfHandleExtension array of string fields.
func parseTlfHandleExtension(fields []string) (*TlfHandleExtension, error) {
	if len(fields) != 4 {
		return nil, ErrTlfHandleExtensionInvalidString
	}
	extType := ParseTlfHandleExtensionType(fields[1])
	if extType == TlfHandleExtensionUnknown {
		return nil, ErrTlfHandleExtensionInvalidString
	}
	date, err := time.Parse(TlfHandleExtensionDateFormat, fields[2])
	if err != nil {
		return nil, err
	}
	var num uint64 = 1
	if len(fields[3]) != 0 {
		num, err = strconv.ParseUint(fields[3], 10, 16)
		if err != nil {
			return nil, err
		}
		if num < 2 {
			return nil, ErrTlfHandleExtensionInvalidNumber
		}
	}
	return &TlfHandleExtension{
		Date:   date.UTC().Unix(),
		Number: uint16(num),
		Type:   extType,
	}, nil
}

// ParseTlfHandleExtensionSuffix parses a TLF handle extension suffix string.
func ParseTlfHandleExtensionSuffix(s string) ([]TlfHandleExtension, error) {
	exts := TlfHandleExtensionRegex.FindAllStringSubmatch(s, 2)
	if len(exts) < 1 || len(exts) > 2 {
		return nil, ErrTlfHandleExtensionInvalidString
	}
	extMap := make(map[TlfHandleExtensionType]bool)
	var extensions []TlfHandleExtension
	for _, e := range exts {
		ext, err := parseTlfHandleExtension(e)
		if err != nil {
			return nil, err
		}
		if extMap[ext.Type] {
			// No duplicate extension types in the same suffix.
			return nil, ErrTlfHandleExtensionInvalidString
		}
		extMap[ext.Type] = true
		extensions = append(extensions, *ext)
	}
	return extensions, nil
}

// NewTlfHandleExtensionSuffix creates a suffix string given a set of extensions.
func NewTlfHandleExtensionSuffix(extensions []TlfHandleExtension) string {
	var suffix string
	for _, extension := range extensions {
		suffix += TlfHandleExtensionSep
		suffix += extension.String()
	}
	return suffix
}

// tlfHandleExtensionList allows us to sort extensions by type.
type tlfHandleExtensionList []TlfHandleExtension

func (l tlfHandleExtensionList) Len() int {
	return len(l)
}

func (l tlfHandleExtensionList) Less(i, j int) bool {
	return l[i].Type < l[j].Type
}

func (l tlfHandleExtensionList) Swap(i, j int) {
	l[i], l[j] = l[j], l[i]
}

func (l tlfHandleExtensionList) Splat() (ci, fi *TlfHandleExtension) {
	for _, extension := range l {
		tmp := extension
		if extension.Type == TlfHandleExtensionConflict {
			ci = &tmp
		} else if extension.Type == TlfHandleExtensionFinalized {
			fi = &tmp
		}
	}
	return ci, fi
}
