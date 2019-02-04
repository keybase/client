// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libhttpserver

import (
	"net/http"
	"strings"
)

type contentTypeOverridingResponseWriter struct {
	original http.ResponseWriter
}

var _ http.ResponseWriter = (*contentTypeOverridingResponseWriter)(nil)

func newContentTypeOverridingResponseWriter(
	original http.ResponseWriter) *contentTypeOverridingResponseWriter {
	return &contentTypeOverridingResponseWriter{
		original: original,
	}
}

// supportedContentTypes has exceptions to the libmime stuff because some types
// need special handling or are unsupported by frontend. The boolean value
// decides on whether this will be shown inline or as an attachment.
// We don't want to render SVG unless that has been audited, even if
// the file lacks a .svg extension.
var supportedContentTypes = map[string]bool{
	// Media
	"image/tiff":         false,
	"image/x-jng":        false,
	"image/vnd.wap.wbmp": false,
	"image/svg+xml":      false,
}

// getDisposition decides on the Content-Disposition value (inline vs attachment) for
// the given mimeType by consulting the supportedContentTypes map and using the defaultValue
// parameter.
func getDisposition(defaultInlineValue bool, mimeType string) string {
	res, found := supportedContentTypes[mimeType]
	if (found && res) || (!found && defaultInlineValue) {
		return "inline"
	}
	return "attachment"
}

func (w *contentTypeOverridingResponseWriter) calculateOverride(
	mimeType string) (newMimeType, disposition string) {
	// Send text/plain for all HTML and JS files to avoid them being executed
	// by the frontend WebView.
	ty := strings.ToLower(mimeType)
	switch {
	// First anything textual as text/plain.
	// Javascript is set to plain text by additionalMimeTypes map.
	// If text/something-dangerous would get here, we set it to plaintext.
	// If application/javascript somehow gets here it would be handled safely
	// by the default handler below.
	case strings.HasPrefix(ty, "text/"):
		return "text/plain", "inline"
	// Pass multimedia types through, and pdf too.
	// Some types get special handling here and are not shown inline (e.g. SVG).
	case strings.HasPrefix(ty, "audio/") ||
		strings.HasPrefix(ty, "image/") ||
		strings.HasPrefix(ty, "video/") ||
		ty == "application/pdf":
		return ty, getDisposition(true, ty)
	// Otherwise default to text + attachment.
	// This is safe for all files.
	default:
		return "text/plain", "attachment"
	}
}

func (w *contentTypeOverridingResponseWriter) override() {
	t := w.original.Header().Get("Content-Type")
	if len(t) > 0 {
		ct, disp := w.calculateOverride(t)
		w.original.Header().Set("Content-Type", ct)
		w.original.Header().Set("Content-Disposition", disp)
	}
	w.original.Header().Set("X-Content-Type-Options", "nosniff")
}

func (w *contentTypeOverridingResponseWriter) Header() http.Header {
	return w.original.Header()
}

func (w *contentTypeOverridingResponseWriter) WriteHeader(statusCode int) {
	w.override()
	w.original.WriteHeader(statusCode)
}

func (w *contentTypeOverridingResponseWriter) Write(data []byte) (int, error) {
	w.override()
	return w.original.Write(data)
}

var additionalMimeTypes = map[string]string{
	".go":    "text/plain",
	".py":    "text/plain",
	".zsh":   "text/plain",
	".fish":  "text/plain",
	".cs":    "text/plain",
	".rb":    "text/plain",
	".m":     "text/plain",
	".mm":    "text/plain",
	".swift": "text/plain",
	".flow":  "text/plain",
	".php":   "text/plain",
	".pl":    "text/plain",
	".pm":    "text/plain",
	".sh":    "text/plain",
	".js":    "text/plain",
	".json":  "text/plain",
	".sql":   "text/plain",
	".rs":    "text/plain",
	".xml":   "text/plain",
	".tex":   "text/plain",
	".pub":   "text/plain",
	".atom":  "text/plain",
	".xhtml": "text/plain",
	".rss":   "text/plain",
	".tcl":   "text/plain",
	".tk":    "text/plain",
}
