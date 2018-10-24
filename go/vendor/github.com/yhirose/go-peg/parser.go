package peg

import "strings"

const (
	WhitespceRuleName = "%whitespace"
	WordRuleName      = "%word"
	OptExpressionRule = "%expr"
	OptBinaryOperator = "%binop"
)

// PEG parser generator
type duplicate struct {
	name string
	pos  int
}

type data struct {
	grammar    map[string]*Rule
	start      string
	duplicates []duplicate
	options    map[string][]string
}

func newData() *data {
	return &data{
		grammar: make(map[string]*Rule),
		options: make(map[string][]string),
	}
}

var rStart, rDefinition, rExpression,
	rSequence, rPrefix, rSuffix, rPrimary,
	rIdentifier, rIdentCont, rIdentStart, rIdentRest,
	rLiteral, rClass, rRange, rChar,
	rLEFTARROW, rSLASH, rAND, rNOT, rQUESTION, rSTAR, rPLUS, rOPEN, rCLOSE, rDOT,
	rSpacing, rComment, rSpace, rEndOfLine, rEndOfFile, rBeginTok, rEndTok,
	rIgnore, rIGNORE,
	rParameters, rArguments, rCOMMA,
	rOption, rOptionValue, rOptionComment, rASSIGN, rSEPARATOR Rule

