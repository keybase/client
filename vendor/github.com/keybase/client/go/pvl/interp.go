// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"net"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// UsePvl says whether to use PVL for verifying proofs.
const UsePvl = false

// SupportedVersion is which version of PVL is supported by this client.
const SupportedVersion int = 1

type ScriptState struct {
	WhichScript  int
	PC           int
	Service      keybase1.ProofType
	Vars         ScriptVariables
	ActiveString string
	FetchURL     string
	HasFetched   bool
	// nil until fetched
	FetchResult *FetchResult
}

type ScriptVariables struct {
	UsernameService string
	UsernameKeybase string
	Sig             []byte
	SigIDMedium     string
	SigIDShort      string
	Hostname        string
}

type FetchResult struct {
	Mode Mode
	// One of these 3 must be filled.
	String string
	HTML   *goquery.Document
	JSON   *jsonw.Wrapper
}

type Mode string

const (
	ModeJSON   Mode = "json"
	ModeHTML   Mode = "html"
	ModeString Mode = "string"
	ModeDNS    Mode = "dns"
)

type CommandName string

const (
	CmdAssertRegexMatch    CommandName = "assert_regex_match"
	CmdAssertFindBase64    CommandName = "assert_find_base64"
	CmdWhitespaceNormalize CommandName = "whitespace_normalize"
	CmdRegexCapture        CommandName = "regex_capture"
	CmdFetch               CommandName = "fetch"
	CmdSelectorJSON        CommandName = "selector_json"
	CmdSelectorCSS         CommandName = "selector_css"
	CmdTransformURL        CommandName = "transform_url"
)

type Step func(ProofContextExt, *jsonw.Wrapper, ScriptState) (ScriptState, libkb.ProofError)

var Steps = map[CommandName]Step{
	CmdAssertRegexMatch:    stepAssertRegexMatch,
	CmdAssertFindBase64:    stepAssertFindBase64,
	CmdWhitespaceNormalize: stepWhitespaceNormalize,
	CmdRegexCapture:        stepRegexCapture,
	CmdFetch:               stepFetch,
	CmdSelectorJSON:        stepSelectorJSON,
	CmdSelectorCSS:         stepSelectorCSS,
	CmdTransformURL:        stepTransformURL,
}

// Checkproof verifies one proof by running the pvl on the provided proof information.
func CheckProof(g1 libkb.ProofContext, pvl *jsonw.Wrapper, service keybase1.ProofType, link libkb.RemoteProofChainLink, h libkb.SigHint) libkb.ProofError {
	g := NewProofContextExt(g1)
	perr := checkProofInner(g, pvl, service, link, h)
	if perr != nil {
		debug(g, "CheckProof failed: %v", perr)
	}
	return perr
}

