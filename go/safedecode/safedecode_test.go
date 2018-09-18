package safedecode

import (
	"bytes"
	"encoding/base64"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestRandomJSONParses(t *testing.T) {
	for i, s := range randomJSON {
		b, err := base64.StdEncoding.DecodeString(s)
		require.NoError(t, err)
		t.Logf("Trying %d %s", i, s)
		b2, err := MsgpackEnsureMaxDepth(bytes.NewBuffer(b), 6)
		require.NoError(t, err)
		require.True(t, bytes.Equal(b, b2))
	}
}

// This JSON blob:
// [true,false,0.44163874503333633,{"ydh6qNosy7N/nA==":{"1Kgn9j6bt89sew==":{"6TOPVG6Ej+e4eA==":["6Ed2ctjLxMFFscOD/4iWLv5YSAyercl+Vg==",true,"kwFfG7TO6Q1hQyTr8Qex2QA1iDIQcZvdvCuDBD0=",-11.293540478718846,null,-3414269694,null],"u1sofBcqpM54RQ==":-2.5527323646973734,"Vuz4QypxcKojyg==":false}},"ePH8V2n0bcxlWQ==":false,"+CidoEpxi07S9A==":true,"/8hke/8WPfTEng==":[true,true,[[-0.7219556299546915,"7s1IslXzcFFMCfRlwaRw5hwjeZm2IRHE5iOYiJRNGik3/7vVMSXnoXOwogk3KD4veCJote5V6Qb1Tgb8NKwgHHAnst6sk8uhuZJB66mSSBW3guGlzmYJOoR8QbyXZaB49jH9u989n3UwI9gChfXNW/i9Qvts6tvt2OcjurYoaWz+4YfrcnCL",-796628453,true,"S+AtFZIY2iOGaycOaNCnmmCR802GQBVfPNU8pDC81tF+ULpygxyTyQ+gv30egwY92OesR1B61NsY9Som3+G0MNRDP9lwIqmmusOxk5778wGVllhSyFm6xq+V6o8=",null,true],true,null,true,0.9852386316531293,4276708709,"n5UigUw7cHbM0TqetonVilz3+GZSGbQjJjZaGDl9spUaSQ==",[null,null,-3102616036,"wihjdjIE0ALRfTWDEQRCXnaMQCHFT4SV",false,false,null,1352257899,false]]],"gmJz64l7naR27A==":false,"3ya2rhQL43IfWw==":false,"nV6Y6Jx/2N8K2A==":1635951177,"KhrEbJo83tIspg==":2940949534},"gMwD8dXMR93jb+E2w2TVt2jqVRg5tN+DAQlm3iU8YH82/r/6v8brjYhH89woz5osD6uWRARR",[null,false,null,3968774720,"1Rczzv0DSGM68ocsSBcga9j4A3M0",1.3123809723524773,2907713849,["vKQEYjQ/r21Is9R+eFGBH6Xyg1IW//IJXWmy9kLXA2RD7rdcE+U0AcSq3lQbCDubcalorJMFcXJGbpnozuQunJtL63FqQvTYCcm8XQLJwdx+bB/BXg==",false,{"CeGVfxHZWEWWVw==":false,"OrxNQlu/J5tFXQ==":false,"s7f2M9WK6Hr35A==":null,"dfXCaPugQ3ACRg==":"TZY/PnI7SfWgzt2U9c7CUMRCmyEeMpSY+lGa9KX19C4C6eews+YysITynQvJ5X3BGkKwJ6NXvRuJiocD/JOyPoVS+vGY0XKbAPqye8o97npyAgXSRKp+ghqpqsH23w1Ivj4wgnMgIztZ44pnMC+/iQMyPBcEN+BY+iADvc6Vw77M2snTcN2JVjJ96qYR+mTt","rlH6sG+fz51h2A==":0.32923778921332963},false,1.0601517954899342,false,false,true],null],false,-484148683]
func TestRandomJSONFailsDepthTest(t *testing.T) {
	b, err := base64.StdEncoding.DecodeString(randomJSON[11])
	require.NoError(t, err)
	_, err = MsgpackEnsureMaxDepth(bytes.NewBuffer(b), 4)
	require.Error(t, err)
	require.Equal(t, err, MaxDepthError)
}

func TestEvilMsgpackOpenOpenEtc(t *testing.T) {
	var b []byte
	n := 10000
	for i := 0; i < n; i++ {
		b = append(b, 0x91)
	}
	b = append(b, 0x03)
	b2, err := MsgpackEnsureMaxDepth(bytes.NewBuffer(b), n)
	require.NoError(t, err)
	require.Equal(t, b, b2)
	_, err = MsgpackEnsureMaxDepth(bytes.NewBuffer(b), n-1)
	require.Error(t, err)
	require.Equal(t, err, MaxDepthError)

}
