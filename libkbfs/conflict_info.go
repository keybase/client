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
	// ConflictInfoDateFormat is the date format for the ConflictInfo string.
	ConflictInfoDateFormat = "2006-01-02"
	// ConflictInfoDateRegex is the regular expression matching the ConflictInfo
	// date member in string form.
	ConflictInfoDateRegex = "2[0-9]{3}-[0-9]{2}-[0-9]{2}"
	// ConflictInfoNumberRegex is the regular expression matching the ConflictInfo
	// number member in string form.
	ConflictInfoNumberRegex = "[0-9]+"
	// ConflictInfoStringFormat is the format string for the conflict info string.
	ConflictInfoStringFormat = "(conflicted copy %s%s)"
)

// ErrConflictInfoInvalidString is returned when a given string is not parsable as a
// valid conflict info suffix.
var ErrConflictInfoInvalidString = errors.New("Invalid conflict info string")

// ErrConflictInfoInvalidNumber is returned when an invalid number is used in a conflict
// info defition. Conflict info numbers present in the string must be >1. Numbers passed
// to NewConflictInfo must be >0.
var ErrConflictInfoInvalidNumber = errors.New("Invalid conflict info number")

// ConflictInfoRegex is the compiled regular expression matching a valid conflict info
// suffix in string form.
var ConflictInfoRegex = regexp.MustCompile(
	fmt.Sprintf("^\\"+ConflictInfoStringFormat+"$",
		"("+ConflictInfoDateRegex+")", "(?: #("+ConflictInfoNumberRegex+"))?\\"),
)

// ConflictInfo is information which identifies a folder handle conflict.
type ConflictInfo struct {
	Date   int64  `codec:"date"`
	Number uint16 `codec:"num"`
	codec.UnknownFieldSetHandler
}

// String implements the fmt.Stringer interface for ConflictInfo.
// Ex: "(conflicted copy 2016-05-09 #2)"
func (ci ConflictInfo) String() string {
	date := time.Unix(ci.Date, 0).UTC().Format(ConflictInfoDateFormat)
	var num string
	if ci.Number > 1 {
		num = " #"
		num += strconv.FormatUint(uint64(ci.Number), 10)
	}
	return fmt.Sprintf(ConflictInfoStringFormat, date, num)
}

// NewConflictInfo returns a new ConflictInfo struct populated with the current
// date and conflict number.
func NewConflictInfo(num uint16) (*ConflictInfo, error) {
	return newConflictInfo(wallClock{}, num)
}

// NewTestConflictInfoWithClock returns a new ConflictInfo using a passed clock.
func NewTestConflictInfoWithClock(clock Clock, num uint16) (*ConflictInfo, error) {
	return newConflictInfo(clock, num)
}

// Implementation of the Clock interface to return a static time for testing.
type staticTestConflictInfoClock struct {
}

// Now implements the Clock interface for staticTestConflictInfoClock.
func (c staticTestConflictInfoClock) Now() time.Time {
	// 2016-03-14
	return time.Unix(1457913600, 0)
}

// NewTestConflictInfoStaticTime returns a new ConflictInfo struct populated with
// a static date for testing.
func NewTestConflictInfoStaticTime(num uint16) (*ConflictInfo, error) {
	return newConflictInfo(staticTestConflictInfoClock{}, num)
}

// Helper to instantiate a ConflictInfo object.
func newConflictInfo(clock Clock, num uint16) (*ConflictInfo, error) {
	if num == 0 {
		return nil, ErrConflictInfoInvalidNumber
	}
	// mask out everything but the date
	date := clock.Now().UTC().Format(ConflictInfoDateFormat)
	now, err := time.Parse(ConflictInfoDateFormat, date)
	if err != nil {
		return nil, err
	}
	return &ConflictInfo{
		Date:   now.UTC().Unix(),
		Number: num,
	}, nil
}

// ParseConflictInfo parses a ConflictInfo string.
func ParseConflictInfo(s string) (*ConflictInfo, error) {
	values := ConflictInfoRegex.FindStringSubmatch(s)
	if len(values) != 3 {
		return nil, ErrConflictInfoInvalidString
	}
	date, err := time.Parse(ConflictInfoDateFormat, values[1])
	if err != nil {
		return nil, err
	}
	var num uint64 = 1
	if len(values[2]) != 0 {
		num, err = strconv.ParseUint(values[2], 10, 16)
		if err != nil {
			return nil, err
		}
		if num < 2 {
			return nil, ErrConflictInfoInvalidNumber
		}
	}
	return &ConflictInfo{
		Date:   date.UTC().Unix(),
		Number: uint16(num),
	}, nil
}
