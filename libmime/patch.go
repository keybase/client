// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libmime

import "mime"

// Overrider defines a type that overrides a <ext, mimeType> mapping.
type Overrider func(ext string, mimeType string) (newExt string, newMimeType string)

func dontOverride(ext string, mimeType string) (newExt string, newMimeType string) {
	return ext, mimeType
}

// Patch patches the mime types Go uses by calling mime.AddExtensionType on
// each from a private list in this package.  Both parameters are optional.
// Provide a non-nil Overrider to override any mime type defined in the list.
// Provide a non-nil additional map (ext->mimeType) to add additional mime
// types.
func Patch(override Overrider, additional map[string]string) {
	if override == nil {
		override = dontOverride
	}
	for ext, mimeType := range mimeTypes {
		mime.AddExtensionType(override(ext, mimeType))
	}
	if additional != nil {
		for ext, mimeType := range additional {
			mime.AddExtensionType(override(ext, mimeType))
		}
	}
}
