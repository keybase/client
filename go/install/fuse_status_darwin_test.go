// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin

package install

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFindStringInPlist(t *testing.T) {
	const plistTestData = `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
  <dict>
  	<key>CFBundleName</key>
  	<string>Keybase</string>
  	<key>CFBundleVersion</key>
  	<string>1.0.17-20160825110028+67f6e3b</string>
  	<key>NSMainNibFile</key>
  	<string>MainMenu</string>
  </dict>
  </plist>`
	version := findStringInPlist("CFBundleVersion", []byte(plistTestData), testLog)
	assert.Equal(t, "1.0.17-20160825110028+67f6e3b", version)
}

func TestFindStringInPlistWithWhitespace(t *testing.T) {
	const plistTestData = `    <key> test </key>` + "\n\n \t" + `  <string> value </string>  ` + "\n\t"
	value := findStringInPlist(" test ", []byte(plistTestData), testLog)
	assert.Equal(t, " value ", value)
}

func TestFindStringInPlistWithNoWhitespace(t *testing.T) {
	const plistTestData = `<key>test</key><string>value</string>`
	value := findStringInPlist("test", []byte(plistTestData), testLog)
	assert.Equal(t, "value", value)
}
