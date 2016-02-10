// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// This is a utility which binds to libkb to get the correct version
// for printing out or generating compiled resources for the windows
// executlable.

// +build windows

package main

import (
	"bytes"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

//{
//  "version": "1.0.10-201602061107+0b64c28",
//  "name": "v1.0.10-201602061107+0b64c28",
//  "description": "",
//  "type": 0,
//  "publishedAt": 1454784000000,
//  "asset": {
//    "name": "keybase_setup_gui_1.0.10-201602061107+0b64c28_386.exe",
//    "url": "https://s3.amazonaws.com/prerelease.keybase.io/windows-updates/keybase_setup_gui_1.0.10-201602061107%2B0b64c28_386.exe",
//	"digest": "6570abad155ce8e785da1e86df80a1b58073c83e079f849ca291b21a2bd3e0ff",
//    "localPath": ""
//  }
//}

func OutputUpdateJSon(ver, pathname string) {

	calcDigest, err := libkb.DigestForFileAtPath(pathname)
	fname := filepath.Base(pathname)
	if err != nil {
		return
	}

	publishedAt := keybase1.Time(time.Now().Unix()) * 1000

	var update = keybase1.Update{
		Version:     ver,
		Name:        "v" + ver,
		Description: "",
		Type:        keybase1.UpdateType_NORMAL,
		PublishedAt: &publishedAt,
		Asset: &keybase1.Asset{
			Name:      fname,
			Url:       "https://s3.amazonaws.com/prerelease.keybase.io/windows-updates/" + strings.Replace(fname, "+", "%2B", -1),
			Digest:    calcDigest,
			LocalPath: "",
		},
	}

	b, err := json.Marshal(update)
	if err != nil {
		log.Fatal(err)
	}

	var out bytes.Buffer
	json.Indent(&out, b, "", "  ")
	out.WriteTo(os.Stdout)
}