func checkProofInner(g ProofContextExt, pvl *jsonw.Wrapper, service keybase1.ProofType, link libkb.RemoteProofChainLink, h libkb.SigHint) libkb.ProofError {
	if perr := validateChunk(g, pvl, service); perr != nil {
		return perr
	}

	sigBody, sigID, err := libkb.OpenSig(link.GetArmoredSig())
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %v", err)
	}

	scripts, perr := chunkGetScripts(pvl, service)
	if perr != nil {
		return perr
	}

	newstate := func(i int) ScriptState {
		vars := ScriptVariables{
			UsernameService: link.GetRemoteUsername(), // Blank for DNS-proofs
			UsernameKeybase: link.GetUsername(),
			Sig:             sigBody,
			SigIDMedium:     sigID.ToMediumID(),
			SigIDShort:      sigID.ToShortID(),
			Hostname:        link.GetHostname(), // Blank for non-{DNS/Web} proofs
		}

		// Enforce prooftype-dependent variables.
		webish := (service == keybase1.ProofType_DNS || service == keybase1.ProofType_GENERIC_WEB_SITE)
		if webish {
			vars.UsernameService = ""
		} else {
			vars.Hostname = ""
		}

		state := ScriptState{
			WhichScript:  i,
			PC:           0,
			Service:      service,
			Vars:         vars,
			ActiveString: h.GetAPIURL(),
			FetchURL:     h.GetAPIURL(),
			HasFetched:   false,
			FetchResult:  nil,
		}
		return state
	}

	var errs []libkb.ProofError
	if service == keybase1.ProofType_DNS {
		errs = runDNS(g, scripts, newstate(0))
	} else {
		// Run the scripts in order.
		// If any succeed, the proof succeeds.
		// If one fails, the next takes over.
		// If all fail, log and report errors.
		for i, script := range scripts {
			perr = runScript(g, script, newstate(i))
			if perr == nil {
				return nil
			}
			errs = append(errs, perr)
		}
	}

	if len(errs) == 0 {
		return nil
	} else if len(errs) == 1 {
		return errs[0]
	} else {
		for _, err := range errs {
			debug(g, "multiple failures include: %v", err)
		}
		// Arbitrarily use the error code of the first error
		return libkb.NewProofError(errs[0].GetProofStatus(), "Multiple errors while verifying proof")
	}
}

// Get the list of scripts for a given service.
func chunkGetScripts(pvl *jsonw.Wrapper, service keybase1.ProofType) ([]*jsonw.Wrapper, libkb.ProofError) {
	serviceString, perr := serviceToString(service)
	if perr != nil {
		return nil, perr
	}
	scriptsw, err := pvl.AtKey("services").AtKey(serviceString).ToArray()
	if err != nil {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"PVL script is not an array: %v", err)
	}

	// Check if pvl[services][service][0] is an array. If it is, this an OR of multiple scripts.
	_, err = scriptsw.AtIndex(0).ToArray()
	multiscript := err == nil
	var scripts []*jsonw.Wrapper
	if multiscript {
		scripts, err = jsonUnpackArray(scriptsw)
		if err != nil {
			return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
				"Could not unpack PVL multiscript: %v", err)
		}
	} else {
		scripts = []*jsonw.Wrapper{scriptsw}
	}
	if len(scripts) < 1 {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Empty script list")
	}
	return scripts, nil
}

// Check that a chunk of PVL is valid code.
// Will always accept valid code, but may not always notice invalidities.
func validateChunk(g ProofContextExt, pvl *jsonw.Wrapper, service keybase1.ProofType) libkb.ProofError {
	// Check the version.
	version, err := pvl.AtKey("pvl_version").GetInt()
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"missing version number: %v", err)
	}
	if version != SupportedVersion {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"PVL is for the wrong version %v != %v", version, SupportedVersion)
	}

	// Check that revision is there.
	revision, err := pvl.AtKey("revision").GetInt()
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"PVL missing reversion number: %v", err)
	}

	debug(g, "valid version:%v revision:%v", version, revision)

	scripts, perr := chunkGetScripts(pvl, service)
	if perr != nil {
		return perr
	}

	// Scan all the scripts (for this service) for errors. Report the first error.
	var errs []libkb.ProofError
	for whichscript, script := range scripts {
		perr = validateScript(g, script, service, whichscript)
		errs = append(errs, perr)
	}
	return errs[0]
}