func init() {
	// Setup PEG syntax parser
	rStart.Ope = Seq(
		&rSpacing,
		Oom(&rDefinition),
		Opt(Seq(&rSEPARATOR, Oom(&rOption))),
		&rEndOfFile)

	rDefinition.Ope = Cho(
		Seq(&rIgnore, &rIdentCont, &rParameters, &rLEFTARROW, &rExpression),
		Seq(&rIgnore, &rIdentifier, &rLEFTARROW, &rExpression))

	rExpression.Ope = Seq(&rSequence, Zom(Seq(&rSLASH, &rSequence)))
	rSequence.Ope = Zom(&rPrefix)
	rPrefix.Ope = Seq(Opt(Cho(&rAND, &rNOT)), &rSuffix)
	rSuffix.Ope = Seq(&rPrimary, Opt(Cho(&rQUESTION, &rSTAR, &rPLUS)))

	rPrimary.Ope = Cho(
		Seq(&rIgnore, &rIdentCont, &rArguments, Npd(&rLEFTARROW)),
		Seq(&rIgnore, &rIdentifier, Npd(Seq(Opt(&rParameters), &rLEFTARROW))),
		Seq(&rOPEN, &rExpression, &rCLOSE),
		Seq(&rBeginTok, &rExpression, &rEndTok),
		&rLiteral,
		&rClass,
		&rDOT)

	rIdentifier.Ope = Seq(&rIdentCont, &rSpacing)
	rIdentCont.Ope = Seq(&rIdentStart, Zom(&rIdentRest))
	rIdentStart.Ope = Cls("a-zA-Z_\x80-\xff%")
	rIdentRest.Ope = Cho(&rIdentStart, Cls("0-9"))

	rLiteral.Ope = Cho(
		Seq(Lit("'"), Tok(Zom(Seq(Npd(Lit("'")), &rChar))), Lit("'"), &rSpacing),
		Seq(Lit("\""), Tok(Zom(Seq(Npd(Lit("\"")), &rChar))), Lit("\""), &rSpacing))

	rClass.Ope = Seq(Lit("["), Tok(Zom(Seq(Npd(Lit("]")), &rRange))), Lit("]"), &rSpacing)

	rRange.Ope = Cho(Seq(&rChar, Lit("-"), &rChar), &rChar)
	rChar.Ope = Cho(
		Seq(Lit("\\"), Cls("nrtfv'\"[]\\")),
		Seq(Lit("\\"), Cls("0-3"), Cls("0-7"), Cls("0-7")),
		Seq(Lit("\\"), Cls("0-7"), Opt(Cls("0-7"))),
		Seq(Lit("\\x"), Cls("0-9a-fA-F"), Opt(Cls("0-9a-fA-F"))),
		Seq(Npd(Lit("\\")), Dot()))

	rLEFTARROW.Ope = Seq(Cho(Lit("<-"), Lit("←")), &rSpacing)
	rSLASH.Ope = Seq(Lit("/"), &rSpacing)
	rSLASH.Ignore = true
	rAND.Ope = Seq(Lit("&"), &rSpacing)
	rNOT.Ope = Seq(Lit("!"), &rSpacing)
	rQUESTION.Ope = Seq(Lit("?"), &rSpacing)
	rSTAR.Ope = Seq(Lit("*"), &rSpacing)
	rPLUS.Ope = Seq(Lit("+"), &rSpacing)
	rOPEN.Ope = Seq(Lit("("), &rSpacing)
	rOPEN.Ignore = true
	rCLOSE.Ope = Seq(Lit(")"), &rSpacing)
	rCLOSE.Ignore = true
	rDOT.Ope = Seq(Lit("."), &rSpacing)

	rSpacing.Ope = Zom(Cho(&rSpace, &rComment))
	rComment.Ope = Seq(Lit("#"), Zom(Seq(Npd(&rEndOfLine), Dot())), &rEndOfLine)
	rSpace.Ope = Cho(Lit(" "), Lit("\t"), &rEndOfLine)
	rEndOfLine.Ope = Cho(Lit("\r\n"), Lit("\n"), Lit("\r"))
	rEndOfFile.Ope = Npd(Dot())

	rBeginTok.Ope = Seq(Lit("<"), &rSpacing)
	rBeginTok.Ignore = true
	rEndTok.Ope = Seq(Lit(">"), &rSpacing)
	rEndTok.Ignore = true

	rIGNORE.Ope = Lit("~")
	rSEPARATOR.Ope = Seq(Lit("---"), &rSpacing)

	rIgnore.Ope = Opt(&rIGNORE)

	rParameters.Ope = Seq(&rOPEN, &rIdentifier, Zom(Seq(&rCOMMA, &rIdentifier)), &rCLOSE)
	rArguments.Ope = Seq(&rOPEN, &rExpression, Zom(Seq(&rCOMMA, &rExpression)), &rCLOSE)
	rCOMMA.Ope = Seq(Lit(","), &rSpacing)
	rCOMMA.Ignore = true

	rOption.Ope = Seq(&rIdentifier, &rASSIGN, &rOptionValue)
	rOptionComment.Ope = Seq(Zom(Cho(Lit(" "), Lit("\t"))), Cho(&rComment, &rEndOfLine))
	rOptionValue.Ope = Seq(Tok(Zom(Seq(Npd(&rOptionComment), Dot()))), &rOptionComment, &rSpacing)
	rASSIGN.Ope = Seq(Lit("="), &rSpacing)
	rSEPARATOR.Ope = Seq(Lit("---"), &rSpacing)

	// Setup actions
	rDefinition.Action = func(v *Values, d Any) (val Any, err error) {
		var ignore bool
		var name string
		var params []string
		var ope operator

		switch v.Choice {
		case 0: // Macro
			ignore = v.ToBool(0)
			name = v.ToStr(1)
			params = v.Vs[2].([]string)
			ope = v.ToOpe(4)
		case 1: // Rule
			ignore = v.ToBool(0)
			name = v.ToStr(1)
			ope = v.ToOpe(3)
		}

		data := d.(*data)
		_, ok := data.grammar[name]
		if ok {
			data.duplicates = append(data.duplicates, duplicate{name, v.Pos})
		} else {
			data.grammar[name] = &Rule{
				Ope:        ope,
				Name:       name,
				SS:         v.SS,
				Pos:        v.Pos,
				Ignore:     ignore,
				Parameters: params,
			}
			if len(data.start) == 0 {
				data.start = name
			}
		}
		return
	}

	rParameters.Action = func(v *Values, d Any) (val Any, err error) {
		var params []string
		for i := 0; i < len(v.Vs); i++ {
			params = append(params, v.ToStr(i))
		}
		val = params
		return
	}

	rArguments.Action = func(v *Values, d Any) (val Any, err error) {
		var exprs []operator
		for i := 0; i < len(v.Vs); i++ {
			exprs = append(exprs, v.ToOpe(i))
		}
		val = exprs
		return
	}

	rExpression.Action = func(v *Values, d Any) (val Any, err error) {
		if len(v.Vs) == 1 {
			val = v.ToOpe(0)
		} else {
			var opes []operator
			for i := 0; i < len(v.Vs); i++ {
				opes = append(opes, v.ToOpe(i))
			}
			val = Cho(opes...)
		}
		return
	}

	rSequence.Action = func(v *Values, d Any) (val Any, err error) {
		if len(v.Vs) == 1 {
			val = v.ToOpe(0)
		} else {
			var opes []operator
			for i := 0; i < len(v.Vs); i++ {
				opes = append(opes, v.ToOpe(i))
			}
			val = Seq(opes...)
		}
		return
	}

	rPrefix.Action = func(v *Values, d Any) (val Any, err error) {
		if len(v.Vs) == 1 {
			val = v.ToOpe(0)
		} else {
			tok := v.ToStr(0)
			ope := v.ToOpe(1)
			switch tok {
			case "&":
				val = Apd(ope)
			case "!":
				val = Npd(ope)
			}
		}
		return
	}

	rSuffix.Action = func(v *Values, d Any) (val Any, err error) {
		ope := v.ToOpe(0)
		if len(v.Vs) == 1 {
			val = ope
		} else {
			tok := v.ToStr(1)
			switch tok {
			case "?":
				val = Opt(ope)
			case "*":
				val = Zom(ope)
			case "+":
				val = Oom(ope)
			}
		}
		return
	}

	rPrimary.Action = func(v *Values, d Any) (val Any, err error) {
		switch v.Choice {
		case 0 /* Macro Reference */, 1: /* Reference */
			ignore := v.ToBool(0)
			ident := v.ToStr(1)

			var args []operator
			if v.Choice == 0 {
				args = v.Vs[2].([]operator)
			}

			if ignore {
				val = Ign(Ref(ident, args, v.Pos))
			} else {
				val = Ref(ident, args, v.Pos)
			}
		case 2: // Expression
			val = v.ToOpe(0)
		case 3: // TokenBoundary
			val = Tok(v.ToOpe(0))
		default:
			val = v.ToOpe(0)
		}
		return
	}

	rIdentCont.Action = func(v *Values, d Any) (Any, error) {
		return v.S, nil
	}

	rLiteral.Action = func(v *Values, d Any) (Any, error) {
		return Lit(resolveEscapeSequence(v.Ts[0].S)), nil
	}

	rClass.Action = func(v *Values, d Any) (Any, error) {
		return Cls(resolveEscapeSequence(v.Ts[0].S)), nil
	}

	rAND.Action = func(v *Values, d Any) (Any, error) {
		return v.S[:1], nil
	}
	rNOT.Action = func(v *Values, d Any) (Any, error) {
		return v.S[:1], nil
	}
	rQUESTION.Action = func(v *Values, d Any) (Any, error) {
		return v.S[:1], nil
	}
	rSTAR.Action = func(v *Values, d Any) (Any, error) {
		return v.S[:1], nil
	}
	rPLUS.Action = func(v *Values, d Any) (Any, error) {
		return v.S[:1], nil
	}

	rDOT.Action = func(v *Values, d Any) (Any, error) {
		return Dot(), nil
	}

	rIgnore.Action = func(v *Values, d Any) (val Any, err error) {
		val = len(v.Vs) != 0
		return
	}

	rOption.Action = func(v *Values, d Any) (val Any, err error) {
		options := d.(*data).options
		optName := v.ToStr(0)
		optVal := v.ToStr(2)
		options[optName] = append(options[optName], optVal)
		return
	}
	rOptionValue.Action = func(v *Values, d Any) (Any, error) {
		return v.Token(), nil
	}
}

