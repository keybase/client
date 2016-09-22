// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/keybase/client/go/protocol/keybase1"
)

func parse(in string) (pvlT, error) {
	b := []byte(in)
	p := pvlT{}
	p.PvlVersion = -1
	p.Revision = -1
	err := json.Unmarshal(b, &p)
	if p.PvlVersion == -1 {
		return p, fmt.Errorf("pvl_version required")
	}
	if p.Revision == -1 {
		return p, fmt.Errorf("revision required")
	}
	return p, err
}

type pvlT struct {
	PvlVersion int `json:"pvl_version"`
	Revision   int `json:"revision"`
	// services is a map from service to a list of scripts.
	// each script is a list of instructions.
	Services servicesT `json:"services"`
}

type servicesT struct {
	Map map[keybase1.ProofType][]scriptT
}

func (x *servicesT) UnmarshalJSON(b []byte) error {
	// read as string map
	m := make(map[string][]scriptT)
	err := json.Unmarshal(b, &m)
	if err != nil {
		return err
	}
	// copy to ProofType map
	x.Map = make(map[keybase1.ProofType][]scriptT)
	for k, v := range m {
		t, ok := keybase1.ProofTypeMap[strings.ToUpper(k)]
		if ok {
			x.Map[t] = v
		}
		// Unrecognized proof types are discarded silently
		// So that old clients don't break if a new service is added
	}
	return nil
}

type scriptT struct {
	Instructions []instructionT
}

func (x *scriptT) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &x.Instructions)
	for _, ins := range x.Instructions {
		if ins.variantsFilled() != 1 {
			return fmt.Errorf("exactly 1 variant must appear in instruction")
		}
	}
	return err
}

type instructionT struct {
	// Exactly one of these shall be non-nil
	// This list is duplicated to:
	// - instructionT.variantsFilled
	// - instructionT.String
	// - stepInstruction
	// This invariant is enforced by scriptT.UnmarshalJSON
	AssertRegexMatch    *assertRegexMatchT    `json:"assert_regex_match,omitempty"`
	AssertFindBase64    *assertFindBase64T    `json:"assert_find_base64,omitempty"`
	WhitespaceNormalize *whitespaceNormalizeT `json:"whitespace_normalize,omitempty"`
	RegexCapture        *regexCaptureT        `json:"regex_capture,omitempty"`
	Fetch               *fetchT               `json:"fetch,omitempty"`
	SelectorJSON        *selectorJSONT        `json:"selector_json,omitempty"`
	SelectorCSS         *selectorCSST         `json:"selector_css,omitempty"`
	TransformURL        *transformURLT        `json:"transform_url,omitempty"`
}

func (ins *instructionT) variantsFilled() int {
	n := 0
	if ins.AssertRegexMatch != nil {
		n++
	}
	if ins.AssertFindBase64 != nil {
		n++
	}
	if ins.WhitespaceNormalize != nil {
		n++
	}
	if ins.RegexCapture != nil {
		n++
	}
	if ins.Fetch != nil {
		n++
	}
	if ins.SelectorJSON != nil {
		n++
	}
	if ins.SelectorCSS != nil {
		n++
	}
	if ins.TransformURL != nil {
		n++
	}
	return n
}

func (ins instructionT) Name() string {
	switch {
	case ins.AssertRegexMatch != nil:
		return string(cmdAssertRegexMatch)
	case ins.AssertFindBase64 != nil:
		return string(cmdAssertFindBase64)
	case ins.WhitespaceNormalize != nil:
		return string(cmdWhitespaceNormalize)
	case ins.RegexCapture != nil:
		return string(cmdRegexCapture)
	case ins.Fetch != nil:
		return string(cmdFetch)
	case ins.SelectorJSON != nil:
		return string(cmdSelectorJSON)
	case ins.SelectorCSS != nil:
		return string(cmdSelectorCSS)
	case ins.TransformURL != nil:
		return string(cmdTransformURL)
	}
	return "<invalid instruction>"
}

func (ins instructionT) String() string {
	var s = ""
	switch {
	case ins.AssertRegexMatch != nil:
		s = fmt.Sprintf("%v", ins.AssertRegexMatch)
	case ins.AssertFindBase64 != nil:
		s = fmt.Sprintf("%v", ins.AssertFindBase64)
	case ins.WhitespaceNormalize != nil:
		s = fmt.Sprintf("%v", ins.WhitespaceNormalize)
	case ins.RegexCapture != nil:
		s = fmt.Sprintf("%v", ins.RegexCapture)
	case ins.Fetch != nil:
		s = fmt.Sprintf("%v", ins.Fetch)
	case ins.SelectorJSON != nil:
		s = fmt.Sprintf("%v", ins.SelectorJSON)
	case ins.SelectorCSS != nil:
		s = fmt.Sprintf("%v", ins.SelectorCSS)
	case ins.TransformURL != nil:
		s = fmt.Sprintf("%v", ins.TransformURL)
	}
	if s != "" {
		return fmt.Sprintf("[ins %v]", s)
	}
	return "[nil instruction]"
}

type assertRegexMatchT struct {
	Pattern         string  `json:"pattern"`
	CaseInsensitive bool    `json:"case_insensitive"`
	MultiLine       bool    `json:"multiline"`
	Error           *errorT `json:"error"`
}

type assertFindBase64T struct {
	Var   string  `json:"var"`
	Error *errorT `json:"error"`
}

type whitespaceNormalizeT struct {
	Error *errorT `json:"error"`
}

type regexCaptureT struct {
	Pattern         string  `json:"pattern"`
	MultiLine       bool    `json:"multiline"`
	CaseInsensitive bool    `json:"case_insensitive"`
	Error           *errorT `json:"error"`
}

type fetchT struct {
	Kind  string  `json:"kind"`
	Error *errorT `json:"error"`
}

type selectorJSONT struct {
	Selectors []interface{} `json:"selectors"`
	Error     *errorT       `json:"error"`
}

type selectorCSST struct {
	Selectors []interface{} `json:"selectors"`
	Attr      string        `json:"attr"`
	// Whether the final selection can contain multiple elements.
	Multi bool    `json:"multi"`
	Error *errorT `json:"error"`
}

type transformURLT struct {
	Pattern         string  `json:"pattern"`
	MultiLine       bool    `json:"multiline"`
	CaseInsensitive bool    `json:"case_insensitive"`
	ToPattern       string  `json:"to_pattern"`
	Error           *errorT `json:"error"`
}

type errorT struct {
	Status      keybase1.ProofStatus
	Description string
}

func (x *errorT) UnmarshalJSON(b []byte) error {
	ss := []string{}
	err := json.Unmarshal(b, &ss)
	if err != nil {
		return err
	}
	if len(ss) != 2 {
		return fmt.Errorf("error desc must be of length 2")
	}
	status, ok := keybase1.ProofStatusMap[ss[0]]
	if !ok {
		return fmt.Errorf("unrecognized proof status '%v'", ss[0])
	}
	x.Status = status
	x.Description = ss[1]
	return nil
}
