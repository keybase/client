// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	b64 "encoding/base64"
	"net"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// UsePvl says whether to use PVL for verifying proofs.
const UsePvl = false

// PvlSupportedVersion is which version of PVL is supported by this client.
const PvlSupportedVersion int = 1

type PvlScriptState struct {
	WhichScript  int
	PC           int
	Service      keybase1.ProofType
	Vars         PvlScriptVariables
	ActiveString string
	FetchURL     string
	HasFetched   bool
	// nil until fetched
	FetchResult *PvlFetchResult
}

type PvlScriptVariables struct {
	UsernameService string
	UsernameKeybase string
	Sig             []byte
	SigIDMedium     string
	SigIDShort      string
	Hostname        string
}

type PvlFetchResult struct {
	Mode PvlMode
	// One of these 3 must be filled.
	String string
	HTML   *goquery.Document
	JSON   *jsonw.Wrapper
}

type PvlMode string

const (
	PvlModeJSON   PvlMode = "json"
	PvlModeHTML   PvlMode = "html"
	PvlModeString PvlMode = "string"
	PvlModeDNS    PvlMode = "dns"
)

type PvlCommandName string

const (
	PvlAssertRegexMatch    PvlCommandName = "assert_regex_match"
	PvlAssertFindBase64    PvlCommandName = "assert_find_base64"
	PvlWhitespaceNormalize PvlCommandName = "whitespace_normalize"
	PvlRegexCapture        PvlCommandName = "regex_capture"
	PvlFetch               PvlCommandName = "fetch"
	PvlSelectorJSON        PvlCommandName = "selector_json"
	PvlSelectorCSS         PvlCommandName = "selector_css"
	PvlTransformURL        PvlCommandName = "transform_url"
)

type PvlStep func(ProofContextExt, *jsonw.Wrapper, PvlScriptState) (PvlScriptState, libkb.ProofError)

var PvlSteps = map[PvlCommandName]PvlStep{
	PvlAssertRegexMatch:    pvlStepAssertRegexMatch,
	PvlAssertFindBase64:    pvlStepAssertFindBase64,
	PvlWhitespaceNormalize: pvlStepWhitespaceNormalize,
	PvlRegexCapture:        pvlStepRegexCapture,
	PvlFetch:               pvlStepFetch,
	PvlSelectorJSON:        pvlStepSelectorJSON,
	PvlSelectorCSS:         pvlStepSelectorCSS,
	PvlTransformURL:        pvlStepTransformURL,
}

// Checkproof verifies one proof by running the pvl on the provided proof information.
func CheckProof(g1 libkb.ProofContext, pvl *jsonw.Wrapper, service keybase1.ProofType, link libkb.RemoteProofChainLink, h libkb.SigHint) libkb.ProofError {
	g := NewProofContextExt(g1)
	perr := CheckProofInner(g, pvl, service, link, h)
	if perr != nil {
		debug(g, "CheckProof failed: %v", perr)
	}
	return perr
}

func CheckProofInner(g ProofContextExt, pvl *jsonw.Wrapper, service keybase1.ProofType, link libkb.RemoteProofChainLink, h libkb.SigHint) libkb.ProofError {
	if perr := pvlValidateChunk(g, pvl, service); perr != nil {
		return perr
	}

	sigBody, sigID, err := libkb.OpenSig(link.GetArmoredSig())
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %v", err)
	}

	scripts, perr := pvlChunkGetScripts(pvl, service)
	if perr != nil {
		return perr
	}

	newstate := func(i int) PvlScriptState {
		vars := PvlScriptVariables{
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

		state := PvlScriptState{
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
		errs = pvlRunDNS(g, scripts, newstate(0))
	} else {
		// Run the scripts in order.
		// If any succeed, the proof succeeds.
		// If one fails, the next takes over.
		// If all fail, log and report errors.
		for i, script := range scripts {
			perr = pvlRunScript(g, script, newstate(i))
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
func pvlChunkGetScripts(pvl *jsonw.Wrapper, service keybase1.ProofType) ([]*jsonw.Wrapper, libkb.ProofError) {
	serviceString, perr := pvlServiceToString(service)
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
		scripts, err = pvlJSONUnpackArray(scriptsw)
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
func pvlValidateChunk(g ProofContextExt, pvl *jsonw.Wrapper, service keybase1.ProofType) libkb.ProofError {
	// Check the version.
	version, err := pvl.AtKey("pvl_version").GetInt()
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"missing version number: %v", err)
	}
	if version != PvlSupportedVersion {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"PVL is for the wrong version %v != %v", version, PvlSupportedVersion)
	}

	// Check that revision is there.
	revision, err := pvl.AtKey("revision").GetInt()
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"PVL missing reversion number: %v", err)
	}

	debug(g, "valid version:%v revision:%v", version, revision)

	scripts, perr := pvlChunkGetScripts(pvl, service)
	if perr != nil {
		return perr
	}

	// Scan all the scripts (for this service) for errors. Report the first error.
	var errs []libkb.ProofError
	for whichscript, script := range scripts {
		perr = pvlValidateScript(g, script, service, whichscript)
		errs = append(errs, perr)
	}
	return errs[0]
}