func validateScript(g ProofContextExt, script *jsonw.Wrapper, service keybase1.ProofType, whichscript int) libkb.ProofError {
	// Scan the script.
	// Does not validate each instruction's format. (That is done when running it)

	logerr := func(g ProofContextExt, service keybase1.ProofType, whichscript int, pc int, format string, arg ...interface{}) libkb.ProofError {
		debugWithPosition(g, service, whichscript, pc, format, arg...)
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, format, arg...)
	}

	var modeknown = false
	var mode Mode
	if service == keybase1.ProofType_DNS {
		modeknown = true
		mode = ModeDNS
	}
	scriptlen, err := script.Len()
	if err != nil {
		return logerr(g, service, whichscript, 0, "Could not get length of script: %v", err)
	}
	if scriptlen < 1 {
		return logerr(g, service, whichscript, 0, "Empty script")
	}

	for i := 0; i < scriptlen; i++ {
		ins := script.AtIndex(i)
		switch {

		// These can always run, but must be cases so that the default case works.
		case jsonHasKeyCommand(ins, CmdAssertRegexMatch):
		case jsonHasKeyCommand(ins, CmdAssertFindBase64):
		case jsonHasKeyCommand(ins, CmdWhitespaceNormalize):
		case jsonHasKeyCommand(ins, CmdRegexCapture):

		case jsonHasKeyCommand(ins, CmdFetch):
			// A script can contain only <=1 fetches.
			// A DNS script cannot contain fetches.

			fetchType, err := ins.AtKey(string(CmdFetch)).GetString()
			if err != nil {
				return logerr(g, service, whichscript, i,
					"Could not get fetch type")
			}

			if service == keybase1.ProofType_DNS {
				return logerr(g, service, whichscript, i,
					"DNS script cannot contain fetch instruction")
			}
			if modeknown {
				return logerr(g, service, whichscript, i,
					"Script cannot contain multiple fetch instructions")
			}
			switch Mode(fetchType) {
			case ModeString:
				modeknown = true
				mode = ModeString
			case ModeHTML:
				modeknown = true
				mode = ModeHTML
			case ModeJSON:
				modeknown = true
				mode = ModeJSON
			default:
				return logerr(g, service, whichscript, i,
					"Unsupported fetch type: %v", fetchType)
			}
		case jsonHasKeyCommand(ins, CmdSelectorJSON):
			// Can only select after fetching.
			switch {
			case service == keybase1.ProofType_DNS:
				return logerr(g, service, whichscript, i,
					"DNS script cannot use json selector")
			case !modeknown:
				return logerr(g, service, whichscript, i,
					"Script cannot select before fetch")
			case mode != ModeJSON:
				return logerr(g, service, whichscript, i,
					"Script contains json selector in non-html mode")
			}
		case jsonHasKeyCommand(ins, CmdSelectorCSS):
			// Can only select after fetching.
			switch {
			case service == keybase1.ProofType_DNS:
				return logerr(g, service, whichscript, i,
					"DNS script cannot use css selector")
			case !modeknown:
				return logerr(g, service, whichscript, i,
					"Script cannot select before fetch")
			case mode != ModeHTML:
				return logerr(g, service, whichscript, i,
					"Script contains css selector in non-html mode")
			}
		case jsonHasKeyCommand(ins, CmdTransformURL):
			// Can only transform before fetching.
			switch {
			case service == keybase1.ProofType_DNS:
				return logerr(g, service, whichscript, i,
					"DNS script cannot transform url")
			case modeknown:
				return logerr(g, service, whichscript, i,
					"Script cannot transform after fetch")
			}
		default:
			return logerr(g, service, whichscript, i,
				"Unsupported PVL instruction")
		}
	}

	return nil
}

// Run each script on each TXT record of each domain.
// Succeed if any succeed.
func runDNS(g ProofContextExt, scripts []*jsonw.Wrapper, startstate ScriptState) []libkb.ProofError {
	userdomain := startstate.Vars.Hostname
	domains := []string{userdomain, "_keybase." + userdomain}
	var errs []libkb.ProofError
	for _, d := range domains {
		debugWithState(g, startstate, "Trying DNS: %v", d)

		err := runDNSOne(g, scripts, startstate, d)
		if err != nil {
			errs = append(errs, err)
		} else {
			return nil
		}
	}

	return errs
}

