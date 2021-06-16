// Copyright 2021 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkb

import (
	"fmt"
	"strings"
)

const escapeSacrificeForWindows = '‰'

const disallowedRunesOnWindows = "<>:\"/\\|?*"

var kbfsNameToWindowsReplaceSequence [][2]string
var windowsNameToKbfsReplaceSequence [][2]string

func init() {
	makeEscapePair := func(r rune) [2]string {
		return [2]string{string(r), fmt.Sprintf("‰%x", r)}
	}
	makeUnescapePairs := func(r rune) [][2]string {
		lower := fmt.Sprintf("‰%x", r)
		upper := fmt.Sprintf("‰%X", r)
		if lower == upper {
			return [][2]string{
				{lower, string(r)},
			}
		}
		return [][2]string{
			{lower, string(r)},
			{upper, string(r)},
		}
	}

	kbfsNameToWindowsReplaceSequence = nil
	windowsNameToKbfsReplaceSequence = nil

	kbfsNameToWindowsReplaceSequence = append(kbfsNameToWindowsReplaceSequence,
		makeEscapePair(escapeSacrificeForWindows),
	)
	for _, r := range disallowedRunesOnWindows {
		kbfsNameToWindowsReplaceSequence = append(
			kbfsNameToWindowsReplaceSequence, makeEscapePair(r))
		windowsNameToKbfsReplaceSequence = append(
			windowsNameToKbfsReplaceSequence, makeUnescapePairs(r)...)
	}
	windowsNameToKbfsReplaceSequence = append(windowsNameToKbfsReplaceSequence,
		makeUnescapePairs(escapeSacrificeForWindows)...)
}

// EncodeKbfsNameForWindows encodes a KBFS  path element for Windows by
// escaping disallowed characters.
func EncodeKbfsNameForWindows(kbfsName string) (windowsName string) {
	// fast path for names that don't have characters that need escaping
	if !strings.ContainsAny(kbfsName, disallowedRunesOnWindows) &&
		!strings.ContainsRune(kbfsName, escapeSacrificeForWindows) {
		return kbfsName
	}
	windowsName = kbfsName
	for _, replacement := range kbfsNameToWindowsReplaceSequence {
		windowsName = strings.ReplaceAll(windowsName, replacement[0], replacement[1])
	}
	return windowsName
}

// InvalidWindowsNameError is the error returned when an invalid path name is
// passed in.
type InvalidWindowsNameError struct{}

// Error implements the error interface.
func (InvalidWindowsNameError) Error() string {
	return "invalid windows path name"
}

// DecodeWindowsNameForKbfs decodes a path element encoded by
// EncodeKbfsNameForWindows.
func DecodeWindowsNameForKbfs(windowsName string) (kbfsName string, err error) {
	if strings.ContainsAny(windowsName, disallowedRunesOnWindows) {
		return "", InvalidWindowsNameError{}
	}

	// fast path for names that don't have escaped characters
	if !strings.ContainsRune(windowsName, escapeSacrificeForWindows) {
		return windowsName, nil
	}

	kbfsName = windowsName
	for _, replacement := range windowsNameToKbfsReplaceSequence {
		kbfsName = strings.ReplaceAll(kbfsName, replacement[0], replacement[1])
	}
	return kbfsName, nil
}
