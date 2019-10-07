// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libhttpserver

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/keybase/client/go/protocol/keybase1"
)

type contentTypeOverridingResponseWriter struct {
	original           http.ResponseWriter
	viewTypeInvariance string
}

var _ http.ResponseWriter = (*contentTypeOverridingResponseWriter)(nil)

func newContentTypeOverridingResponseWriter(
	original http.ResponseWriter, viewTypeInvariance string) *contentTypeOverridingResponseWriter {
	return &contentTypeOverridingResponseWriter{
		original:           original,
		viewTypeInvariance: viewTypeInvariance,
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

// We need the charset so GUI can display UTF-8 characters properly. Ideally
// we'd guess content encoding based on content, but there might not be an easy
// way to do that as even Go's DetectContentType just uses utf-8 by default.
const textPlainUtf8 = "text/plain; charset=utf-8"

func beforeSemicolon(str string) string {
	semicolonIndex := strings.Index(str, ";")
	if semicolonIndex > 0 {
		str = str[:semicolonIndex]
	}
	return strings.ToLower(strings.TrimSpace(str))
}

var supportedImgMimeTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/gif":  true,
	"image/webp": true,
}

func getGUIFileContext(contentTypeRaw, contentDispositionRaw string) (
	viewType keybase1.GUIViewType, invariance string) {
	contentTypeProcessed := beforeSemicolon(contentTypeRaw)
	disposition := beforeSemicolon(contentDispositionRaw)

	if disposition == "attachment" {
		viewType = keybase1.GUIViewType_DEFAULT
		return viewType, strconv.Itoa(int(viewType))
	}

	switch {
	case strings.HasPrefix(contentTypeProcessed, "text/"):
		viewType = keybase1.GUIViewType_TEXT
	case supportedImgMimeTypes[contentTypeProcessed]:
		viewType = keybase1.GUIViewType_IMAGE
	case strings.HasPrefix(contentTypeProcessed, "audio/"):
		viewType = keybase1.GUIViewType_AUDIO
	case strings.HasPrefix(contentTypeProcessed, "video/"):
		viewType = keybase1.GUIViewType_VIDEO
	case contentTypeProcessed == "application/pdf":
		viewType = keybase1.GUIViewType_PDF
	default:
		viewType = (keybase1.GUIViewType_DEFAULT)
	}

	return viewType, strconv.Itoa(int(viewType))
}

func getGUIInvarianceFromHTTPHeader(header http.Header) (invariance string) {
	contentTypeRaw := header.Get("Content-Type")
	contentDispositionRaw := (header.Get("Content-Disposition"))
	_, invariance = getGUIFileContext(contentTypeRaw, contentDispositionRaw)
	return invariance
}

// GetGUIFileContextFromContentType returns necessary data used by GUI for
// displaying file previews.
//
// The invariance here is derived from viewType, and later added into the url
// returned to GUI. When a file is requested from the the http server and an
// invariance field is specified, we make sure the viewType of the file we
// serve satisfies the invariance provided. This makes sure the viewType
// doesn't change between when GUI learnt about it and when GUI requested it
// over HTTP from the webview.
func GetGUIFileContextFromContentType(contentTypeRaw string) (
	viewType keybase1.GUIViewType, invariance string) {
	contentTypeProcessed := beforeSemicolon(contentTypeRaw)
	disposition := getDisposition(true, contentTypeProcessed)
	viewType, invariance = getGUIFileContext(contentTypeRaw, disposition)
	return viewType, invariance
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
		return textPlainUtf8, "inline"
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
		return textPlainUtf8, "attachment"
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

func (w *contentTypeOverridingResponseWriter) checkViewTypeInvariance() error {
	if len(w.viewTypeInvariance) == 0 {
		return nil
	}
	if i := getGUIInvarianceFromHTTPHeader(w.original.Header()); i == w.viewTypeInvariance {
		return nil
	}
	w.original.WriteHeader(http.StatusPreconditionFailed)
	return errors.New("viewTypeInvariance doesn't match")
}

func (w *contentTypeOverridingResponseWriter) Header() http.Header {
	return w.original.Header()
}

func (w *contentTypeOverridingResponseWriter) WriteHeader(statusCode int) {
	w.override()
	if statusCode == http.StatusOK {
		if err := w.checkViewTypeInvariance(); err != nil {
			return
		}
	}
	w.original.WriteHeader(statusCode)
}

func (w *contentTypeOverridingResponseWriter) Write(data []byte) (int, error) {
	w.override()
	if err := w.checkViewTypeInvariance(); err != nil {
		return 0, err
	}
	return w.original.Write(data)
}

var additionalMimeTypes = map[string]string{
	".go":    textPlainUtf8,
	".py":    textPlainUtf8,
	".zsh":   textPlainUtf8,
	".fish":  textPlainUtf8,
	".cs":    textPlainUtf8,
	".rb":    textPlainUtf8,
	".m":     textPlainUtf8,
	".mm":    textPlainUtf8,
	".swift": textPlainUtf8,
	".flow":  textPlainUtf8,
	".php":   textPlainUtf8,
	".pl":    textPlainUtf8,
	".pm":    textPlainUtf8,
	".sh":    textPlainUtf8,
	".json":  textPlainUtf8,
	".js":    textPlainUtf8,
	".jsx":   textPlainUtf8,
	".ts":    textPlainUtf8,
	".tsx":   textPlainUtf8,
	".sql":   textPlainUtf8,
	".rs":    textPlainUtf8,
	".xml":   textPlainUtf8,
	".tex":   textPlainUtf8,
	".pub":   textPlainUtf8,
	".atom":  textPlainUtf8,
	".xhtml": textPlainUtf8,
	".rss":   textPlainUtf8,
	".tcl":   textPlainUtf8,
	".tk":    textPlainUtf8,
}
