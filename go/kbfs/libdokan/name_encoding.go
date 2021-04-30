// Copyright 2021 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libdokan

import "strings"

var kbfsNameToWindowsReplaceSequence = [][2]string{
	{"%", "%25"},
	{"\\", "%5c"},
}
var windowsNameToKbfsReplaceSequence = [][2]string{
	{"%5c", "\\"},
	{"%5C", "\\"},
	{"%25", "%"},
}

func encodeKbfsNameForWindows(kbfsName string) (windowsName string) {
	windowsName = kbfsName
	for _, replacement := range kbfsNameToWindowsReplaceSequence {
		windowsName = strings.ReplaceAll(windowsName, replacement[0], replacement[1])
	}
	return windowsName
}

type InvalidWindowsNameError struct{}

func (InvalidWindowsNameError) Error() string {
	return "invalid windows path name"
}

func decodeWindowsNameForKbfs(windowsName string) (kbfsName string, err error) {
	if strings.ContainsRune(windowsName, '\\') {
		return "", InvalidWindowsNameError{}
	}

	kbfsName = windowsName
	for _, replacement := range windowsNameToKbfsReplaceSequence {
		kbfsName = strings.ReplaceAll(kbfsName, replacement[0], replacement[1])
	}
	return kbfsName, nil
}
