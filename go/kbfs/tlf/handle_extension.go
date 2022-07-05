// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/go-codec/codec"
)

const (
	// HandleExtensionSep is the string that separates the folder
	// participants from an extension suffix in the TLF name.
	HandleExtensionSep = " "
	// HandleExtensionDateFormat is the date format for the HandleExtension string.
	handleExtensionDateFormat = "2006-01-02"
	// HandleExtensionDateRegex is the regular expression matching the HandleExtension
	// date member in string form.
	handleExtensionDateRegex = "2[0-9]{3}-[0-9]{2}-[0-9]{2}"
	// HandleExtensionNumberRegex is the regular expression matching the HandleExtension
	// number member in string form.
	handleExtensionNumberRegex = "[0-9]+"
	// HandleExtensionUsernameRegex is the regular expression matching the HandleExtension
	// username member in string form.
	handleExtensionUsernameRegex = "[a-z0-9_]+"
	// HandleExtensionConflictString is the string identifying a conflict extension.
	handleExtensionConflictString = "conflicted copy"
	// HandleExtensionLocalConflictString is the string identifying a
	// conflict extension for a local-only conflict branch of a TLF.
	handleExtensionLocalConflictString = "local conflicted copy"
	// HandleExtensionFinalizedString is the format string identifying a finalized extension.
	handleExtensionFinalizedString = "files before %saccount reset"
	// HandleExtensionFormat is the formate string for a HandleExtension.
	handleExtensionFormat = "(%s %s%s)"
	// HandleExtensionStaticTestDate is a static date used for tests (2016-03-14).
	HandleExtensionStaticTestDate = 1457913600
)

// HandleExtensionType is the type of extension.
type HandleExtensionType int

const (
	// HandleExtensionConflict means the handle conflicted as a result of a social
	// assertion resolution.
	HandleExtensionConflict HandleExtensionType = iota
	// HandleExtensionFinalized means the folder ended up with no more valid writers as
	// a result of an account reset.
	HandleExtensionFinalized
	// HandleExtensionLocalConflict means the handle conflicted as a
	// result of a local conflict branch.
	HandleExtensionLocalConflict
	// HandleExtensionUnknown means the type is unknown.
	HandleExtensionUnknown
)

// HandleExtensionFinalizedStringRegex is the regex identifying a finalized extension string.
var handleExtensionFinalizedStringRegex = fmt.Sprintf(
	handleExtensionFinalizedString, "(?:"+handleExtensionUsernameRegex+"[\\s]+)*",
)

// HandleExtensionTypeRegex is the regular expression matching the HandleExtension string.
var handleExtensionTypeRegex = handleExtensionConflictString + "|" +
	handleExtensionLocalConflictString + "|" +
	handleExtensionFinalizedStringRegex

// HandleExtensionFinalizedRegex is the compiled regular expression matching a finalized
// handle extension.
var handleExtensionFinalizedRegex = regexp.MustCompile(
	fmt.Sprintf(handleExtensionFinalizedString, "(?:("+handleExtensionUsernameRegex+")[\\s]+)*"),
)

// String implements the fmt.Stringer interface for HandleExtensionType
func (et HandleExtensionType) String(username kbname.NormalizedUsername) string {
	switch et {
	case HandleExtensionConflict:
		return handleExtensionConflictString
	case HandleExtensionLocalConflict:
		return handleExtensionLocalConflictString
	case HandleExtensionFinalized:
		if len(username) != 0 {
			username += " "
		}
		return fmt.Sprintf(handleExtensionFinalizedString, username)
	}
	return "<unknown extension type>"
}

// parseHandleExtensionString parses an extension type and optional username from a string.
func parseHandleExtensionString(s string) (HandleExtensionType, kbname.NormalizedUsername) {
	if handleExtensionConflictString == s {
		return HandleExtensionConflict, ""
	} else if handleExtensionLocalConflictString == s {
		return HandleExtensionLocalConflict, ""
	}
	m := handleExtensionFinalizedRegex.FindStringSubmatch(s)
	if len(m) < 2 {
		return HandleExtensionUnknown, ""
	}
	return HandleExtensionFinalized, kbname.NewNormalizedUsername(m[1])
}

// ErrHandleExtensionInvalidString is returned when a given string is not parsable as a
// valid extension suffix.
var errHandleExtensionInvalidString = errors.New("Invalid TLF handle extension string")

// ErrHandleExtensionInvalidNumber is returned when an invalid number is used in an
// extension definition. Handle extension numbers present in the string must be >1. Numbers
// passed to NewHandleExtension must be >0.
var errHandleExtensionInvalidNumber = errors.New("Invalid TLF handle extension number")

// HandleExtensionRegex is the compiled regular expression matching a valid combination
// of TLF handle extensions in string form.
var handleExtensionRegex = regexp.MustCompile(
	fmt.Sprintf("\\"+handleExtensionFormat,
		"("+handleExtensionTypeRegex+")",
		"("+handleExtensionDateRegex+")",
		"(?: #("+handleExtensionNumberRegex+"))?\\"),
)

// HandleExtension is information which identifies a particular extension.
type HandleExtension struct {
	Date     int64                     `codec:"date"`
	Number   uint16                    `codec:"num"`
	Type     HandleExtensionType       `codec:"type"`
	Username kbname.NormalizedUsername `codec:"un,omitempty"`
	codec.UnknownFieldSetHandler
}

