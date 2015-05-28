package libkb

import (
	"encoding/base64"
	"regexp"
	"strings"
)

type Base64Finder struct {
	input        string
	rxx          *regexp.Regexp
	lines        []string
	base64blocks []string
}

func NewBase64Finder(i string) *Base64Finder {
	rxx := regexp.MustCompile(`^\s*(([a-zA-Z0-9/+_-]+)(={0,3}))\s*$`)
	return &Base64Finder{input: i, rxx: rxx}
}

func (s *Base64Finder) split() {
	s.lines = strings.Split(s.input, "\n")
}

func (s *Base64Finder) findAll() {
	i := 0
	for i >= 0 {
		var msg string
		msg, i = s.findOne(i)
		if len(msg) > 0 {
			s.base64blocks = append(s.base64blocks, msg)
		}
	}
}

func (s *Base64Finder) search(searchFor []byte, url bool) bool {

	var encoding *base64.Encoding

	if url {
		encoding = base64.URLEncoding
	} else {
		encoding = base64.StdEncoding
	}

	i := 0
	for i >= 0 {
		var msg string
		msg, i = s.findOne(i)
		if len(msg) > 0 {
			buf, err := encoding.DecodeString(msg)
			if err == nil && FastByteArrayEq(searchFor, buf) {
				return true
			}
		}
	}

	return false
}

func (s *Base64Finder) findOne(i int) (string, int) {

	parts := make([]string, 0, 1)
	l := len(s.lines)
	state := 0

	for ; i < l; i++ {
		line := s.lines[i]
		match := s.rxx.FindStringSubmatch(line)
		if match != nil {
			state = 1
			parts = append(parts, match[1])
			if len(match[3]) > 0 {
				// A terminal "=" character means jump on out
				i++
				break
			}
		} else if state == 1 {
			break
		} else {
			// wait until next time
		}
	}
	if i == l {
		i = -1
	}
	ret := strings.Join(parts, "")
	return ret, i
}

func (s *Base64Finder) Run() []string {
	s.split()
	s.findAll()
	return s.base64blocks
}

func FindBase64Blocks(s string) []string {
	eng := NewBase64Finder(s)
	return eng.Run()
}

func FindFirstBase64Block(s string) string {
	v := FindBase64Blocks(s)
	if v != nil && len(v) > 0 {
		return v[0]
	}
	return ""
}

func FindBase64Snippets(s string) []string {
	return regexp.MustCompile(`(([a-zA-Z0-9/+_-]+)(={0,3}))`).FindAllString(s, -1)
}

func FindBase64Block(s string, pattern []byte, url bool) bool {
	eng := NewBase64Finder(s)
	eng.split()
	return eng.search(pattern, url)
}