func pvlValidateScript(g ProofContextExt, script *jsonw.Wrapper, service keybase1.ProofType, whichscript int) libkb.ProofError {
	// Scan the script.
	// Does not validate each instruction's format. (That is done when running it)

	logerr := func(g ProofContextExt, service keybase1.ProofType, whichscript int, pc int, format string, arg ...interface{}) libkb.ProofError {
		debugWithPosition(g, service, whichscript, pc, format, arg...)
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, format, arg...)
	}

	var modeknown = false
	var mode PvlMode
	if service == keybase1.ProofType_DNS {
		modeknown = true
		mode = PvlModeDNS
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
		case pvlJSONHasKeyCommand(ins, PvlAssertRegexMatch):
		case pvlJSONHasKeyCommand(ins, PvlAssertFindBase64):
		case pvlJSONHasKeyCommand(ins, PvlWhitespaceNormalize):
		case pvlJSONHasKeyCommand(ins, PvlRegexCapture):

		case pvlJSONHasKeyCommand(ins, PvlFetch):
			// A script can contain only <=1 fetches.
			// A DNS script cannot contain fetches.

			fetchType, err := ins.AtKey(string(PvlFetch)).GetString()
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
			switch PvlMode(fetchType) {
			case PvlModeString:
				modeknown = true
				mode = PvlModeString
			case PvlModeHTML:
				modeknown = true
				mode = PvlModeHTML
			case PvlModeJSON:
				modeknown = true
				mode = PvlModeJSON
			default:
				return logerr(g, service, whichscript, i,
					"Unsupported fetch type: %v", fetchType)
			}
		case pvlJSONHasKeyCommand(ins, PvlSelectorJSON):
			// Can only select after fetching.
			switch {
			case service == keybase1.ProofType_DNS:
				return logerr(g, service, whichscript, i,
					"DNS script cannot use json selector")
			case !modeknown:
				return logerr(g, service, whichscript, i,
					"Script cannot select before fetch")
			case mode != PvlModeJSON:
				return logerr(g, service, whichscript, i,
					"Script contains json selector in non-html mode")
			}
		case pvlJSONHasKeyCommand(ins, PvlSelectorCSS):
			// Can only select after fetching.
			switch {
			case service == keybase1.ProofType_DNS:
				return logerr(g, service, whichscript, i,
					"DNS script cannot use css selector")
			case !modeknown:
				return logerr(g, service, whichscript, i,
					"Script cannot select before fetch")
			case mode != PvlModeHTML:
				return logerr(g, service, whichscript, i,
					"Script contains css selector in non-html mode")
			}
		case pvlJSONHasKeyCommand(ins, PvlTransformURL):
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
func pvlRunDNS(g ProofContextExt, scripts []*jsonw.Wrapper, startstate PvlScriptState) []libkb.ProofError {
	userdomain := startstate.Vars.Hostname
	domains := []string{userdomain, "_keybase." + userdomain}
	var errs []libkb.ProofError
	for _, d := range domains {
		debugWithState(g, startstate, "Trying DNS: %v", d)

		err := pvlRunDNSOne(g, scripts, startstate, d)
		if err != nil {
			errs = append(errs, err)
		} else {
			return nil
		}
	}

	return errs
}

// Run each script on each TXT record of the domain.
func pvlRunDNSOne(g ProofContextExt, scripts []*jsonw.Wrapper, startstate PvlScriptState, domain string) libkb.ProofError {
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
			err = pvlRunScript(g, script, state)
			if err == nil {
				return nil
			}
			// Discard error, it has already been reported by pvlStepInstruction.
		}
	}

	return libkb.NewProofError(keybase1.ProofStatus_NOT_FOUND,
		"Checked %d TXT entries of %s, but didn't find signature",
		len(txts), domain)
}

func pvlRunScript(g ProofContextExt, script *jsonw.Wrapper, startstate PvlScriptState) libkb.ProofError {
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

		newstate, perr := pvlStepInstruction(g, ins, state)
		if perr != nil {
			return perr
		}
		state = newstate
		state.PC++
	}

	// Script executed successfully with no errors.
	return nil
}