// String implements the fmt.Stringer interface for HandleExtension.
// Ex: "(conflicted copy 2016-05-09 #2)"
func (e HandleExtension) string(isBackedByTeam bool) string {
	date := time.Unix(e.Date, 0).UTC().Format(handleExtensionDateFormat)
	var num string
	minNumberSuffixToShow := uint16(2)
	if isBackedByTeam {
		// When a TLF is backed by an implicit team, it should always
		// use the "#1" suffix, unlike for older TLFs.
		minNumberSuffixToShow = 1
	}
	if e.Number >= minNumberSuffixToShow {
		num = " #"
		num += strconv.FormatUint(uint64(e.Number), 10)
	}
	return fmt.Sprintf(handleExtensionFormat, e.Type.String(e.Username), date, num)
}

// String implements the fmt.Stringer interface for HandleExtension.
// Ex: "(conflicted copy 2016-05-09 #2)"
func (e HandleExtension) String() string {
	return e.string(false)
}

// NewHandleExtension returns a new HandleExtension struct
// populated with the date from the given time and conflict number.
func NewHandleExtension(extType HandleExtensionType, num uint16, un kbname.NormalizedUsername, now time.Time) (
	*HandleExtension, error) {
	return newHandleExtension(extType, num, un, now)
}

// NewTestHandleExtensionStaticTime returns a new HandleExtension struct populated with
// a static date for testing.
func NewTestHandleExtensionStaticTime(extType HandleExtensionType, num uint16, un kbname.NormalizedUsername) (
	*HandleExtension, error) {
	now := time.Unix(HandleExtensionStaticTestDate, 0)
	return newHandleExtension(extType, num, un, now)
}

// Helper to instantiate a HandleExtension object.
func newHandleExtension(extType HandleExtensionType, num uint16, un kbname.NormalizedUsername, now time.Time) (
	*HandleExtension, error) {
	if num == 0 {
		return nil, errHandleExtensionInvalidNumber
	}
	// mask out everything but the date
	date := now.UTC().Format(handleExtensionDateFormat)
	now, err := time.Parse(handleExtensionDateFormat, date)
	if err != nil {
		return nil, err
	}
	return &HandleExtension{
		Date:     now.UTC().Unix(),
		Number:   num,
		Type:     extType,
		Username: un,
	}, nil
}

// parseHandleExtension parses a HandleExtension array of string fields.
func parseHandleExtension(fields []string) (*HandleExtension, error) {
	if len(fields) != 4 {
		return nil, errHandleExtensionInvalidString
	}
	extType, un := parseHandleExtensionString(fields[1])
	if extType == HandleExtensionUnknown {
		return nil, errHandleExtensionInvalidString
	}
	date, err := time.Parse(handleExtensionDateFormat, fields[2])
	if err != nil {
		return nil, err
	}
	var num uint64 = 1
	if len(fields[3]) != 0 {
		num, err = strconv.ParseUint(fields[3], 10, 16)
		if err != nil {
			return nil, err
		}
		if num < 1 {
			return nil, errHandleExtensionInvalidNumber
		}
	}
	return &HandleExtension{
		Date:     date.UTC().Unix(),
		Number:   uint16(num),
		Type:     extType,
		Username: un,
	}, nil
}

// ParseHandleExtensionSuffix parses a TLF handle extension suffix string.
func ParseHandleExtensionSuffix(s string) ([]HandleExtension, error) {
	exts := handleExtensionRegex.FindAllStringSubmatch(s, 2)
	if len(exts) < 1 || len(exts) > 2 {
		return nil, errHandleExtensionInvalidString
	}
	extMap := make(map[HandleExtensionType]bool)
	var extensions []HandleExtension
	for _, e := range exts {
		ext, err := parseHandleExtension(e)
		if err != nil {
			return nil, err
		}
		if extMap[ext.Type] {
			// No duplicate extension types in the same suffix.
			return nil, errHandleExtensionInvalidString
		}
		extMap[ext.Type] = true
		extensions = append(extensions, *ext)
	}
	return extensions, nil
}

// newHandleExtensionSuffix creates a suffix string given a set of extensions.
func newHandleExtensionSuffix(
	extensions []HandleExtension, isBackedByTeam bool) string {
	var suffix string
	for _, extension := range extensions {
		suffix += HandleExtensionSep
		suffix += extension.string(isBackedByTeam)
	}
	return suffix
}

// HandleExtensionList allows us to sort extensions by type.
type HandleExtensionList []HandleExtension

func (l HandleExtensionList) Len() int {
	return len(l)
}

func (l HandleExtensionList) Less(i, j int) bool {
	return l[i].Type < l[j].Type
}

func (l HandleExtensionList) Swap(i, j int) {
	l[i], l[j] = l[j], l[i]
}

// Splat will deconstruct the list for the caller into individual extension
// pointers (or nil.)
func (l HandleExtensionList) Splat() (ci, fi *HandleExtension) {
	for _, extension := range l {
		tmp := extension
		switch extension.Type {
		case HandleExtensionConflict, HandleExtensionLocalConflict:
			if ci != nil {
				panic("Conflict extension already exists")
			}
			ci = &tmp
		case HandleExtensionFinalized:
			fi = &tmp
		}
	}
	return ci, fi
}

// Suffix outputs a suffix string for this extension list.
func (l HandleExtensionList) Suffix() string {
	return newHandleExtensionSuffix(l, false)
}

// SuffixForTeamHandle outputs a suffix string for this extension list
// for a handle that's backed by a team (which must be an implicit
// team, since there aren't any suffixes for regulat teams).
func (l HandleExtensionList) SuffixForTeamHandle() string {
	return newHandleExtensionSuffix(l, true)
}

// ContainsLocalConflictExtensionPrefix returns true if the string
// contains the local conflict string.
func ContainsLocalConflictExtensionPrefix(s string) bool {
	return strings.Contains(s, "("+handleExtensionLocalConflictString)
}
