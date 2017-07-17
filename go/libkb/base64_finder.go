// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/base64"
	"regexp"
	"strings"
)

type Base64Finder struct {
	input        string
	lines        []string
	base64blocks []string
}

var b64FindRE = regexp.MustCompile(`^\s*(([a-zA-Z0-9/+_-]+)(={0,3}))\s*$`)

func NewBase64Finder(i string) *Base64Finder {
	return &Base64Finder{input: i}
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
	var parts []string
	l := len(s.lines)
	state := 0

	for ; i < l; i++ {
		line := s.lines[i]
		match := b64FindRE.FindStringSubmatch(line)
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
	if len(v) > 0 {
		return v[0]
	}
	return ""
}

var snipRE = regexp.MustCompile(`(([a-zA-Z0-9/+_-]+)(={0,3}))`)

func FindBase64Snippets(s string) []string {
	return snipRE.FindAllString(s, -1)
}

func FindBase64Block(s string, pattern []byte, url bool) bool {
	eng := NewBase64Finder(s)
	eng.split()
	return eng.search(pattern, url)
}