// Run each script on each TXT record of the domain.
func runDNSOne(g ProofContextExt, scripts []*jsonw.Wrapper, startstate ScriptState, domain string) libkb.ProofError {
	txts, err := net.LookupTXT(domain)
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_DNS_ERROR,
			"DNS failure for %s: %s", domain, err)
	}

	for _, record := range txts {
		debugWithState(g, startstate, "For %s, got TXT record: %s", domain, record)

		// Try all scripts.
		for i, script := range scripts {
			state := startstate
			state.WhichScript = i
			state.ActiveString = record
			err = runScript(g, script, state)
			if err == nil {
				return nil
			}
			// Discard error, it has already been reported by stepInstruction.
		}
	}

	return libkb.NewProofError(keybase1.ProofStatus_NOT_FOUND,
		"Checked %d TXT entries of %s, but didn't find signature",
		len(txts), domain)
}

func runScript(g ProofContextExt, script *jsonw.Wrapper, startstate ScriptState) libkb.ProofError {
	var state = startstate
	scriptlen, err := script.Len()
	if err != nil {
		perr := libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not get length of script: %v", err)
		debugWithStateError(g, state, perr)
		return perr
	}
	if scriptlen < 1 {
		perr := libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Empty scripts are not allowed.")
		debugWithStateError(g, state, perr)
		return perr
	}
	for i := 0; i < scriptlen; i++ {
		ins := script.AtIndex(i)

		// Sanity check.
		if int(state.PC) != i {
			perr := libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
				"Execution failure, PC mismatch %v %v", state.PC, i)
			debugWithStateError(g, state, perr)
			return perr
		}

		newstate, perr := stepInstruction(g, ins, state)
		if perr != nil {
			return perr
		}
		state = newstate
		state.PC++
	}

	// Script executed successfully with no errors.
	return nil
}

// stepInstruction decides which instruction to run.
func stepInstruction(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState) (ScriptState, libkb.ProofError) {
	var name CommandName
	var step Step
	n := 0

	for iname, istep := range Steps {
		if jsonHasKeyCommand(ins, iname) {
			step = istep
			name = iname
			n++
		}
	}

	if n == 1 {
		debugWithState(g, state, "Running instruction %v: %v", name, ins.MarshalToDebug())
		newstate, err := step(g, ins, state)
		if err != nil {
			debugWithStateError(g, state, err)

			// Replace error with custom error.
			customerr, swap := customError(g, ins, state, err)
			if swap {
				err = customerr
				debugWithState(g, state, "Replacing error with custom error")
				debugWithStateError(g, state, err)
			}
		}
		return newstate, err
	} else if n > 1 {
		err := libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Instruction contains multiple instruction names")
		debugWithStateError(g, state, err)
		return state, err
	}

	return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
		"Unsupported PVL instruction")
}

func stepAssertRegexMatch(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState) (ScriptState, libkb.ProofError) {
	template, err := ins.AtKey(string(CmdAssertRegexMatch)).GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not get regex template")
	}
	re, perr := interpretRegex(g, template, state)
	if perr != nil {
		return state, perr
	}
	if !re.MatchString(state.ActiveString) {
		debugWithState(g, state, "Regex did not match:\n  %v\n  %v\n  %v", template, re, state.ActiveString)
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Regex did not match (%v)", template)
	}

	return state, nil
}

func stepAssertFindBase64(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState) (ScriptState, libkb.ProofError) {
	target, err := ins.AtKey(string(CmdAssertFindBase64)).GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Bad assert-findbase64 instruction")
	}
	if target == "sig" {
		if libkb.FindBase64Block(state.ActiveString, state.Vars.Sig, false) {
			return state, nil
		}
		return state, libkb.NewProofError(keybase1.ProofStatus_TEXT_NOT_FOUND,
			"Signature not found")
	}
	return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
		"Can only assert_find_base64 for sig")
}

func stepWhitespaceNormalize(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState) (ScriptState, libkb.ProofError) {
	state.ActiveString = libkb.WhitespaceNormalize(state.ActiveString)
	return state, nil
}