func isHex(c byte) (v int, ok bool) {
	if '0' <= c && c <= '9' {
		v = int(c - '0')
		ok = true
	} else if 'a' <= c && c <= 'f' {
		v = int(c - 'a' + 10)
		ok = true
	} else if 'A' <= c && c <= 'F' {
		v = int(c - 'A' + 10)
		ok = true
	}
	return
}

func isDigit(c byte) (v int, ok bool) {
	if '0' <= c && c <= '9' {
		v = int(c - '0')
		ok = true
	}
	return
}

func parseHexNumber(s string, i int) (byte, int) {
	ret := 0
	for i < len(s) {
		val, ok := isHex(s[i])
		if !ok {
			break
		}
		ret = ret*16 + val
		i++
	}
	return byte(ret), i
}

func parseOctNumber(s string, i int) (byte, int) {
	ret := 0
	for i < len(s) {
		val, ok := isDigit(s[i])
		if !ok {
			break
		}
		ret = ret*8 + val
		i++
	}
	return byte(ret), i
}

func resolveEscapeSequence(s string) string {
	n := len(s)
	b := make([]byte, 0, n)

	i := 0
	for i < n {
		ch := s[i]
		if ch == '\\' {
			i++
			switch s[i] {
			case 'n':
				b = append(b, '\n')
				i++
			case 'r':
				b = append(b, '\r')
				i++
			case 't':
				b = append(b, '\t')
				i++
			case 'f':
				b = append(b, '\f')
				i++
			case 'v':
				b = append(b, '\v')
				i++
			case '\'':
				b = append(b, '\'')
				i++
			case '"':
				b = append(b, '"')
				i++
			case '[':
				b = append(b, '[')
				i++
			case ']':
				b = append(b, ']')
				i++
			case '\\':
				b = append(b, '\\')
				i++
			case 'x':
				ch, i = parseHexNumber(s, i+1)
				b = append(b, ch)
			default:
				ch, i = parseOctNumber(s, i)
				b = append(b, ch)
			}
		} else {
			b = append(b, ch)
			i++
		}
	}

	return string(b)
}

