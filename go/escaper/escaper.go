package escaper

import (
	"fmt"
	"io"
	"strings"
)

// Substitutes all characters with their representation, except for newlines \n.
func Clean(str string) string {
	strs := strings.Split(str, "\n")

	var buf strings.Builder

	for i, str := range strs {
		s := fmt.Sprintf("%q", str)
		buf.Write([]byte(s[1 : len(s)-1]))
		if i < len(strs)-1 {
			buf.Write([]byte("\n"))
		}
	}

	return buf.String()
}

func CleanBytes(p []byte) []byte {
	return []byte(Clean(string(p)))
}

type Writer struct {
	io.Writer
}

func (w Writer) Write(p []byte) (int, error) {
	return w.Writer.Write(CleanBytes(p))
}