func stepRegexCapture(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState) (ScriptState, libkb.ProofError) {
	template, err := ins.AtKey(string(CmdRegexCapture)).GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"not get regex template")
	}
	re, perr := interpretRegex(g, template, state)
	if perr != nil {
		return state, perr
	}
	match := re.FindStringSubmatch(state.ActiveString)
	// Assert that the match matched and has at least one capture group.
	if len(match) < 2 {
		debugWithState(g, state, "Regex capture did not match enough:\n  %v\n  %v\n  %v\n  %v",
			template, re, state.ActiveString, match)
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Regex capture did not match (%v)", template)
	}
	state.ActiveString = match[1]
	return state, nil
}

func stepFetch(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState) (ScriptState, libkb.ProofError) {
	fetchType, err := ins.AtKey(string(CmdFetch)).GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not get fetch type")
	}
	if state.FetchResult != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Script cannot contain more than one fetch")
	}
	if state.Service == keybase1.ProofType_DNS {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Script cannot fetch in DNS mode")
	}

	switch Mode(fetchType) {
	case ModeString:
		res, err := g.GetExternalAPI().GetText(libkb.NewAPIArg(state.FetchURL))
		if err != nil {
			return state, libkb.XapiError(err, state.FetchURL)
		}
		state.FetchResult = &FetchResult{
			Mode:   ModeString,
			String: res.Body,
		}
		state.ActiveString = state.FetchResult.String
		return state, nil
	case ModeJSON:
		res, err := g.GetExternalAPI().Get(libkb.NewAPIArg(state.FetchURL))
		if err != nil {
			return state, libkb.XapiError(err, state.FetchURL)
		}
		state.FetchResult = &FetchResult{
			Mode: ModeJSON,
			JSON: res.Body,
		}
		state.ActiveString = ""
		return state, nil
	case ModeHTML:
		res, err := g.GetExternalAPI().GetHTML(libkb.NewAPIArg(state.FetchURL))
		if err != nil {
			return state, libkb.XapiError(err, state.FetchURL)
		}
		state.FetchResult = &FetchResult{
			Mode: ModeHTML,
			HTML: res.GoQuery,
		}
		state.ActiveString = ""
		return state, nil
	default:
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Unsupported fetch type %v", fetchType)
	}
}

func stepSelectorJSON(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState) (ScriptState, libkb.ProofError) {
	if state.FetchResult == nil || state.FetchResult.Mode != ModeJSON {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use json selector with non-json fetch result")
	}

	selectorsw, err := ins.AtKey(string(CmdSelectorJSON)).ToArray()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use css selector with non-html fetch result")
	}

	selectors, err := jsonUnpackArray(selectorsw)
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not unpack json selector list: %v", err)
	}
	if len(selectors) < 1 {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Json selector list must contain at least 1 element")
	}

	results, perr := runSelectorJSONInner(g, state, state.FetchResult.JSON, selectors)
	if perr != nil {
		return state, perr
	}
	if len(results) < 1 {
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Json selector did not match any values")
	}
	s := strings.Join(results, " ")

	state.ActiveString = s
	return state, nil
}

func stepSelectorCSS(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState) (ScriptState, libkb.ProofError) {
	if state.FetchResult == nil || state.FetchResult.Mode != ModeHTML {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use css selector with non-html fetch result")
	}

	selectors, err := ins.AtKey(string(CmdSelectorCSS)).ToArray()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"CSS selectors must be an array: %v", err)
	}

	// Whether to get an attribute or the text contents.
	attr, err := ins.AtKey("attr").GetString()
	useAttr := err == nil

	// Whether the final selection can contain multiple elements.
	multi, err := ins.AtKey("multi").GetBool()
	multi = multi && err == nil

	selection, perr := runCSSSelectorInner(g, state.FetchResult.HTML.Selection, selectors)
	if perr != nil {
		return state, perr
	}

	if selection.Size() < 1 {
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"No elements matched by selector")
	}

	if selection.Size() > 1 && !multi {
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"CSS selector matched too many elements")
	}

	res := selectionContents(selection, useAttr, attr)

	state.ActiveString = res
	return state, nil
}

