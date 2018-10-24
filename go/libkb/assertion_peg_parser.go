package libkb

import (
	"fmt"
	"strings"

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
		return nil, fmt.Errorf("don't know how to parse %+v", v)
	}

	g["URL"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) {
		return v.Vs[0], nil
	}

	g["AT_URL"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) {
		key := strings.ToLower(v.ToStr(1))
		return makeAssertionURLFromKeyAndVal(key, v.ToStr(0)), nil
	}
	g["COL_URL"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) {
		key := strings.ToLower(v.ToStr(0))
		return makeAssertionURLFromKeyAndVal(key, v.ToStr(1)), nil
	}
	g["NAME_URL"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) {
		return makeAssertionURLFromKeyAndVal("keybase", v.ToStr(0)), nil
	}

	g["AND"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) { return binOp{token: v.Token(), isAnd: true}, nil }
	g["OR"].Action = func(v *peg.Values, d peg.Any) (peg.Any, error) { return binOp{token: v.Token(), isOr: true}, nil }

	token := func(v *peg.Values, d peg.Any) (peg.Any, error) { return v.Token(), nil }

	g["NAME_SIMPLE"].Action = token
	g["NAME_LONG"].Action = token
	g["SERVICE_STR"].Action = token

	return parser, nil
}

func normalizeExpressionTree(ctx AssertionContext, expr AssertionExpression) (ret AssertionExpression, err error) {
	switch e := expr.(type) {
	case AssertionOr:
		for i, v := range e.terms {
			e.terms[i], err = normalizeExpressionTree(ctx, v)
			if err != nil {
				return nil, err
			}
		}
		return e, nil
	case AssertionAnd:
		for i, v := range e.factors {
			e.factors[i], err = normalizeExpressionTree(ctx, v)
			if err != nil {
				return nil, err
			}
		}
		return e, nil
	case AssertionURL:
		return e.CheckAndNormalize(ctx)
	default:
		return nil, fmt.Errorf("don't know how to normalize %T", e)
	}
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
	expr := ret.(AssertionExpression)
	return normalizeExpressionTree(ctx, expr)
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
