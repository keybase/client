package hal

import (
	"encoding/json"
	"net/http"
)

// RenderToString renders the provided data as a json string
func RenderToString(data interface{}, pretty bool) ([]byte, error) {
	if pretty {
		return json.MarshalIndent(data, "", "  ")
	}

	return json.Marshal(data)
}

// Render write data to w, after marshalling to json
func Render(w http.ResponseWriter, data interface{}) {
	js, err := RenderToString(data, true)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Content-Type", "application/hal+json; charset=utf-8")
	w.Write(js)
}