// pvlStepInstruction decides which instruction to run.
func pvlStepInstruction(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState) (PvlScriptState, libkb.ProofError) {
	var name PvlCommandName
	var step PvlStep
	n := 0

	for iname, istep := range PvlSteps {
		if pvlJSONHasKeyCommand(ins, iname) {
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
			customerr, swap := pvlCustomError(g, ins, state, err)
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

func pvlStepAssertRegexMatch(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState) (PvlScriptState, libkb.ProofError) {
	template, err := ins.AtKey(string(PvlAssertRegexMatch)).GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not get regex template")
	}
	re, perr := pvlInterpretRegex(g, template, state)
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

func pvlStepAssertFindBase64(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState) (PvlScriptState, libkb.ProofError) {
	target, err := ins.AtKey(string(PvlAssertFindBase64)).GetString()
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

func pvlStepWhitespaceNormalize(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState) (PvlScriptState, libkb.ProofError) {
	state.ActiveString = libkb.WhitespaceNormalize(state.ActiveString)
	return state, nil
}

func pvlStepRegexCapture(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState) (PvlScriptState, libkb.ProofError) {
	template, err := ins.AtKey(string(PvlRegexCapture)).GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"not get regex template")
	}
	re, perr := pvlInterpretRegex(g, template, state)
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

func pvlStepFetch(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState) (PvlScriptState, libkb.ProofError) {
	fetchType, err := ins.AtKey(string(PvlFetch)).GetString()
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

	switch PvlMode(fetchType) {
	case PvlModeString:
		res, err := g.GetExternalAPI().GetText(libkb.NewAPIArg(state.FetchURL))
		if err != nil {
			return state, libkb.XapiError(err, state.FetchURL)
		}
		state.FetchResult = &PvlFetchResult{
			Mode:   PvlModeString,
			String: res.Body,
		}
		state.ActiveString = state.FetchResult.String
		return state, nil
	case PvlModeJSON:
		res, err := g.GetExternalAPI().Get(libkb.NewAPIArg(state.FetchURL))
		if err != nil {
			return state, libkb.XapiError(err, state.FetchURL)
		}
		state.FetchResult = &PvlFetchResult{
			Mode: PvlModeJSON,
			JSON: res.Body,
		}
		state.ActiveString = ""
		return state, nil
	case PvlModeHTML:
		res, err := g.GetExternalAPI().GetHTML(libkb.NewAPIArg(state.FetchURL))
		if err != nil {
			return state, libkb.XapiError(err, state.FetchURL)
		}
		state.FetchResult = &PvlFetchResult{
			Mode: PvlModeHTML,
			HTML: res.GoQuery,
		}
		state.ActiveString = ""
		return state, nil
	default:
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Unsupported fetch type %v", fetchType)
	}
}

func pvlStepSelectorJSON(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState) (PvlScriptState, libkb.ProofError) {
	if state.FetchResult == nil || state.FetchResult.Mode != PvlModeJSON {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use json selector with non-json fetch result")
	}

	selectorsw, err := ins.AtKey(string(PvlSelectorJSON)).ToArray()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use css selector with non-html fetch result")
	}

	selectors, err := pvlJSONUnpackArray(selectorsw)
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not unpack json selector list: %v", err)
	}
	if len(selectors) < 1 {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Json selector list must contain at least 1 element")
	}

	results, perr := pvlRunSelectorJSONInner(g, state, state.FetchResult.JSON, selectors)
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

func pvlStepSelectorCSS(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState) (PvlScriptState, libkb.ProofError) {
	if state.FetchResult == nil || state.FetchResult.Mode != PvlModeHTML {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use css selector with non-html fetch result")
	}

	selectors, err := ins.AtKey(string(PvlSelectorCSS)).ToArray()
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

	selection, perr := pvlRunCSSSelectorInner(g, state.FetchResult.HTML.Selection, selectors)
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

	res, err := pvlSelectionContents(selection, useAttr, attr)
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Could not get html for selection: %v", err)
	}

	state.ActiveString = res
	return state, nil
}

func pvlStepTransformURL(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState) (PvlScriptState, libkb.ProofError) {
	sourceTemplate, err := ins.AtKey(string(PvlTransformURL)).GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not get regex template for transformation")
	}
	destTemplate, err := ins.AtKey("to").GetString()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not get dest pattern for transformation")
	}

	re, perr := pvlInterpretRegex(g, sourceTemplate, state)
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

	newURL, err := pvlSubstitute(destTemplate, state, match)
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
func pvlRunCSSSelectorInner(g ProofContextExt, html *goquery.Selection, selectors *jsonw.Wrapper) (*goquery.Selection, libkb.ProofError) {
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
				"Selector entry string or int %v", selector)
		}
	}

	return selection, nil
}

