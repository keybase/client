// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libmime

import "mime"

// Patch patches the mime types Go uses by calling mime.AddExtensionType on
// each from a builtin list in this package.  Optionally, provide a non-nil
// additional map (ext->mimeType) to add additional mime types. The additional
// mime types are added after the builtin ones, and both builtin ones and the
// additional ones are added after the `mime` package loads from a few
// filesystem locations such as /etc/apache2/mime.types. In other words, the
// overriding precedence is:
//     filesystem -> builtin in this package -> optional additional parameter
// where the ones on right side can override what's from ones on the left side.
//
// Note that due to unpredictibility of what's on the device's file system,
// merely using this function may not be enough if you want to override a
// particular mime type (e.g. text/javascript). To do so you should check the
// determined mime type at a later time, e.g. before writing the HTTP response.
func Patch(additional map[string]string) {
	for ext, mimeType := range mimeTypes {
		_ = mime.AddExtensionType(ext, mimeType)
	}
	for ext, mimeType := range additional {
		_ = mime.AddExtensionType(ext, mimeType)
	}
}
