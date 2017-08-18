// Copyright 2017 Keybase. Inc. All rights reserved. Use of
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
	if err != nil {
		return p, err
	}

	if p.PvlVersion == -1 {
		return p, fmt.Errorf("pvl_version required")
	}
	if p.Revision == -1 {
		return p, fmt.Errorf("revision required")
	}
	return p, nil
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
	for i, ins := range x.Instructions {
		n := ins.variantsFilled()
		if n != 1 {
			if i == 0 {
				return fmt.Errorf("%v != 1 variants appeared in instruction %v", n, i)
			}
			return fmt.Errorf("%v != 1 variants appeared in instruction %v; previous: %v", n, i, x.Instructions[i-1])
		}
	}
	return err
}

type instructionT struct {
	// Exactly one of these shall be non-nil
	// This list is duplicated to:
	// - instructionT.variantsFilled
	// - instructionT.Name
	// - stepInstruction
	// - validateScript
	// This invariant is enforced by scriptT.UnmarshalJSON
	AssertRegexMatch    *assertRegexMatchT    `json:"assert_regex_match,omitempty"`
	AssertFindBase64    *assertFindBase64T    `json:"assert_find_base64,omitempty"`
	AssertCompare       *assertCompareT       `json:"assert_compare,omitempty"`
	WhitespaceNormalize *whitespaceNormalizeT `json:"whitespace_normalize,omitempty"`
	RegexCapture        *regexCaptureT        `json:"regex_capture,omitempty"`
	ReplaceAll          *replaceAllT          `json:"replace_all,omitempty"`
	ParseURL            *parseURLT            `json:"parse_url,omitempty"`
	Fetch               *fetchT               `json:"fetch,omitempty"`
	ParseHTML           *parseHTMLT           `json:"parse_html,omitempty"`
	SelectorJSON        *selectorJSONT        `json:"selector_json,omitempty"`
	SelectorCSS         *selectorCSST         `json:"selector_css,omitempty"`
	Fill                *fillT                `json:"fill,omitempty"`
}

func (ins *instructionT) variantsFilled() int {
	n := 0
	if ins.AssertRegexMatch != nil {
		n++
	}
	if ins.AssertFindBase64 != nil {
		n++
	}
	if ins.AssertCompare != nil {
		n++
	}
	if ins.WhitespaceNormalize != nil {
		n++
	}
	if ins.RegexCapture != nil {
		n++
	}
	if ins.ReplaceAll != nil {
		n++
	}
	if ins.ParseURL != nil {
		n++
	}
	if ins.Fetch != nil {
		n++
	}
	if ins.ParseHTML != nil {
		n++
	}
	if ins.SelectorJSON != nil {
		n++
	}
	if ins.SelectorCSS != nil {
		n++
	}
	if ins.Fill != nil {
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
	case ins.AssertCompare != nil:
		return string(cmdAssertCompare)
	case ins.WhitespaceNormalize != nil:
		return string(cmdWhitespaceNormalize)
	case ins.RegexCapture != nil:
		return string(cmdRegexCapture)
	case ins.ReplaceAll != nil:
		return string(cmdReplaceAll)
	case ins.ParseURL != nil:
		return string(cmdParseURL)
	case ins.Fetch != nil:
		return string(cmdFetch)
	case ins.ParseHTML != nil:
		return string(cmdParseHTML)
	case ins.SelectorJSON != nil:
		return string(cmdSelectorJSON)
	case ins.SelectorCSS != nil:
		return string(cmdSelectorCSS)
	case ins.Fill != nil:
		return string(cmdFill)
	}
	return "<invalid instruction>"
}

func (ins instructionT) String() string {
	return fmt.Sprintf("[ins %v]", ins.Name())
}

type assertRegexMatchT struct {
	Pattern         string  `json:"pattern"`
	CaseInsensitive bool    `json:"case_insensitive"`
	MultiLine       bool    `json:"multiline"`
	From            string  `json:"from"`
	Negate          bool    `json:"negate"`
	Error           *errorT `json:"error"`
}

type assertFindBase64T struct {
	Needle   string  `json:"needle"`
	Haystack string  `json:"haystack"`
	Error    *errorT `json:"error"`
}

type assertCompareT struct {
	// Comparison strategy
	Cmp   string  `json:"cmp"`
	A     string  `json:"a"`
	B     string  `json:"b"`
	Error *errorT `json:"error"`
}

type whitespaceNormalizeT struct {
	From  string  `json:"from"`
	Into  string  `json:"into"`
	Error *errorT `json:"error"`
}

type regexCaptureT struct {
	Pattern         string   `json:"pattern"`
	MultiLine       bool     `json:"multiline"`
	CaseInsensitive bool     `json:"case_insensitive"`
	From            string   `json:"from"`
	Into            []string `json:"into"`
	Error           *errorT  `json:"error"`
}

type replaceAllT struct {
	Old   string  `json:"old"`
	New   string  `json:"new"`
	From  string  `json:"from"`
	Into  string  `json:"into"`
	Error *errorT `json:"error"`
}

type parseURLT struct {
	From   string  `json:"from"`
	Path   string  `json:"path"`
	Host   string  `json:"host"`
	Scheme string  `json:"scheme"`
	Error  *errorT `json:"error"`
}

type fetchT struct {
	Kind string `json:"kind"`
	From string `json:"from"`
	// Value is "" when not fetching a string
	Into  string  `json:"into"`
	Error *errorT `json:"error"`
}

type parseHTMLT struct {
	From  string  `json:"from"`
	Error *errorT `json:"error"`
}

type selectorJSONT struct {
	Selectors []selectorEntryT `json:"selectors"`
	Into      string           `json:"into"`
	Error     *errorT          `json:"error"`
}

type selectorCSST struct {
	Selectors []selectorEntryT `json:"selectors"`
	Attr      string           `json:"attr"`
	Data      bool             `json:"data"`
	// Whether the final selection can contain multiple elements.
	Multi bool    `json:"multi"`
	Into  string  `json:"into"`
	Error *errorT `json:"error"`
}

type fillT struct {
	With  string  `json:"with"`
	Into  string  `json:"into"`
	Error *errorT `json:"error"`
}

type errorT struct {
	Status      keybase1.ProofStatus
	Description string
}

func (e *errorT) UnmarshalJSON(b []byte) error {
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
	e.Status = status
	e.Description = ss[1]
	return nil
}

type selectorEntryT struct {
	// Exactly one of Is* is true
	IsIndex    bool
	Index      int
	IsKey      bool
	Key        string
	IsAll      bool
	IsContents bool
}

func (se *selectorEntryT) UnmarshalJSON(b []byte) error {
	err := json.Unmarshal(b, &se.Index)
	if err == nil {
		se.IsIndex = true
		return nil
	}

	err = json.Unmarshal(b, &se.Key)
	if err == nil {
		se.IsKey = true
		return nil
	}

	m := make(map[string]bool)
	err = json.Unmarshal(b, &m)
	if err != nil {
		return fmt.Errorf("invalid selector (not dict)")
	}
	ok1, ok2 := m["all"]
	if ok1 && ok2 {
		se.IsAll = true
		return nil
	}
	ok1, ok2 = m["contents"]
	if ok1 && ok2 {
		se.IsContents = true
		return nil
	}
	return fmt.Errorf("invalid selector (not recognized)")
}