func stepTransformURL(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState) (ScriptState, libkb.ProofError) {
	sourceTemplate, err := ins.AtKey(string(CmdTransformURL)).GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not get regex template for transformation")
	}
	destTemplate, err := ins.AtKey("to").GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not get dest pattern for transformation")
	}

	re, perr := interpretRegex(g, sourceTemplate, state)
	if perr != nil {
		return state, perr
	}

	match := re.FindStringSubmatch(state.FetchURL)
	if len(match) < 1 {
		libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Regex transform did not match:\n  %v\n  %v\n  %v",
			sourceTemplate, re, state.FetchURL)
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Regex transform did not match: %v", sourceTemplate)
	}

	newURL, err := substitute(destTemplate, state, match)
	if err != nil {
		debugWithState(g, state, "Regex transform did not substitute:\n  %v\n  %v\n  %v\n  %v",
			destTemplate, re, state.FetchURL, match)
		return state, libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
			"Regex transform did not substitute: %v", destTemplate)
	}

	state.FetchURL = newURL
	state.ActiveString = newURL
	return state, nil
}

// Run a PVL CSS selector.
// selectors is a list like [ "div .foo", 0, ".bar"] ].
// Each string runs a selector, each integer runs a Eq.
func runCSSSelectorInner(g ProofContextExt, html *goquery.Selection, selectors *jsonw.Wrapper) (*goquery.Selection, libkb.ProofError) {
	nselectors, err := selectors.Len()
	if err != nil {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not get length of selector list")
	}
	if nselectors < 1 {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"CSS selectors array must not be empty")
	}

	var selection *goquery.Selection
	selection = html

	for i := 0; i < nselectors; i++ {
		selector := selectors.AtIndex(i)

		selectorIndex, err := selector.GetInt()
		selectorIsIndex := err == nil
		selectorString, err := selector.GetString()
		selectorIsString := err == nil && !selectorIsIndex

		switch {
		case selectorIsIndex:
			selection = selection.Eq(selectorIndex)
		case selectorIsString:
			selection = selection.Find(selectorString)
		default:
			return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
				"Selector entry must be a string or int %v", selector)
		}
	}

	return selection, nil
}

// Most failures here log instead of returning an error. If an error occurs, ([], nil) will be returned.
// This is because a selector may descend into many subtrees and fail in all but one.
func runSelectorJSONInner(g ProofContextExt, state ScriptState, object *jsonw.Wrapper, selectors []*jsonw.Wrapper) ([]string, libkb.ProofError) {
	// The terminating condition is when we've consumed all the selectors.
	if len(selectors) == 0 {
		s, err := jsonStringSimple(object)
		if err != nil {
			debugWithState(g, state, "JSON could not read object: %v (%v)", err, object)
			return make([]string, 0), nil
		}
		return []string{s}, nil
	}

	selector := selectors[0]
	nextselectors := selectors[1:]

	selectorIndex, err := selector.GetInt()
	selectorIsIndex := err == nil
	selectorKey, err := selector.GetString()
	selectorIsKey := err == nil && !selectorIsIndex
	allness, err := selector.AtKey("all").GetBool()
	selectorIsAll := err == nil && allness

	switch {
	case selectorIsIndex:
		object, err := object.ToArray()
		if err != nil {
			debugWithState(g, state, "JSON select by index from non-array: %v (%v) (%v)", err, selectorIndex, object)
			return []string{}, nil
		}

		nextobject := object.AtIndex(selectorIndex)
		return runSelectorJSONInner(g, state, nextobject, nextselectors)
	case selectorIsKey:
		object, err := object.ToDictionary()
		if err != nil {
			debugWithState(g, state, "JSON select by key from non-map: %v (%v) (%v)", err, selectorKey, object)
			return []string{}, nil
		}

		nextobject := object.AtKey(selectorKey)
		return runSelectorJSONInner(g, state, nextobject, nextselectors)
	case selectorIsAll:
		children, err := jsonGetChildren(object)
		if err != nil {
			debugWithState(g, state, "JSON select could not get children: %v (%v)", err, object)
			return []string{}, nil
		}
		var results []string
		for _, child := range children {
			innerresults, perr := runSelectorJSONInner(g, state, child, nextselectors)
			if perr != nil {
				return nil, perr
			}
			results = append(results, innerresults...)
		}
	}
	return []string{}, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
		"Selector entry not recognized: %v", selector)
}

