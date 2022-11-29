package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"go/format"
	"log"
	"os"
	"sort"
	"strconv"
	"strings"
	"text/template"
)

// EmojiData json parse struct
type EmojiData struct {
	Unified     string `json:"unified"`
	ShortName   string `json:"short_name"`
	ObsoletedBy string `json:"obsoleted_by"`
}

// UnifiedToChar renders a character from its hexadecimal codepoint
func UnifiedToChar(unified string) (string, error) {
	codes := strings.Split(unified, "-")
	var sb strings.Builder
	for _, code := range codes {
		s, err := strconv.ParseInt(code, 16, 32)
		if err != nil {
			return "", err
		}
		sb.WriteRune(rune(s))
	}
	return sb.String(), nil
}

func createEmojiDataCodeMap(path string) (map[string]string, map[string][]string, error) {
	emojiFile, err := os.ReadFile(path)
	if err != nil {
		return nil, nil, err
	}

	var data []EmojiData
	if err := json.Unmarshal(emojiFile, &data); err != nil {
		return nil, nil, err
	}

	// emojiRevCodeMap maps unicode characters to lists of short codes.

	emojiCodeMap := make(map[string]string)
	emojiRevCodeMap := make(map[string][]string)
	for _, emoji := range data {
		if len(emoji.ShortName) == 0 || len(emoji.Unified) == 0 {
			continue
		}
		unified := emoji.Unified
		if len(emoji.ObsoletedBy) > 0 {
			unified = emoji.ObsoletedBy
		}
		unicode, err := UnifiedToChar(unified)
		if err != nil {
			return nil, nil, err
		}
		unicode = fmt.Sprintf("%+q", strings.ToLower(unicode))
		emojiCodeMap[emoji.ShortName] = unicode
		emojiRevCodeMap[unicode] = append(emojiRevCodeMap[unicode], emoji.ShortName)
	}

	// ensure deterministic ordering for aliases
	for _, value := range emojiRevCodeMap {
		sort.Slice(value, func(i, j int) bool {
			if len(value[i]) == len(value[j]) {
				return value[i] < value[j]
			}
			return len(value[i]) < len(value[j])
		})
	}

	return emojiCodeMap, emojiRevCodeMap, nil
}

// adapted from https://github.com/kyokomi/emoji/ to only use the emoji-data
// emoji source
var pkgName, inName, outName string

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
	flag.StringVar(&outName, "o", "../storage/emoji_codemap.go", "output file")
	flag.StringVar(&inName, "i", "../../../shared/node_modules/emoji-datasource-apple/emoji.json", "input file")
	flag.Parse()
	codeMap, revCodeMap, err := createEmojiDataCodeMap(inName)
	if err != nil {
		log.Fatalln(err)
	}

	codeMapSource, err := createCodeMapSource(pkgName, codeMap, revCodeMap)
	if err != nil {
		log.Fatalln(err)
	}

	os.Remove(outName)
	file, err := os.Create(outName)
	if err != nil {
		log.Fatalln(err)
	}
	defer file.Close()

	if _, err := file.Write(codeMapSource); err != nil {
		log.Println(err)
		return
	}
}
