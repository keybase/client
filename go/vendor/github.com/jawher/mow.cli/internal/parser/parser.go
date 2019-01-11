package parser

import (
	"fmt"

	"github.com/jawher/mow.cli/internal/container"
	"github.com/jawher/mow.cli/internal/fsm"
	"github.com/jawher/mow.cli/internal/lexer"
	"github.com/jawher/mow.cli/internal/matcher"
)

// Params are used to cofigure the parser
type Params struct {
	Spec       string
	Options    []*container.Container
	OptionsIdx map[string]*container.Container
	Args       []*container.Container
	ArgsIdx    map[string]*container.Container
}

// Parse transforms a slice of tokens into an FSM or returns an ParseError
func Parse(tokens []*lexer.Token, params Params) (*fsm.State, error) {
	p := &parser{
		spec:       params.Spec,
		options:    params.Options,
		optionsIdx: params.OptionsIdx,
		args:       params.Args,
		argsIdx:    params.ArgsIdx,
		tokens:     tokens,
	}
	return p.parse()
}

type parser struct {
	spec       string
	options    []*container.Container
	optionsIdx map[string]*container.Container
	args       []*container.Container
	argsIdx    map[string]*container.Container

	tokens []*lexer.Token

	tkpos int

	matchedToken *lexer.Token

	rejectOptions bool
}

func (p *parser) parse() (s *fsm.State, err error) {
	defer func() {
		if v := recover(); v != nil {
			pos := len(p.spec)
			if !p.eof() {
				pos = p.token().Pos
			}
			s = nil
			switch t, ok := v.(string); ok {
			case true:
				err = &lexer.ParseError{Input: p.spec, Msg: t, Pos: pos}
			default:
				panic(v)
			}
		}
	}()
	err = nil
	var e *fsm.State
	s, e = p.seq(false)
	if !p.eof() {
		s = nil
		err = &lexer.ParseError{Input: p.spec, Msg: "Unexpected input", Pos: p.token().Pos}
		return
	}

	e.Terminal = true
	s.Prepare()
	return
}

func (p *parser) seq(required bool) (*fsm.State, *fsm.State) {
	start := fsm.NewState()
	end := start

	appendComp := func(s, e *fsm.State) {
		for _, tr := range s.Transitions {
			end.T(tr.Matcher, tr.Next)
		}
		end = e
	}

	if required {
		s, e := p.choice()
		appendComp(s, e)
	}
	for p.canAtom() {
		s, e := p.choice()
		appendComp(s, e)
	}

	return start, end
}

func (p *parser) choice() (*fsm.State, *fsm.State) {
	start, end := fsm.NewState(), fsm.NewState()

	add := func(s, e *fsm.State) {
		start.T(matcher.NewShortcut(), s)
		e.T(matcher.NewShortcut(), end)
	}

	add(p.atom())
	for p.found(lexer.TTChoice) {
		add(p.atom())
	}
	return start, end
}

func (p *parser) atom() (*fsm.State, *fsm.State) {
	start := fsm.NewState()
	var end *fsm.State
	switch {
	case p.eof():
		panic("Unexpected end of input")
	case p.found(lexer.TTArg):
		name := p.matchedToken.Val
		arg, declared := p.argsIdx[name]
		if !declared {
			p.back()
			panic(fmt.Sprintf("Undeclared arg %s", name))
		}
		end = start.T(matcher.NewArg(arg), fsm.NewState())
	case p.found(lexer.TTOptions):
		if p.rejectOptions {
			p.back()
			panic("No options after --")
		}
		end = fsm.NewState()
		start.T(matcher.NewOptions(p.options, p.optionsIdx), end)
	case p.found(lexer.TTShortOpt):
		if p.rejectOptions {
			p.back()
			panic("No options after --")
		}
		name := p.matchedToken.Val
		opt, declared := p.optionsIdx[name]
		if !declared {
			p.back()
			panic(fmt.Sprintf("Undeclared option %s", name))
		}
		end = start.T(matcher.NewOpt(opt, p.optionsIdx), fsm.NewState())
		p.found(lexer.TTOptValue)
	case p.found(lexer.TTLongOpt):
		if p.rejectOptions {
			p.back()
			panic("No options after --")
		}
		name := p.matchedToken.Val
		opt, declared := p.optionsIdx[name]
		if !declared {
			p.back()
			panic(fmt.Sprintf("Undeclared option %s", name))
		}
		end = start.T(matcher.NewOpt(opt, p.optionsIdx), fsm.NewState())
		p.found(lexer.TTOptValue)
	case p.found(lexer.TTOptSeq):
		if p.rejectOptions {
			p.back()
			panic("No options after --")
		}
		end = fsm.NewState()
		sq := p.matchedToken.Val
		var opts []*container.Container
		for i := range sq {
			sn := sq[i : i+1]
			opt, declared := p.optionsIdx["-"+sn]
			if !declared {
				p.back()
				panic(fmt.Sprintf("Undeclared option -%s", sn))
			}
			opts = append(opts, opt)
		}
		start.T(matcher.NewOptions(opts, p.optionsIdx), end)
	case p.found(lexer.TTOpenPar):
		start, end = p.seq(true)
		p.expect(lexer.TTClosePar)
	case p.found(lexer.TTOpenSq):
		start, end = p.seq(true)
		start.T(matcher.NewShortcut(), end)
		p.expect(lexer.TTCloseSq)
	case p.found(lexer.TTDoubleDash):
		p.rejectOptions = true
		end = start.T(matcher.NewOptsEnd(), fsm.NewState())
		return start, end
	default:
		panic("Unexpected input: was expecting a command or a positional argument or an option")
	}
	if p.found(lexer.TTRep) {
		end.T(matcher.NewShortcut(), start)
	}
	return start, end
}

func (p *parser) canAtom() bool {
	switch {
	case p.is(lexer.TTArg):
		return true
	case p.is(lexer.TTOptions):
		return true
	case p.is(lexer.TTShortOpt):
		return true
	case p.is(lexer.TTLongOpt):
		return true
	case p.is(lexer.TTOptSeq):
		return true
	case p.is(lexer.TTOpenPar):
		return true
	case p.is(lexer.TTOpenSq):
		return true
	case p.is(lexer.TTDoubleDash):
		return true
	default:
		return false
	}
}

func (p *parser) found(t lexer.TokenType) bool {
	if p.is(t) {
		p.matchedToken = p.token()
		p.tkpos++
		return true
	}
	return false
}

func (p *parser) is(t lexer.TokenType) bool {
	if p.eof() {
		return false
	}
	return p.token().Typ == t
}

func (p *parser) expect(t lexer.TokenType) {
	if !p.found(t) {
		panic(fmt.Sprintf("Was expecting %v", t))
	}
}

func (p *parser) back() {
	p.tkpos--
}
func (p *parser) eof() bool {
	return p.tkpos >= len(p.tokens)
}

func (p *parser) token() *lexer.Token {
	if p.eof() {
		return nil
	}

	return p.tokens[p.tkpos]
}