// Take a template, substitute variables, and build the Regexp.
func interpretRegex(g ProofContextExt, template string, state ScriptState) (*regexp.Regexp, libkb.ProofError) {
	var perr libkb.ProofError = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
		"Could not build regex %v", template)

	// Parse out bookends (^$) and option letters.
	if !strings.HasPrefix(template, "^") {
		return nil, perr
	}
	lastDollar := strings.LastIndex(template, "$")
	if lastDollar == -1 {
		return nil, perr
	}
	opts := template[lastDollar+1:]
	if !regexp.MustCompile("[imsU]*").MatchString(opts) {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not build regex: %v (%v)", "invalid options", template)
	}
	var prefix = ""
	optmap := make(map[rune]bool)
	for _, opt := range opts {
		optmap[opt] = true
	}
	if len(opts) != len(optmap) {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not build regex: %v (%v)", "duplicate options", template)
	}
	if len(opts) > 0 {
		prefix = "(?" + opts + ")"
	}

	// Do variable interpolation.
	prepattern, perr := substitute(template[0:lastDollar+1], state, nil)
	if perr != nil {
		return nil, perr
	}
	pattern := prefix + prepattern

	// Build the regex.
	re, err := regexp.Compile(pattern)
	if err != nil {
		debugWithState(g, state, "Could not compile regex: %v\n  %v\n  %v", err, template, pattern)
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not compile regex: %v (%v)", err, template)
	}
	return re, nil
}

// Take an instruction and if it specifies a custom error via an "error" key, replace the error.
// Always returns an error because that's its job. The second return argument is true if a different error is returned.
// If there is an issue with the "error" spec, this just returns the unmodfied err1.
// It would be just too harsh to report INVALID_PVL for that.
func customError(g ProofContextExt, ins *jsonw.Wrapper, state ScriptState, err1 libkb.ProofError) (libkb.ProofError, bool) {
	if err1 == nil {
		return err1, false
	}
	if !jsonHasKey(ins, "error") {
		return err1, false
	}

	var ename string
	edesc := err1.GetDesc()

	ar, err := ins.AtKey("error").ToArray()
	if err != nil {
		// "error": "name"
		name, err := ins.AtKey("error").GetString()
		if err != nil {
			debugWithState(g, state, "Invalid error spec: %v", err)
			return err1, false
		}
		ename = name
	} else {
		// "error": ["name", "desc"]
		name, err := ar.AtIndex(0).GetString()
		if err != nil {
			debugWithState(g, state, "Invalid error spec: %v", err)
		} else {
			ename = name
		}

		desc, err := ar.AtIndex(1).GetString()
		if err == nil {
			edesc = desc
		}
	}

	estatus := err1.GetProofStatus()

	if ename != "" {
		status, ok := keybase1.ProofStatusMap[ename]
		if !ok {
			debugWithState(g, state, "Invalid error spec: %v", ename)
		} else {
			estatus = status
		}
	}

	if estatus != err1.GetProofStatus() || edesc != err1.GetDesc() {
		return libkb.NewProofError(estatus, edesc), true
	}
	return err1, false
}
