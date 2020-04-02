package main

import (
	"bytes"
	"flag"
	"fmt"
	"go/format"
	"log"
	"os"
	"text/template"
)

// adapted from https://github.com/kyokomi/emoji/ to only use the emoji-data
// emoji source
var pkgName string
var fileName string

// TemplateData emoji_codemap.go template
type TemplateData struct {
	PkgName    string
	CodeMap    map[string]string
	RevCodeMap map[string][]string
}

const templateMapCode = `
package {{.PkgName}}

// NOTE: THIS FILE WAS PRODUCED BY THE
// EMOJICODEMAP CODE GENERATION TOOL (github.com/keybase/go/chat/emoji)
// DO NOT EDIT

// Mapping from character to concrete escape code.
var emojiCodeMap = map[string]string{
	{{range $key, $val := .CodeMap}}":{{$key}}:": {{$val}},
{{end}}
}

var emojiRevCodeMap = map[string][]string{
	{{range $key, $val := .RevCodeMap}} {{$key}}: { {{range $val}} ":{{.}}:", {{end}} },
{{end}}
}
`

func createCodeMapSource(pkgName string, emojiCodeMap map[string]string, emojiRevCodeMap map[string][]string) ([]byte, error) {
	// Template GenerateSource

	var buf bytes.Buffer
	t := template.Must(template.New("template").Parse(templateMapCode))
	if err := t.Execute(&buf, TemplateData{PkgName: pkgName, CodeMap: emojiCodeMap, RevCodeMap: emojiRevCodeMap}); err != nil {
		return nil, err
	}

	// gofmt

	bts, err := format.Source(buf.Bytes())
	if err != nil {
		fmt.Print(buf.String())
		return nil, fmt.Errorf("gofmt: %s", err)
	}

	return bts, nil
}

func main() {
	flag.StringVar(&pkgName, "pkg", "storage", "output package")
	flag.StringVar(&fileName, "o", "../storage/emoji_codemap.go", "output file")
	flag.Parse()
	codeMap, revCodeMap, err := createEmojiDataCodeMap()
	if err != nil {
		log.Fatalln(err)
	}

	codeMapSource, err := createCodeMapSource(pkgName, codeMap, revCodeMap)
	if err != nil {
		log.Fatalln(err)
	}

	os.Remove(fileName)
	file, err := os.Create(fileName)
	if err != nil {
		log.Fatalln(err)
	}
	defer file.Close()

	if _, err := file.Write(codeMapSource); err != nil {
		log.Fatalln(err)
	}
}
