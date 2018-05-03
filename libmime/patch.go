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
// Provide a non-nil additional map (ext->mimeType) to add additional mime
// types. Provide a non-nil Overrider to override any mime type defined in the
// list. Note that the Overrider can override what's in the additional too.
//
// Overrider is different from additional in the way that, additional provides
// exact ext-mimeType pairs, while overrider allows the user of this function
// to examine ext-mimeTypes flexibly. For example, this allows overrider to
// replace mimeTypes without an exaustive list of all extensions that resolve
// to it. So why is additional useful? Go's mime package loads mime types from
// a few filesystem locations such as /etc/apache2/mime.types. This happens
// inside the mime package and is beyond our control. So having additional here
// allows user to guard against unwanted mime types that may exist in one of
// mime type files.
func Patch(additional map[string]string, override Overrider) {
	if override == nil {
		override = dontOverride
	}
	for ext, mimeType := range mimeTypes {
		mime.AddExtensionType(override(ext, mimeType))
	}
	for ext, mimeType := range additional {
		mime.AddExtensionType(override(ext, mimeType))
	}
}