// Most failures here log instead of returning an error. If an error occurs, ([], nil) will be returned.
// This is because a selector may descend into many subtrees and fail in all but one.
func pvlRunSelectorJSONInner(g ProofContextExt, state PvlScriptState, object *jsonw.Wrapper, selectors []*jsonw.Wrapper) ([]string, libkb.ProofError) {
	// The terminating condition is when we've consumed all the selectors.
	if len(selectors) == 0 {
		s, err := pvlJSONStringSimple(object)
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
		return pvlRunSelectorJSONInner(g, state, nextobject, nextselectors)
	case selectorIsKey:
		object, err := object.ToDictionary()
		if err != nil {
			debugWithState(g, state, "JSON select by key from non-map: %v (%v) (%v)", err, selectorKey, object)
			return []string{}, nil
		}

		nextobject := object.AtKey(selectorKey)
		return pvlRunSelectorJSONInner(g, state, nextobject, nextselectors)
	case selectorIsAll:
		children, err := pvlJSONGetChildren(object)
		if err != nil {
			debugWithState(g, state, "JSON select could not get children: %v (%v)", err, object)
			return []string{}, nil
		}
		var results []string
		for _, child := range children {
			innerresults, perr := pvlRunSelectorJSONInner(g, state, child, nextselectors)
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
func pvlInterpretRegex(g ProofContextExt, template string, state PvlScriptState) (*regexp.Regexp, libkb.ProofError) {
	var perr libkb.ProofError = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
		"Could not build regex %v", template)

	// Parse out side bars and option letters.
	if !strings.HasPrefix(template, "/") {
		return nil, perr
	}
	lastSlash := strings.LastIndex(template, "/")
	if lastSlash == -1 {
		return nil, perr
	}
	opts := template[lastSlash+1:]
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
	prepattern, perr := pvlSubstitute(template[1:lastSlash], state, nil)
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

// Substitute vars for %{name} in the string.
// Only substitutes whitelisted variables.
// It is an error to refer to an unknown variable or undefined numbered group.
// Match is an optional slice which is a regex match.
func pvlSubstitute(template string, state PvlScriptState, match []string) (string, libkb.ProofError) {
	vars := state.Vars
	webish := (state.Service == keybase1.ProofType_DNS || state.Service == keybase1.ProofType_GENERIC_WEB_SITE)

	var outerr libkb.ProofError
	// Regex to find %{name} occurrences.
	re := regexp.MustCompile("%\\{[\\w]+\\}")
	pvlSubstituteOne := func(vartag string) string {
		// Strip off the %, {, and }
		varname := vartag[2 : len(vartag)-1]
		var value string
		switch varname {
		case "username_service":
			if !webish {
				value = vars.UsernameService
			} else {
				outerr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
					"Cannot use username_service in proof type %v", state.Service)
			}
		case "username_keybase":
			value = vars.UsernameKeybase
		case "sig":
			value = b64.StdEncoding.EncodeToString(vars.Sig)
		case "sig_id_medium":
			value = vars.SigIDMedium
		case "sig_id_short":
			value = vars.SigIDShort
		case "hostname":
			if webish {
				value = vars.Hostname
			} else {
				outerr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
					"Cannot use username_service in proof type %v", state.Service)
			}
		default:
			var i int
			i, err := strconv.Atoi(varname)
			if err == nil {
				if i >= 0 && i < len(match) {
					value = match[i]
				} else {
					outerr = libkb.NewProofError(keybase1.ProofStatus_BAD_API_URL,
						"Substitution argument %v out of range of match", i)
				}
			} else {
				outerr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
					"Unrecognized variable: %v", varname)
			}
		}
		return regexp.QuoteMeta(value)
	}
	res := re.ReplaceAllStringFunc(template, pvlSubstituteOne)
	if outerr != nil {
		return template, outerr
	}
	return res, nil
}

// Take an instruction and if it specifies a custom error via an "error" key, replace the error.
// Always returns an error because that's its job. The second return argument is true if a different error is returned.
// If there is an issue with the "error" spec, this just returns the unmodfied err1.
// It would be just too harsh to report INVALID_PVL for that.
func pvlCustomError(g ProofContextExt, ins *jsonw.Wrapper, state PvlScriptState, err1 libkb.ProofError) (libkb.ProofError, bool) {
	if err1 == nil {
		return err1, false
	}
	if !pvlJSONHasKey(ins, "error") {
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