func getExpressionParsingOptions(options map[string][]string) (name string, info BinOpeInfo) {
	name = ""
	if vs, ok := options[OptExpressionRule]; ok {
		name = vs[0]
		// TODO: error handling
	}

	info = make(BinOpeInfo)
	if vs, ok := options[OptBinaryOperator]; ok {
		level := 1
		for _, s := range vs {
			flds := strings.Split(s, " ")
			// TODO: error handling
			assoc := assocNone
			for i, fld := range flds {
				switch i {
				case 0:
					switch fld {
					case "L":
						assoc = assocLeft
					case "R":
						assoc = assocRight
					default:
						// TODO: error handling
					}
				default:
					info[fld] = struct {
						level int
						assoc int
					}{level, assoc}
				}
			}
			level++
		}
	}

	return
}

// Parser
type Parser struct {
	Grammar     map[string]*Rule
	start       string
	TracerEnter func(name string, s string, v *Values, d Any, p int)
	TracerLeave func(name string, s string, v *Values, d Any, p int, l int)
}

func NewParser(s string) (p *Parser, err error) {
	return NewParserWithUserRules(s, nil)
}

func NewParserWithUserRules(s string, rules map[string]operator) (p *Parser, err error) {
	data := newData()

	_, _, err = rStart.Parse(s, data)
	if err != nil {
		return nil, err
	}

	// User provided rules
	for name, ope := range rules {
		ignore := false

		if len(name) > 0 && name[0] == '~' {
			ignore = true
			name = name[1:]
		}

		if len(name) > 0 {
			data.grammar[name] = &Rule{
				Ope:    ope,
				Name:   name,
				Ignore: ignore,
			}
		}
	}

	// Check duplicated definitions
	if len(data.duplicates) > 0 {
		err = &Error{}
		for _, dup := range data.duplicates {
			ln, col := lineInfo(s, dup.pos)
			msg := "'" + dup.name + "' is already defined."
			err.(*Error).Details = append(err.(*Error).Details, ErrorDetail{ln, col, msg})
		}
	}

	// Check missing definitions
	for _, r := range data.grammar {
		v := &referenceChecker{
			grammar:  data.grammar,
			params:   r.Parameters,
			errorPos: make(map[string]int),
			errorMsg: make(map[string]string),
		}
		r.accept(v)
		for name, pos := range v.errorPos {
			if err == nil {
				err = &Error{}
			}
			ln, col := lineInfo(s, pos)
			msg := v.errorMsg[name]
			err.(*Error).Details = append(err.(*Error).Details, ErrorDetail{ln, col, msg})
		}
	}

	if err != nil {
		return nil, err
	}

	// Link references
	for _, r := range data.grammar {
		v := &linkReferences{
			parameters: r.Parameters,
			grammar:    data.grammar,
		}
		r.accept(v)
	}

	// Check left recursion
	for name, r := range data.grammar {
		v := &detectLeftRecursion{
			pos:    -1,
			name:   name,
			params: r.Parameters,
			refs:   make(map[string]bool),
			done:   false,
		}
		r.accept(v)
		if v.pos != -1 {
			if err == nil {
				err = &Error{}
			}
			ln, col := lineInfo(s, v.pos)
			msg := "'" + name + "' is left recursive."
			err.(*Error).Details = append(err.(*Error).Details, ErrorDetail{ln, col, msg})
		}
	}

	if err != nil {
		return nil, err
	}

	// Automatic whitespace skipping
	if r, ok := data.grammar[WhitespceRuleName]; ok {
		data.grammar[data.start].WhitespaceOpe = Wsp(r)
	}

	// Word expression
	if r, ok := data.grammar[WordRuleName]; ok {
		data.grammar[data.start].WordOpe = r
	}

	p = &Parser{
		Grammar: data.grammar,
		start:   data.start,
	}

	// Setup expression parsing
	name, info := getExpressionParsingOptions(data.options)
	err = EnableExpressionParsing(p, name, info)

	return
}

func (p *Parser) Parse(s string, d Any) (err error) {
	_, err = p.ParseAndGetValue(s, d)
	return
}

func (p *Parser) ParseAndGetValue(s string, d Any) (val Any, err error) {
	r := p.Grammar[p.start]
	r.TracerEnter = p.TracerEnter
	r.TracerLeave = p.TracerLeave
	_, val, err = r.Parse(s, d)
	return
}
