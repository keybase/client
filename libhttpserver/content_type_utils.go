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

func (w *contentTypeOverridingResponseWriter) calculateOverride(
	mimeType string) (newMimeType, disposition string) {
	// Send text/plain for all HTML and JS files to avoid them being executed
	// by the frontend WebView.
	ty := strings.ToLower(mimeType)
	switch {
	// First anything textual as text/plain.
	// Includes javascript, html, xml. (note that the type may be e.g. application/xhtml+xml)
	case strings.Contains(ty, "javascript") ||
		strings.Contains(ty, "xml") ||
		strings.Contains(ty, "html") ||
		strings.HasPrefix(ty, "text/"):
		return "text/plain", "inline"
	// Pass multimedia types through, and pdf too.
	case strings.HasPrefix(ty, "audio/") ||
		strings.HasPrefix(ty, "image/") ||
		strings.HasPrefix(ty, "video/") ||
		ty == "application/pdf":
		return ty, "inline"
	// Otherwise default to text + attachment.
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
	".sh":    "text/plain",
	".js":    "text/plain",
	".json":  "text/plain",
	".sql":   "text/plain",
	".rs":    "text/plain",
	".xml":   "text/plain",
	".tex":   "text/plain",
	".pub":   "text/plain",
}
