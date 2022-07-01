// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

// SplitFileExtension splits filename into a base name and the extension.
func SplitFileExtension(path string) (string, string) {
	for i := len(path) - 1; i > 0; i-- {
		switch path[i] {
		case '.':
			// Handle some multipart extensions
			if i >= 4 && path[i-4:i] == ".tar" {
				i -= 4
			}
			// A leading dot is not an extension
			if i == 0 || path[i-1] == '/' || path[i-1] == '\\' {
				return path, ""
			}
			return path[:i], path[i:]
		case '/', '\\', ' ':
			return path, ""
		}
	}
	return path, ""
}
