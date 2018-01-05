package libpages

import "net/http"

var _ http.ResponseWriter = responseWriterWrapper{}

type writeOverride interface {
	Bytes(req *http.Request) []byte
}

// responseWriterWrapper wraps a http.ResponseWriter, allowing overriding
// response for selected status codes. This is mainly for custom error pages.
//
// This type is not goroutine safe.
type responseWriterWrapper struct {
	w              http.ResponseWriter
	writeOverrides map[int]writeOverride
	request        *http.Request

	writtenCode int
}

// Header implements the http.ResponseWriter interface.
func (w responseWriterWrapper) Header() http.Header {
	return w.w.Header()
}

// WriteHeader implements the http.ResponseWriter interface.
func (w responseWriterWrapper) WriteHeader(code int) {
	w.w.WriteHeader(code)
	w.writtenCode = code
}

// Write implements the http.ResponseWriter interface.
func (w responseWriterWrapper) Write(data []byte) (int, error) {
	if w.writeOverrides == nil || w.writtenCode == 0 {
		return w.w.Write(data)
	}
	override := w.writeOverrides[w.writtenCode]
	if override == nil {
		return w.w.Write(data)
	}
	return w.w.Write(override.Bytes(w.request))
}
