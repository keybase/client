// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"fmt"
	"strings"
)

// MetadataFlags bitfield.
type MetadataFlags byte

// Possible flags set in the MetadataFlags bitfield.
const (
	MetadataFlagRekey MetadataFlags = 1 << iota
	MetadataFlagWriterMetadataCopied
	MetadataFlagFinal
)

var metadataFlagStringMap = map[int]string{
	int(MetadataFlagRekey):                "Rekey",
	int(MetadataFlagWriterMetadataCopied): "WriterMetadataCopied",
	int(MetadataFlagFinal):                "Final",
}

func flagsToString(flags int, flagStringMap map[int]string) string {
	var flagStrings []string
	for f, s := range flagStringMap {
		if flags&f != 0 {
			flagStrings = append(flagStrings, s)
			flags &^= f
		}
	}
	if flags != 0 {
		flagStrings = append(flagStrings, fmt.Sprintf("%b", flags))
	}
	return strings.Join(flagStrings, " | ")
}

func (flags MetadataFlags) String() string {
	return fmt.Sprintf("MetadataFlags(%s)", flagsToString(int(flags), metadataFlagStringMap))
}

// WriterFlags bitfield.
type WriterFlags byte

// Possible flags set in the WriterFlags bitfield.
const (
	MetadataFlagUnmerged WriterFlags = 1 << iota
)

var writerFlagStringMap = map[int]string{
	int(MetadataFlagUnmerged): "Unmerged",
}

func (flags WriterFlags) String() string {
	return fmt.Sprintf("WriterFlags(%s)", flagsToString(int(flags), writerFlagStringMap))
}
