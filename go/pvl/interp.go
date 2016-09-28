// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"encoding/json"
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

type scriptState struct {
	WhichScript  int
	PC           int
	Service      keybase1.ProofType
	Vars         scriptVariables
	ActiveString string
	FetchURL     string
	HasFetched   bool
	// nil until fetched
	fetchResult *fetchResult
}

type scriptVariables struct {
	UsernameService string
	UsernameKeybase string
	Sig             []byte
	SigIDMedium     string
	SigIDShort      string
	Hostname        string
	Protocol        string
}

type fetchResult struct {
	fetchMode fetchMode
	// One of these 3 must be filled.
	String string
	HTML   *goquery.Document
	JSON   *jsonw.Wrapper
}

type regexDescriptor struct {
	Template        string
	CaseInsensitive bool
	MultiLine       bool
}

type fetchMode string

const (
	fetchModeJSON   fetchMode = "json"
	fetchModeHTML   fetchMode = "html"
	fetchModeString fetchMode = "string"
	fetchModeDNS    fetchMode = "dns"
)

type commandName string

const (
	cmdAssertRegexMatch    commandName = "assert_regex_match"
	cmdAssertFindBase64    commandName = "assert_find_base64"
	cmdWhitespaceNormalize commandName = "whitespace_normalize"
	cmdRegexCapture        commandName = "regex_capture"
	cmdFetch               commandName = "fetch"
	cmdSelectorJSON        commandName = "selector_json"
	cmdSelectorCSS         commandName = "selector_css"
	cmdTransformURL        commandName = "transform_url"
)

// ProofInfo contains all the data about a proof PVL needs to check it.
// It can be derived from a RemoteProofChainLink and SigHint.
type ProofInfo struct {
	ArmoredSig     string
	Username       string
	RemoteUsername string
	Hostname       string
	Protocol       string
	APIURL         string
	stubDNS        *stubDNSEngine
}

// NewProofInfo creates a new ProofInfo
func NewProofInfo(link libkb.RemoteProofChainLink, h libkb.SigHint) ProofInfo {
	return ProofInfo{
		ArmoredSig:     link.GetArmoredSig(),
		RemoteUsername: link.GetRemoteUsername(),
		Username:       link.GetUsername(),
		Hostname:       link.GetHostname(),
		Protocol:       link.GetProtocol(),
		APIURL:         h.GetAPIURL(),
	}
}

// CheckProof verifies one proof by running the pvl on the provided proof information.
func CheckProof(g1 libkb.ProofContext, pvlS string, service keybase1.ProofType, info ProofInfo) libkb.ProofError {
	g := newProofContextExt(g1, info.stubDNS)
	perr := checkProofInner(g, pvlS, service, info)
	if perr != nil {
		debug(g, "CheckProof failed: %v", perr)
	}
	return perr
}

func checkProofInner(g proofContextExt, pvlS string, service keybase1.ProofType, info ProofInfo) libkb.ProofError {
	pvl, err := parse(pvlS)
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not parse pvl: %v", err)
	}

	if perr := validateChunk(g, &pvl, service); perr != nil {
		return perr
	}

	sigBody, sigID, err := libkb.OpenSig(info.ArmoredSig)
	if err != nil {
		return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
			"Bad signature: %v", err)
	}

	vars := scriptVariables{
		UsernameService: info.RemoteUsername, // Empty "" for web and dns proofs
		UsernameKeybase: info.Username,
		Sig:             sigBody,
		SigIDMedium:     sigID.ToMediumID(),
		SigIDShort:      sigID.ToShortID(),
		Hostname:        info.Hostname, // Empty "" except for web/dns proofs
		Protocol:        info.Protocol, // Empty "" except for web proofs
	}

	// Enforce prooftype-dependent variables.
	webish := (service == keybase1.ProofType_DNS || service == keybase1.ProofType_GENERIC_WEB_SITE)
	if webish {
		vars.UsernameService = ""
	} else {
		vars.Hostname = ""
	}
	if service != keybase1.ProofType_GENERIC_WEB_SITE {
		vars.Protocol = ""
	}

	// Validate and rewrite domain and protocol
	if webish {
		if !validateDomain(vars.Hostname) {
			return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
				"Bad hostname in sig: %s", vars.Hostname)
		}
	}
	if service == keybase1.ProofType_GENERIC_WEB_SITE {
		canonicalProtocol, ok := validateProtocol(vars.Protocol, []string{"http", "https"})
		if ok {
			vars.Protocol = canonicalProtocol
		} else {
			return libkb.NewProofError(keybase1.ProofStatus_BAD_SIGNATURE,
				"Bad protocol in sig: %s", vars.Protocol)
		}
	}

	scripts, perr := chunkGetScripts(&pvl, service)
	if perr != nil {
		return perr
	}

	newstate := func(i int) scriptState {
		state := scriptState{
			WhichScript:  i,
			PC:           0,
			Service:      service,
			Vars:         vars,
			ActiveString: info.APIURL,
			FetchURL:     info.APIURL,
			HasFetched:   false,
			fetchResult:  nil,
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
			perr = runScript(g, &script, newstate(i))
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
func chunkGetScripts(pvl *pvlT, service keybase1.ProofType) ([]scriptT, libkb.ProofError) {
	scripts, ok := pvl.Services.Map[service]
	if !ok {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"No entry for service: %v", service)
	}
	return scripts, nil
}

// Check that a chunk of PVL is valid code.
// Will always accept valid code, but may not always notice invalidities.
func validateChunk(g proofContextExt, pvl *pvlT, service keybase1.ProofType) libkb.ProofError {
	if pvl.PvlVersion != SupportedVersion {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"PVL is for the wrong version %v != %v", pvl.PvlVersion, SupportedVersion)
	}

	debug(g, "valid version:%v revision:%v", pvl.PvlVersion, pvl.Revision)

	scripts, perr := chunkGetScripts(pvl, service)
	if perr != nil {
		return perr
	}
	if len(scripts) == 0 {
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Empty scripts list for service: %v", service)
	}

	// Scan all the scripts (for this service) for errors. Report the first error.
	var errs []libkb.ProofError
	for whichscript, script := range scripts {
		perr = validateScript(g, &script, service, whichscript)
		errs = append(errs, perr)
	}
	return errs[0]
}

