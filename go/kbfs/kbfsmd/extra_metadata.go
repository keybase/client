// Copyright 2017 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsmd

import (
	"fmt"

	"github.com/keybase/client/go/kbfs/kbfscodec"
)

// ExtraMetadata is a per-version blob of extra metadata which may
// exist outside of the given metadata block, e.g. key bundles for
// post-v2 metadata.
type ExtraMetadata interface {
	MetadataVersion() MetadataVer
	DeepCopy(kbfscodec.Codec) (ExtraMetadata, error)
	MakeSuccessorCopy(kbfscodec.Codec) (ExtraMetadata, error)
}

// DumpExtraMetadata returns a detailed dump of the given
// ExtraMetadata's contents.
func DumpExtraMetadata(
	codec kbfscodec.Codec, extra ExtraMetadata) (string, error) {
	var s string
	if extra, ok := extra.(*ExtraMetadataV3); ok {
		serializedWKB, err := codec.Encode(extra.GetWriterKeyBundle())
		if err != nil {
			return "", err
		}
		serializedRKB, err := codec.Encode(extra.GetReaderKeyBundle())
		if err != nil {
			return "", err
		}
		s = fmt.Sprintf("WKB size: %d\nRKB size: %d\n",
			len(serializedWKB), len(serializedRKB))
	}

	s += DumpConfig().Sdump(extra)
	return s, nil
}
