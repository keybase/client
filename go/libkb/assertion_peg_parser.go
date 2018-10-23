package libkb

import (
	"fmt"

	peg "github.com/yhirose/go-peg"
)

type binOp struct {
	token string
	isAnd bool
	isOr  bool
}

func (a *AssertionOr) simplify() {
	newFactors := []AssertionExpression{}
	for _, v := range a.terms {
		if va, ok := v.(AssertionOr); ok {
			newFactors = append(newFactors, va.terms...)
		} else {
			newFactors = append(newFactors, v)
		}
	}
	a.terms = newFactors
}

func (a *AssertionAnd) simplify() {
	newFactors := []AssertionExpression{}
	for _, v := range a.factors {
		if va, ok := v.(AssertionAnd); ok {
			newFactors = append(newFactors, va.factors...)
		} else {
			newFactors = append(newFactors, v)
		}
	}
	a.factors = newFactors
}

func initPegParser(ctx AssertionContext) (*peg.Parser, error) {
	parser, err := peg.NewParser(`
		EXPR         ← ATOM (BINOP ATOM)*
		ATOM         ← _ ( URL / '(' EXPR ')' ) _

		BINOP        ← AND / OR

		AND          ← '+' / '&&'
		OR           ← ',' / '||'

		URL          ← AT_URL / COL_URL / NAME_URL

		AT_URL       ← NAME_STR '@' SERVICE_STR
		COL_URL      ← SERVICE_STR ':' '//'? NAME_STR
		NAME_URL     ← NAME_STR

		NAME_STR     ←  NAME_LONG / NAME_SIMPLE
		NAME_SIMPLE  ←  < [-_a-zA-Z0-9.]+ >
		NAME_LONG    ←  '(' < [-_a-zA-Z0-9.@+]+ > ')'
		SERVICE_STR  ←  < [a-zA-Z.]+ >

		~_           ← [ \t\n]*

		---
		# Expression parsing option
		%expr  = EXPR     # Rule to apply 'precedence climbing method' to
		%binop = L , ||   # Precedence level 1
		%binop = L + &&   # Precedence level 2
	`)
	if err != nil {
		return nil, err
	}

	g := parser.Grammar

	g["EXPR"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) {
		if len(v.Vs) != 3 {
			return nil, fmt.Errorf("Unexpected parsing action at EXPR, with %d tokens", len(v.Vs))
		}
		op := v.Vs[1].(binOp)
		if op.isAnd {
			ret := AssertionAnd{
				factors: []AssertionExpression{v.Vs[0].(AssertionExpression), v.Vs[2].(AssertionExpression)},
			}
			return ret, nil
		} else if op.isOr {
			ret := AssertionOr{
				symbol: op.token,
				terms:  []AssertionExpression{v.Vs[0].(AssertionExpression), v.Vs[2].(AssertionExpression)},
			}
			ret.simplify()
			return ret, nil
		}
		return nil, fmt.Errorf("Cannot parse expression %+v", v)
	}

	g["URL"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) {
		return v.Vs[0], nil
	}

	g["AT_URL"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) {
		return ParseAssertionURLKeyValue(ctx, v.ToStr(1), v.ToStr(0), false)
	}
	g["COL_URL"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) {
		return ParseAssertionURLKeyValue(ctx, v.ToStr(0), v.ToStr(1), false)
	}
	g["NAME_URL"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) {
		return ParseAssertionURLKeyValue(ctx, "keybase", v.ToStr(0), false)
	}

	g["AND"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) { return binOp{token: v.Token(), isAnd: true}, nil }
	g["OR"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) { return binOp{token: v.Token(), isOr: true}, nil }

	token := func(v *peg.Values, d peg.Any) (peg.Any, error) { return v.Token(), nil }

	g["NAME_SIMPLE"].Action = token
	g["NAME_LONG"].Action = token
	g["SERVICE_STR"].Action = token

	return parser, nil
}

func AssertionParse(ctx AssertionContext, s string) (AssertionExpression, error) {
	parser, err := initPegParser(ctx)
	if err != nil {
		return nil, err
	}
	ret, err := parser.ParseAndGetValue(s, nil)
	if err != nil {
		return nil, err
	}
	return ret.(AssertionExpression), nil
}

func AssertionParseAndOnly(ctx AssertionContext, s string) (AssertionExpression, error) {
	// TODO: This shouldn't work - we are not doing anything to ensure `AND` ONLY.

	// lexer := NewLexer(s)
	// parser := Parser{
	// 	lexer:   lexer,
	// 	err:     nil,
	// 	andOnly: true,
	// }
	// ret := parser.Parse(ctx)
	// return ret, parser.err

	return AssertionParse(ctx, s)
}