func validateScript(g proofContextExt, script *scriptT, service keybase1.ProofType, whichscript int) libkb.ProofError {
	// Scan the script.
	// Does not validate each instruction's format. (That is done when running it)
	// Validate each instruction's "error" field.

	logerr := func(g proofContextExt, service keybase1.ProofType, whichscript int, pc int, format string, arg ...interface{}) libkb.ProofError {
		debugWithPosition(g, service, whichscript, pc, format, arg...)
		return libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL, format, arg...)
	}

	var modeknown = false
	var mode fetchMode
	if service == keybase1.ProofType_DNS {
		modeknown = true
		mode = fetchModeDNS
	}
	if len(script.Instructions) < 1 {
		return logerr(g, service, whichscript, 0, "Empty script")
	}

	for i, ins := range script.Instructions {
		if ins.variantsFilled() != 1 {
			return logerr(g, service, whichscript, i, "exactly 1 variant must appear in instruction")
		}

		switch {

		// These can always run, but must be cases so that the default case works.
		case ins.AssertRegexMatch != nil:
		case ins.AssertFindBase64 != nil:
		case ins.WhitespaceNormalize != nil:
		case ins.RegexCapture != nil:

		case ins.Fetch != nil:
			// A script can contain only <=1 fetches.
			// A DNS script cannot contain fetches.

			fetchType := ins.Fetch.Kind

			if service == keybase1.ProofType_DNS {
				return logerr(g, service, whichscript, i,
					"DNS script cannot contain fetch instruction")
			}
			if modeknown {
				return logerr(g, service, whichscript, i,
					"Script cannot contain multiple fetch instructions")
			}
			switch fetchMode(fetchType) {
			case fetchModeString:
				modeknown = true
				mode = fetchModeString
			case fetchModeHTML:
				modeknown = true
				mode = fetchModeHTML
			case fetchModeJSON:
				modeknown = true
				mode = fetchModeJSON
			default:
				return logerr(g, service, whichscript, i,
					"Unsupported fetch type: %v", fetchType)
			}
		case ins.SelectorJSON != nil:
			// Can only select after fetching.
			switch {
			case service == keybase1.ProofType_DNS:
				return logerr(g, service, whichscript, i,
					"DNS script cannot use json selector")
			case !modeknown:
				return logerr(g, service, whichscript, i,
					"Script cannot select before fetch")
			case mode != fetchModeJSON:
				return logerr(g, service, whichscript, i,
					"Script contains json selector in non-html mode")
			}
		case ins.SelectorCSS != nil:
			// Can only select after fetching.
			switch {
			case service == keybase1.ProofType_DNS:
				return logerr(g, service, whichscript, i,
					"DNS script cannot use css selector")
			case !modeknown:
				return logerr(g, service, whichscript, i,
					"Script cannot select before fetch")
			case mode != fetchModeHTML:
				return logerr(g, service, whichscript, i,
					"Script contains css selector in non-html mode")
			}
		case ins.TransformURL != nil:
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
func runDNS(g proofContextExt, scripts []scriptT, startstate scriptState) []libkb.ProofError {
	userdomain := startstate.Vars.Hostname
	domains := []string{userdomain, "_keybase." + userdomain}
	var errs []libkb.ProofError
	for _, d := range domains {
		debugWithState(g, startstate, "Trying DNS for domain: %v", d)

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
func runDNSOne(g proofContextExt, scripts []scriptT, startstate scriptState, domain string) libkb.ProofError {
	// Fetch TXT records
	var txts []string
	var err error
	if g.getStubDNS() == nil {
		txts, err = net.LookupTXT(domain)
	} else {
		txts, err = g.getStubDNS().LookupTXT(domain)
	}

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
			err = runScript(g, &script, state)
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

func runScript(g proofContextExt, script *scriptT, startstate scriptState) libkb.ProofError {
	var state = startstate
	if len(script.Instructions) < 1 {
		perr := libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Empty scripts are not allowed.")
		debugWithStateError(g, state, perr)
		return perr
	}
	for i, ins := range script.Instructions {
		// Sanity check.
		if state.PC != i {
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
func stepInstruction(g proofContextExt, ins instructionT, state scriptState) (scriptState, libkb.ProofError) {
	debugWithState(g, state, "Running instruction %v: %v", ins.Name(), ins)

	var newState scriptState
	var stepErr libkb.ProofError
	var customErrSpec *errorT
	switch {
	case ins.AssertRegexMatch != nil:
		newState, stepErr = stepAssertRegexMatch(g, *ins.AssertRegexMatch, state)
		customErrSpec = ins.AssertRegexMatch.Error
	case ins.AssertFindBase64 != nil:
		newState, stepErr = stepAssertFindBase64(g, *ins.AssertFindBase64, state)
		customErrSpec = ins.AssertFindBase64.Error
	case ins.WhitespaceNormalize != nil:
		newState, stepErr = stepWhitespaceNormalize(g, *ins.WhitespaceNormalize, state)
		customErrSpec = ins.WhitespaceNormalize.Error
	case ins.RegexCapture != nil:
		newState, stepErr = stepRegexCapture(g, *ins.RegexCapture, state)
		customErrSpec = ins.RegexCapture.Error
	case ins.Fetch != nil:
		newState, stepErr = stepFetch(g, *ins.Fetch, state)
		customErrSpec = ins.Fetch.Error
	case ins.SelectorJSON != nil:
		newState, stepErr = stepSelectorJSON(g, *ins.SelectorJSON, state)
		customErrSpec = ins.SelectorJSON.Error
	case ins.SelectorCSS != nil:
		newState, stepErr = stepSelectorCSS(g, *ins.SelectorCSS, state)
		customErrSpec = ins.SelectorCSS.Error
	case ins.TransformURL != nil:
		newState, stepErr = stepTransformURL(g, *ins.TransformURL, state)
		customErrSpec = ins.TransformURL.Error
	default:
		newState = state
		stepErr = libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Invalid instruction: %v", ins)
	}

	if stepErr != nil {
		debugWithStateError(g, state, stepErr)
		stepErr = replaceCustomError(g, state, customErrSpec, stepErr)
	}
	return newState, stepErr

}

func stepAssertRegexMatch(g proofContextExt, ins assertRegexMatchT, state scriptState) (scriptState, libkb.ProofError) {
	rdesc := regexDescriptor{
		Template:        ins.Pattern,
		CaseInsensitive: ins.CaseInsensitive,
		MultiLine:       ins.MultiLine,
	}
	re, err := interpretRegex(g, state, rdesc)
	if err != nil {
		return state, err
	}
	if !re.MatchString(state.ActiveString) {
		debugWithState(g, state, "Regex did not match:\n  %v\n  %v\n  %v",
			rdesc.Template, re, state.ActiveString)
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Regex did not match (%v)", rdesc.Template)
	}

	return state, nil
}

func stepAssertFindBase64(g proofContextExt, ins assertFindBase64T, state scriptState) (scriptState, libkb.ProofError) {
	target := ins.Var
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

func stepWhitespaceNormalize(g proofContextExt, ins whitespaceNormalizeT, state scriptState) (scriptState, libkb.ProofError) {
	state.ActiveString = libkb.WhitespaceNormalize(state.ActiveString)
	return state, nil
}

func stepRegexCapture(g proofContextExt, ins regexCaptureT, state scriptState) (scriptState, libkb.ProofError) {
	rdesc := regexDescriptor{
		Template:        ins.Pattern,
		CaseInsensitive: ins.CaseInsensitive,
		MultiLine:       ins.MultiLine,
	}
	re, err := interpretRegex(g, state, rdesc)
	if err != nil {
		return state, err
	}
	match := re.FindStringSubmatch(state.ActiveString)
	// Assert that the match matched and has at least one capture group.
	if len(match) < 2 {
		debugWithState(g, state, "Regex capture did not match enough:\n  %v\n  %v\n  %v\n  %v",
			rdesc.Template, re, state.ActiveString, match)
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Regex capture did not match (%v)", rdesc.Template)
	}
	state.ActiveString = match[1]
	return state, nil
}

func stepFetch(g proofContextExt, ins fetchT, state scriptState) (scriptState, libkb.ProofError) {
	fetchType := ins.Kind
	if state.fetchResult != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Script cannot contain more than one fetch")
	}
	if state.Service == keybase1.ProofType_DNS {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Script cannot fetch in DNS mode")
	}

	switch fetchMode(fetchType) {
	case fetchModeString:
		res, err := g.GetExternalAPI().GetText(libkb.NewAPIArg(state.FetchURL))
		if err != nil {
			return state, libkb.XapiError(err, state.FetchURL)
		}
		state.fetchResult = &fetchResult{
			fetchMode: fetchModeString,
			String:    res.Body,
		}
		state.ActiveString = state.fetchResult.String
		return state, nil
	case fetchModeJSON:
		res, err := g.GetExternalAPI().Get(libkb.NewAPIArg(state.FetchURL))
		if err != nil {
			return state, libkb.XapiError(err, state.FetchURL)
		}
		state.fetchResult = &fetchResult{
			fetchMode: fetchModeJSON,
			JSON:      res.Body,
		}
		state.ActiveString = ""
		return state, nil
	case fetchModeHTML:
		res, err := g.GetExternalAPI().GetHTML(libkb.NewAPIArg(state.FetchURL))
		if err != nil {
			return state, libkb.XapiError(err, state.FetchURL)
		}
		state.fetchResult = &fetchResult{
			fetchMode: fetchModeHTML,
			HTML:      res.GoQuery,
		}
		state.ActiveString = ""
		return state, nil
	default:
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Unsupported fetch type %v", fetchType)
	}
}

func stepSelectorJSON(g proofContextExt, ins selectorJSONT, state scriptState) (scriptState, libkb.ProofError) {
	if state.fetchResult == nil || state.fetchResult.fetchMode != fetchModeJSON {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use json selector with non-json fetch result")
	}

	selectorsStr, err := json.Marshal(ins.Selectors)
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not marshal selectors")
	}
	selectorsw, err := jsonw.Unmarshal(selectorsStr)
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not unmarshal selectors")
	}
	selectorsw, err = selectorsw.ToArray()
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Json selector list must be an array")
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

	results, perr := runSelectorJSONInner(g, state, state.fetchResult.JSON, selectors)
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

func stepSelectorCSS(g proofContextExt, ins selectorCSST, state scriptState) (scriptState, libkb.ProofError) {
	if state.fetchResult == nil || state.fetchResult.fetchMode != fetchModeHTML {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Cannot use css selector with non-html fetch result")
	}

	selectorsStr, err := json.Marshal(ins.Selectors)
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not marshal selectors")
	}
	selectorsw, err := jsonw.Unmarshal(selectorsStr)
	if err != nil {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not unmarshal selectors")
	}

	// Whether to get an attribute or the text contents.
	attr := ins.Attr
	useAttr := attr != ""

	selection, perr := runCSSSelectorInner(g, state.fetchResult.HTML.Selection, selectorsw)
	if perr != nil {
		return state, perr
	}

	if selection.Size() < 1 {
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"No elements matched by selector")
	}

	if selection.Size() > 1 && !ins.Multi {
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"CSS selector matched too many elements")
	}

	res := selectionContents(selection, useAttr, attr)

	state.ActiveString = res
	return state, nil
}

func stepTransformURL(g proofContextExt, ins transformURLT, state scriptState) (scriptState, libkb.ProofError) {
	sourceRdesc := regexDescriptor{
		Template:        ins.Pattern,
		CaseInsensitive: ins.CaseInsensitive,
		MultiLine:       ins.MultiLine,
	}
	re, perr := interpretRegex(g, state, sourceRdesc)
	if perr != nil {
		return state, perr
	}

	destTemplate := ins.ToPattern
	if destTemplate == "" {
		return state, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Empty dest pattern for transformation")
	}

	match := re.FindStringSubmatch(state.FetchURL)
	if len(match) < 1 {
		debugWithState(g, state, "Regex transform did not match:\n  %v\n  %v\n  %v",
			sourceRdesc.Template, re, state.FetchURL)
		return state, libkb.NewProofError(keybase1.ProofStatus_CONTENT_FAILURE,
			"Regex transform did not match: %v", sourceRdesc.Template)
	}

	newURL, err := substitute(destTemplate, state, match, nil)
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
func runCSSSelectorInner(g proofContextExt, html *goquery.Selection, selectors *jsonw.Wrapper) (*goquery.Selection, libkb.ProofError) {
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
func runSelectorJSONInner(g proofContextExt, state scriptState, selectedObject *jsonw.Wrapper, selectors []*jsonw.Wrapper) ([]string, libkb.ProofError) {
	// The terminating condition is when we've consumed all the selectors.
	if len(selectors) == 0 {
		s, err := jsonStringSimple(selectedObject)
		if err != nil {
			debugWithState(g, state, "JSON could not read object: %v (%v)", err, selectedObject)
			return []string{}, nil
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
		object, err := selectedObject.ToArray()
		if err != nil {
			debugWithState(g, state, "JSON select by index from non-array: %v (%v) (%v)", err, selectorIndex, object)
			return []string{}, nil
		}
		length, err := object.Len()
		if err != nil {
			return []string{}, nil
		}

		index, ok := pyindex(selectorIndex, length)
		if !ok || index < 0 {
			return []string{}, nil
		}
		nextobject := object.AtIndex(index)
		return runSelectorJSONInner(g, state, nextobject, nextselectors)
	case selectorIsKey:
		object, err := selectedObject.ToDictionary()
		if err != nil {
			debugWithState(g, state, "JSON select by key from non-map: %v (%v) (%v)", err, selectorKey, object)
			return []string{}, nil
		}

		nextobject := object.AtKey(selectorKey)
		return runSelectorJSONInner(g, state, nextobject, nextselectors)
	case selectorIsAll:
		children, err := jsonGetChildren(selectedObject)
		if err != nil {
			debugWithState(g, state, "JSON select could not get children: %v (%v)", err, selectedObject)
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
		return results, nil
	}
	return []string{}, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
		"Selector entry not recognized: %v", selector)
}

// Take a regex descriptor, do variable substitution, and build a regex.
func interpretRegex(g proofContextExt, state scriptState, rdesc regexDescriptor) (*regexp.Regexp, libkb.ProofError) {
	// Check that regex is bounded by "^" and "$".
	if !strings.HasPrefix(rdesc.Template, "^") {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not build regex: %v (%v)", "must start with '^'", rdesc.Template)
	}
	if !strings.HasSuffix(rdesc.Template, "$") {
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not build regex: %v (%v)", "must end with '$'", rdesc.Template)
	}

	var optstring = ""
	if rdesc.CaseInsensitive {
		optstring += "i"
	}
	if rdesc.MultiLine {
		optstring += "m"
	}

	var prefix = ""
	if len(optstring) > 0 {
		prefix = "(?" + optstring + ")"
	}

	// Do variable interpolation.
	prepattern, perr := substitute(rdesc.Template, state, nil, nil)
	if perr != nil {
		return nil, perr
	}
	pattern := prefix + prepattern

	// Build the regex.
	re, err := regexp.Compile(pattern)
	if err != nil {
		debugWithState(g, state, "Could not compile regex: %v\n  %v\n  %v", err, rdesc.Template, pattern)
		return nil, libkb.NewProofError(keybase1.ProofStatus_INVALID_PVL,
			"Could not compile regex: %v (%v)", err, rdesc.Template)
	}
	return re, nil
}

// Use a custom error spec to derive an error.
// spec can be none
// Copies over the error code if none is specified.
func replaceCustomError(g proofContextExt, state scriptState, spec *errorT, err1 libkb.ProofError) libkb.ProofError {
	if err1 == nil {
		return err1
	}

	// Don't rewrite invalid_pvl errors
	if err1.GetProofStatus() == keybase1.ProofStatus_INVALID_PVL {
		return err1
	}

	if spec == nil {
		return err1
	}

	if (spec.Status != err1.GetProofStatus()) || (spec.Description != err1.GetDesc()) {
		err2 := libkb.NewProofError(spec.Status, spec.Description)
		debugWithState(g, state, "Replacing error with custom error")
		debugWithStateError(g, state, err2)

		return err2
	}
	return err1
}
