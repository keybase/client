// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package client

import (
	"bufio"
	"fmt"
	"github.com/keybase/client/go/libkb"
	"io"
	"os"
	"path/filepath"
	"sort"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

type utfScanner interface {
	Read(p []byte) (n int, err error)
}

// Creates a scanner similar to os.Open() but decodes the file as UTF-16
// if the special byte order mark is present.
func newScannerUTF16or8(filename string) (utfScanner, error) {

	// Read the file into a []byte:
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}

	// Check for BOM
	marker := make([]byte, 2)
	numread, err := io.ReadAtLeast(file, marker, 2)
	file.Seek(0, 0)
	if numread == 2 && err == nil && ((marker[0] == 0xFE && marker[1] == 0xFF) || (marker[0] == 0xFF && marker[1] == 0xFE)) {
		// Make an tranformer that converts MS-Win default to UTF8:
		win16be := unicode.UTF16(unicode.BigEndian, unicode.UseBOM)
		// Make a transformer that is like win16be, but abides by BOM:
		utf16bom := unicode.BOMOverride(win16be.NewDecoder())

		// Make a Reader that uses utf16bom:
		unicodeReader := transform.NewReader(file, utf16bom)
		return unicodeReader, nil
	}
	return file, nil
}

// Catenate a handful of install logs in to one for server upload.
// Unfortunately, Dokan can generate UTF16 logs, so we test each file
// and translate if necessary.
func GetInstallLogPath() (string, error) {
	// Get the 3 newest keybase logs - sorting by name works because timestamp
	keybaseLogFiles, err := filepath.Glob(os.ExpandEnv(filepath.Join("${TEMP}", "Keybase*.log")))
	sort.Strings(keybaseLogFiles)
	if len(keybaseLogFiles) > 3 {
		keybaseLogFiles = keybaseLogFiles[:3]
	}
	// Get the 2 newest dokan logs - sorting by name works because timestamp
	dokanLogFiles, err := filepath.Glob(os.ExpandEnv(filepath.Join("${TEMP}", "Dokan*.log")))
	sort.Strings(dokanLogFiles)
	if len(dokanLogFiles) > 2 {
		dokanLogFiles = dokanLogFiles[:2]
	}
	keybaseLogFiles = append(keybaseLogFiles, dokanLogFiles...)

	logName, logFile, err := libkb.OpenTempFile("KeybaseInstallUpload", ".log", 0)
	defer logFile.Close()
	if err != nil {
		return "", err
	}
	if len(keybaseLogFiles) == 0 {
		fmt.Fprintf(logFile, "   --- NO INSTALL LOGS FOUND!?! ---\n")
	}
	for _, path := range keybaseLogFiles {
		fmt.Fprintf(logFile, "   --- %s ---\n", path)

		// We have to parse the contents and write them because some files need to
		// be decoded from utf16
		s, err := newScannerUTF16or8(path)
		if err != nil {
			fmt.Fprintf(logFile, "  --- NewScannerUTF16(%s) returns %v---\n", path, err)
		} else {
			scanner := bufio.NewScanner(s)
			for scanner.Scan() {
				fmt.Fprintln(logFile, scanner.Text()) // Println will add back the final '\n'
			}
			if err := scanner.Err(); err != nil {
				fmt.Fprintf(logFile, "  --- error reading (%s): %v---\n", path, err)
			}
		}
		fmt.Fprint(logFile, "\n\n")
	}

	return logName, err
}
