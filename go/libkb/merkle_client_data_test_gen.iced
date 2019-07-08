{createHash} = require 'crypto'


this_root = """{"body":{"kbfs":{"private":{"root":null,"version":null},"public":{"root":null,"version":null}},"key":{"fingerprint":"a05161510ee696601ba0ec7b3fd53b4871528cef","key_id":"3FD53B4871528CEF"},"legacy_uid_root":"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514","prev":"90c8d16b5dcb45007c2493e0cddaf7bb0fbb13dd7be6def7f828e3289b77ccabf519c0a4e0d8aff4f4f8708fa2be747521afe3c4914a553269623394012b4f93","root":"be29c002c1adc95cb265d7d757bb5a967dc90991b14b1080b58738d905659420380202a9e85b392ed456cd01f5554887a2477aec9544696c47dd3ad3035dea7d","seqno":45155,"skips":{"12387":"59b2bf232d02cdff583c5ac76d0c7ff2a1976fb4d501d1e6e7f783606984546b","28771":"4105505dcad1e06da2509b16d2d0a112df9a3499a170a1e620db1a1e6b4c119b","36963":"791bb758b7c7ccdfda94c24b79b8b189ba94f8b87c6e5a64d1d4cd0bb5443433","41059":"9a4cc8dee5af580ba83a256ff9ffddecc1faec64478defb6d198f70ed1c38d2d","43107":"b42b3e5c8bda17b4ee9f8b5a2778aa15b0986afa273df5d1ce27d21be91aeae8","44131":"87a87076d1dcb5c5d2d6cc58bb1a416f6c22cc9a89344cd93f6bfd1ed7108463","44643":"6c843c9f1808b0d109a9cdd1a14d23361a37af9ef6716a65da43cee61659eb80","44899":"a71394af0e700ec224673ca11f0e2477b0919f670585dbf7a10ea2c712b9bd62","45027":"ec6cb8c311836c057814032a6a54708af1cdc5a5d2725795c70ac5a520ca3e14","45091":"7c5aab6e0e6c021d10f5eb0f0f18b6a382fb550a8c4cee252cd6746053be59b7","45123":"4d2e89b5f189df0765430a7fdde9da8919781d8aaa06e18a14a5a6dfa58668c7","45139":"36d2d76bf559df15f842d57512877839bcf799145364e4ad13de7fc825660095","45147":"1f2ca5915aa36733862c228a08f7bd5f49668dcfa9c8e0e3fd1459f1e7a25286","45151":"9338984afc1ca14f0dd7a495b1deffebeb8f2b9e3fee22c63d94d33b9448107d","45153":"036370cb80a8600822ef8537dc1ddf1397a78e1dad0f6dd0ff18ddc7e7dc4d42","45154":"e5545f5afee216e8aba49cfe2c2e11d5ed5ad55916f4c11b61f8f7036d476fb1"},"txid":"6821210bf0046b1a245058be35fdc215","type":"merkle_root","version":1},"ctime":1484195166,"tag":"signature"}"""
skips = [
  "{\"body\":{\"kbfs\":{\"private\":{\"root\":null,\"version\":null},\"public\":{\"root\":null,\"version\":null}},\"key\":{\"fingerprint\":\"a05161510ee696601ba0ec7b3fd53b4871528cef\",\"key_id\":\"3FD53B4871528CEF\"},\"legacy_uid_root\":\"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514\",\"prev\":\"913a676e1c6845c6c71aa766e135f53e2dcaedef2dac81fbe79161beefdd545b6b25a987df7a08d67e252674b8337b158d5e56a6051851b0b205791dca34b2a1\",\"root\":\"87857b6c6b9065adc3b0a8dc3a4d224fcd6651644e2644ff5412e5a537a547c25e58b1fb57d440c41841ea1994ff1d678ffc8a2508889cd77a0250fe88ecbc4c\",\"seqno\":45027,\"skips\":{\"12259\":\"16b6b167b19a0333940d1429d8c2819f4f69c64de3cc563c296929585862abbb\",\"28643\":\"5901023a13f9ee846d14cdb2bd80ad6e0315b0b3c9d1c30951eaa179f5e5e553\",\"36835\":\"12e59616e60b0a31df16f1c0dd42b343fed317cb3826663434b95ed70c9ce413\",\"40931\":\"61c4bfc27ef86bf6a1b69516c76f22f359096db3d2f6a50236405ca9d476c76b\",\"42979\":\"df4139faf9ec15ccd6692e77716ffa5498877ddb4600905e4d9d5b995816ab59\",\"44003\":\"b8119b2ad253ca8bd4ef5b8b105a75d5bd2670bf7f329ee6292f232facc75c6c\",\"44515\":\"5bc355621ed946d97ca088ebfa6442a1d0b816b7c9e10d68feec7ad82f1962e4\",\"44771\":\"9ff647cfd937eb8a248583e2f21faf54d8b3ff28e73f4b2cd09b6413acc3e8e8\",\"44899\":\"a71394af0e700ec224673ca11f0e2477b0919f670585dbf7a10ea2c712b9bd62\",\"44963\":\"42601caec7733ae9af22fb7315b63ae1988fba53491f2cb2f7d082054b6969b3\",\"44995\":\"30b315079494262af32a525ef7bd2e13464f6d15fec73d67113a946700eaa83f\",\"45011\":\"85573714a9f6b8896189d9809f4c1a2022df26f940ad066e6f87eeb66e58569d\",\"45019\":\"5a9f3ae6afa476955e8e244bef89b6bf25313a78a697606dcb1e486cfaaafa56\",\"45023\":\"7416f2ffa3a661ca6ad2d2e60004e0004fd74abe0122779e6d139f0d947cf680\",\"45025\":\"863010a494ef7439a757459b45c0a798b83fe798ccaa480eb9e3d63160595902\",\"45026\":\"1481e8f25483a6cd0b804a1ac154634659d60ee16931d847e743b0f05d9562d5\"},\"txid\":\"aad8f8e8ccb9ef5c2f03b77d5aa4ee15\",\"type\":\"merkle_root\",\"version\":1},\"ctime\":1483925594,\"tag\":\"signature\"}",
  "{\"body\":{\"kbfs\":{\"private\":{\"root\":null,\"version\":null},\"public\":{\"root\":null,\"version\":null}},\"key\":{\"fingerprint\":\"a05161510ee696601ba0ec7b3fd53b4871528cef\",\"key_id\":\"3FD53B4871528CEF\"},\"legacy_uid_root\":\"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514\",\"prev\":\"c7c8adce0ecce7bfa8ded046c1b909dfc6b5e85aa5492f5684c3913885f697c88ef93d69a2de458cc52f1a32a4bb987f3f1ec7674dcb04d3eb16a70a7cd558a3\",\"root\":\"40269f3ba5b239d7d550a3686485b5d1c1e3b7b66e46f8ffbc5941acbda08ac31046e43e1afa6af6499dde806db84a1d2207839ff60df94adf1f5c729fcbd283\",\"seqno\":44963,\"skips\":{\"12195\":\"fa8a07710fd7ae95244e914f5fec5a64c4b5dc75bfa490032e671bb0900afa64\",\"28579\":\"10f211842cafa8665c5891283dae2061c379bc8a009eea495e7cd86bb658ed43\",\"36771\":\"5633f3cbb4ec30f332e818a90ce9566d6dc9c0979380cb37e146901fe02cc826\",\"40867\":\"d7d2657cf1f1f67ab9b5124a7d88cda7060d742a06472cbacb2c5542a99f7e42\",\"42915\":\"fb35d1a49df01c10acf27abd7f506298b7f0906a7651006f4067a33f37a457b6\",\"43939\":\"e5e49ab863802d896e29d50fad18675a43cd13b2119074a6da2b2c341e50b3a1\",\"44451\":\"67b8a059de9c3764e25c672ed836f4051d1ee05b3e2d32a5426d90966f662423\",\"44707\":\"4e4d2be19a8f23989f3b13d22a36248ef60c35c3f533fc69d41f27a8338d6dfd\",\"44835\":\"e889e3e73d082eedfc648c366b32fbda016fa7e767aea6584755eea9c91f53ec\",\"44899\":\"a71394af0e700ec224673ca11f0e2477b0919f670585dbf7a10ea2c712b9bd62\",\"44931\":\"ba6b695ba41fa784eabac715a794733897fa85220f03d887fc9f642eae335001\",\"44947\":\"bddcb8fe96643c43be8a949cb2d4374fa39ceb8018640f429e6477a18ec018a9\",\"44955\":\"8facfa042dcc1abf91d9ce388c3e53ab4ae9e54730bfb9b2b65b2eb92239055c\",\"44959\":\"dcac06ae875f8d355a8503af2fdde13f09b301fabe466dbd18222c666fac99df\",\"44961\":\"983317c90217a717cafae1805bf3a04edcca8bf23f73c0a65ade774c1a98771f\",\"44962\":\"085d624e5e645317087de0181c8b4b3da7a47519dd7e44de78eb834ef1468ee4\"},\"txid\":\"a7ac7bb642f04e4a4db0b060ff2ede15\",\"type\":\"merkle_root\",\"version\":1},\"ctime\":1483925033,\"tag\":\"signature\"}",
  "{\"body\":{\"kbfs\":{\"private\":{\"root\":null,\"version\":null},\"public\":{\"root\":null,\"version\":null}},\"key\":{\"fingerprint\":\"a05161510ee696601ba0ec7b3fd53b4871528cef\",\"key_id\":\"3FD53B4871528CEF\"},\"legacy_uid_root\":\"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514\",\"prev\":\"4fe204d1bf8f8aed90452e44f1a2fca732243dfa70771a6392b23c241061a023d37e1aca6e1e1a61846cef230614e64dc8f0dcc189fcdd0763f80b8f77dadda1\",\"proof_of_existence\":\"1fdda3b36bfc82e9da378a8a32a3294e83052cd42587b0136bf15d5a8baab9af2948750deec426907e2260eb33fe713a926aebed88d73d60582ff605f2fd910a\",\"root\":\"45186bd219d1568c90b121caef6612f7551c2ea07838e469e53761bad8572f964b8f35663ab2dba8dc6c2a7aecb32d4509e7dab61e53a4f83d9caeecbf056021\",\"seqno\":44931,\"skips\":{\"12163\":\"f6170eee7268823dbb72e79ecc266f52655eced7c01708093095da4e0783df4b\",\"28547\":\"0814a562ad4429068e49a1acf3db8f23107f7b4d0986f2bb322595d908334df4\",\"36739\":\"b143b6faa40e28a0d7987c4989d5ee1e73aa88697e86c9bcecec4f15e48a231c\",\"40835\":\"e0f023fc20362ee8ad31fb1662b26e99f2889093de78c43a92007a14780133b1\",\"42883\":\"c50deb329a83cba4ac64585445a5e87e7ceacd364639fe6d6f4403fdcab26689\",\"43907\":\"187f1b64a690f82a2a4104f674f1f43430b76d40da115bf48c2e313582381d16\",\"44419\":\"6165f87b2da1f27ca98129e1e74d3f651559848851481110c5bb3f85311e1565\",\"44675\":\"c0fde18793e162ba9ca28805501f599b96c8e78ce0176be1fa31f4da5d2adb20\",\"44803\":\"bccf72811c0c96840468c9784b9eea658ca50203de615746cb2deb3b6552d594\",\"44867\":\"bf547928a37e640d6e70346014c6d6744340794f359edb0e86cb02e368675790\",\"44899\":\"a71394af0e700ec224673ca11f0e2477b0919f670585dbf7a10ea2c712b9bd62\",\"44915\":\"0bd3547f56d82fd33ce81c792e50cab535bf1c0dae740992ec6fa4994db7386c\",\"44923\":\"8df18ecce853dad967279a1e5b8682224f85962d498e65c7588cab78353f8030\",\"44927\":\"3e74c30b11d992ea4c0c331dd4de8c5e463cedf7094a73ba6fa435923aacb45e\",\"44929\":\"1230511ab3571d9c4eb1c89f5e52855fdef8609a9622535d35119b60db5e6193\",\"44930\":\"c607cdbce82a653179bdc80f6f67f6d0d8c7d05ca4651740c55c09f60ea50ca6\"},\"txid\":\"5961cb083d63882a61a132e924bfc915\",\"type\":\"merkle_root\",\"version\":1},\"ctime\":1483924877,\"tag\":\"signature\"}",
  "{\"body\":{\"kbfs\":{\"private\":{\"root\":null,\"version\":null},\"public\":{\"root\":null,\"version\":null}},\"key\":{\"fingerprint\":\"a05161510ee696601ba0ec7b3fd53b4871528cef\",\"key_id\":\"3FD53B4871528CEF\"},\"legacy_uid_root\":\"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514\",\"prev\":\"f89c78dd9d9205436a3119b405e5268fa2333b7857cf9fa5f472428a590562a5be113144a1de329a6838e5a7283ed5ace53ba5937bd2614850a302ac4917eb95\",\"root\":\"f04427253cbe5407cde2d5fdf676a4269063f9ac080dd6874d7cc7cf7aa1b6ba07b9430262577da84bb80439c9203364c401a979e7e30fe3a42de2c1b5f82192\",\"seqno\":44915,\"skips\":{\"12147\":\"5b6b152ce124c92e193b09ea56cfe0ba975083bcecbc54ef3d6243b98ef63225\",\"28531\":\"752ee7d8e78c48f310d5cfeeedcfaaa4a231979d9bbed1b46140e828ffa75360\",\"36723\":\"f866bb75bec608a4e485dedcb592a1a9213698518e77cda6b5c9af8e04330e6c\",\"40819\":\"b675c8e5138dbef261a4fb98c034ff3c0733144880514ce054650725eed7cee6\",\"42867\":\"28c5f40c6949d293e2a2a33281987cdc48363c87ff2266d6a0323395a318304f\",\"43891\":\"9e125058479fa81e176caffee4021ce2d2e066ba9cbbb9f689fa8f2360029ed5\",\"44403\":\"f1ab980b0052e92a8ce05a8a06f8ffd87b49e70dbfba43c8d5b80d52876404ac\",\"44659\":\"4d205727c20d313f29f61694b485dafa798f7ba0cb961414aadbcc3dcf4cd20f\",\"44787\":\"ba587efc9c6d442be7320e33f693802f9e7bc668fba276bf697c6c6bd57f185a\",\"44851\":\"d255df40da2f66b0b51c278ab31b3103a2c0dd2abb26e8ffc4d4b1d5860b7aff\",\"44883\":\"74568b04b24e612b3dff3079ac584f3979e8836a6ed0003802892b6cabfd11b8\",\"44899\":\"a71394af0e700ec224673ca11f0e2477b0919f670585dbf7a10ea2c712b9bd62\",\"44907\":\"74d844e163abd47c781ea08c2e2d229726f5321b9ad614d9cf4ee266cfd35c8d\",\"44911\":\"cf36aa0c74ba457788aa97878736add0e6ca41684135abd14fd8436c78619023\",\"44913\":\"628c248a2930f25ac9a5912e61d44ee3d943b8ba3f23ec8e701b2ef7ea78fc5a\",\"44914\":\"15772a3cb466500c09e392c7472b5cd87f89c4cef3785fd2a95d00a6b099044b\"},\"txid\":\"baabdc3fc2c2bcc393f02a4d0a081715\",\"type\":\"merkle_root\",\"version\":1},\"ctime\":1483924341,\"tag\":\"signature\"}",
  "{\"body\":{\"kbfs\":{\"private\":{\"root\":null,\"version\":null},\"public\":{\"root\":null,\"version\":null}},\"key\":{\"fingerprint\":\"a05161510ee696601ba0ec7b3fd53b4871528cef\",\"key_id\":\"3FD53B4871528CEF\"},\"legacy_uid_root\":\"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514\",\"prev\":\"ba26c78b25a60de52c30c0a0eba50fce47b868384d5dee2688268b2016eabf0f26b749a50057617a5a24494ba0580743d19ea3b00d286ccb756caec04cd90020\",\"root\":\"4b62abd81f1267baf3c93a18141534a1ac66e89d43713f56ceddf13565192db30403e2e8d3201003506a45e3ec44250836b4376fe1f3e15cf466e880665f3cbe\",\"seqno\":44907,\"skips\":{\"12139\":\"8fb422cd03d0c3f9e7fb1755463f323f266a23b530abfdd2d9b75ce940dc1464\",\"28523\":\"ebb509e51af14c9c0edd7ebdbc2c0a9ee1e8f84f7fbb69554a8096a127e3e66f\",\"36715\":\"8f38e0072742b6e87efd129993f1cf752ce8cafdb8e8a58f1b1eeb5be1fddbad\",\"40811\":\"c7d9bae9f55f7a500f59c3a8f539ca126482fc51697b054cb9ada23af2d5b128\",\"42859\":\"8c1a160cb37165e8e88c52a3602f7695cdc77122d37c91329efb0b559ce40646\",\"43883\":\"4c7947baa96ea4aadddea24b9a141c22847617665186260cd59fc1008ca0fa67\",\"44395\":\"2e5d77b1a2a00d37906d70c0b489cbec00f4daf50b1dd94876f3db2f05f5b82b\",\"44651\":\"c30ac1b33640e772e494c1e67c72857891ec4620d6436c15d8315df6f077e514\",\"44779\":\"0f7ca5004cb89bdf7f46e58d4e8e0a66693a09824f92488d8c49cd416e2b5f20\",\"44843\":\"402329f077e519eb9c13a192af62c4fc7f568a01a461fb277791f5e847bf2154\",\"44875\":\"33062062d547350ca17bd11e03f3d137204584cd1a0258b826df9ddf933de837\",\"44891\":\"3f11bf72118c17ec978dc1cba6b48a354dc746e9afb9296e9b58f492632e16cb\",\"44899\":\"a71394af0e700ec224673ca11f0e2477b0919f670585dbf7a10ea2c712b9bd62\",\"44903\":\"d0859904a4d786ee52ebb118c26fda7f4a7d435101d44202bda7e5baadc1b8be\",\"44905\":\"100533babe58221e29796a6940f756100dcf919381b42d4b862f8ba13e9d7960\",\"44906\":\"c4c6f8573689880c0d7d60d18a0297efdb6a3d6a85bace368b5529b016323289\"},\"txid\":\"bad5e50e8cd2ad3af5a15cbc626e8815\",\"type\":\"merkle_root\",\"version\":1},\"ctime\":1483924340,\"tag\":\"signature\"}",
  "{\"body\":{\"kbfs\":{\"private\":{\"root\":null,\"version\":null},\"public\":{\"root\":null,\"version\":null}},\"key\":{\"fingerprint\":\"a05161510ee696601ba0ec7b3fd53b4871528cef\",\"key_id\":\"3FD53B4871528CEF\"},\"legacy_uid_root\":\"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514\",\"prev\":\"199dc519200616994f84c5fba6c5faa0925c991c7d91a1d4789ccc756477e2211521ac9983b29e263aad640ceb2535875f49565caaa7ea34769aea517b5e4da5\",\"root\":\"2355536e5ce5a7b8788935a6957757b043b113be7c02ff793ad55d8b9bed4f8498cd96668d9aedf11c11310cdf9076fe74db6a43e9701ae069022948f92dde96\",\"seqno\":44903,\"skips\":{\"12135\":\"60e979958ea129e71a89e143b35cdd9aff5561784e9b25287ef038755d3ef180\",\"28519\":\"12ecac3c07e1d535cf09ff5cad096e5c91838e747399fd5980e2adfa41745c2c\",\"36711\":\"09b002aec380d4dbf1119d40b7c1b844f705a129aeebb51881225dcbb183884b\",\"40807\":\"0da9f7af681b1d400972fd081765e050777bb1eba03cc62a06f6a5abeacf9c3d\",\"42855\":\"9273d77061b1d457180cfdf3689d420f164f8dbd53a6d0f55aafdb4d2db3ec1f\",\"43879\":\"9e4fc660490a2ab7109437b315cf91e2275d98795c6fe6220c429b2f701df0bf\",\"44391\":\"49c52cce44432313297e9b10d24db6d30fd5953610af476eb57a32d82038650e\",\"44647\":\"0ba854af71322f87a2cf41110becffaf3c342139f5b26b55389a43d752f17430\",\"44775\":\"9db433beb76b6168827e6396639818e51b303de3482b1fe182b1435d3a0d52b4\",\"44839\":\"68d74439b77268ffdbcd5a1c1c4e8b0d645695a215caca4036da5d7f7c60e9bd\",\"44871\":\"44ee2cd2b47b5dc94f22cb1a0ea8c03d26a7d2c62d518764025548a802b2543f\",\"44887\":\"2bc196367acb36473fd606714779b63c628834fe30c3b32e3ea7edbffe4afede\",\"44895\":\"e030fea2bfada450710b80eb2ec3605d61eea94fa8cdcdfac0c930cf0621f329\",\"44899\":\"a71394af0e700ec224673ca11f0e2477b0919f670585dbf7a10ea2c712b9bd62\",\"44901\":\"f9aad2d3e86f7942812d6f85790873e75518bad842adb734d388bb169b2bcf05\",\"44902\":\"68201cd4a10012da898703b40447417cf859fb436af0172e48ed67c64194f70e\"},\"txid\":\"59261288a8b5d886b10f41bd0eda7a15\",\"type\":\"merkle_root\",\"version\":1},\"ctime\":1483924339,\"tag\":\"signature\"}",
  "{\"body\":{\"kbfs\":{\"private\":{\"root\":null,\"version\":null},\"public\":{\"root\":null,\"version\":null}},\"key\":{\"fingerprint\":\"a05161510ee696601ba0ec7b3fd53b4871528cef\",\"key_id\":\"3FD53B4871528CEF\"},\"legacy_uid_root\":\"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514\",\"prev\":\"19eaf95cd46da0387dfa25a2d5e705b20121616869d66b90d13fff62c74f9af5cf41aec58ee10918466a5d216d8e9830aea232e063ee84274fd149f54f0f20b9\",\"root\":\"f22199c2b7d816e92f2eff940d340261af83861bce133d1790d70d5707f9b4ee0efd93f8375497f891c537530e5de7e523b0219a095b942679fb3e5bfdb8b006\",\"seqno\":44901,\"skips\":{\"12133\":\"2bc8670d2f7dd6a8559f94ab4cb79ea90202ef195e6fc124802de2458b2a55aa\",\"28517\":\"e72977e054504494149055bfdb4522b9b553571a2a97c71fd7b5ae78b8ce2605\",\"36709\":\"f8df659814077b760bd1ba2526ea1200adda03da7de762f4ce33c8aec9e086f0\",\"40805\":\"2ddebc3b323472795eb5595b81f960ed1e33e160505ce2c6b99c57c20f982729\",\"42853\":\"817047b32e476d6f66c3c5a3ee1c3eeab5b86030faa439f62bfdec2280a03ec8\",\"43877\":\"cfd49fce69f2a40e397f7a7e9b757f98c7413b89e61845381fde898edfe2d237\",\"44389\":\"0acbbca654d9f10c187094c4a1f81c8ae0f13b1acd5058958ceeb15e056dfcbb\",\"44645\":\"7038e5ef44282cfee2ace94874218082e408d16e12da87d5e23ee41525d564c4\",\"44773\":\"34ddfdcb2f7c7e2deace1955a1d5293113dc2e4f3f0682c7c162413d832c8e73\",\"44837\":\"cc9ae3a36cd92325abf47aa7fac20d46ec6818b065846fe6f617f7d9df8effee\",\"44869\":\"67de93f8db1f2a9b6a77cf9c86e6a35fe81928ec66343d66b12ab4cb640cca43\",\"44885\":\"4c7d4c9147eb8d1c1e6e31bf4acedc9b9acc3fe5ec3d1836a9ada669b069afa0\",\"44893\":\"596a0a0a9fed230351a1a71e1b026b326b2c4809cac71bc296dd7026f8543524\",\"44897\":\"a56fb3799e5961bf323b9981354c6a14f8973b8045ee82218681a34368f907b5\",\"44899\":\"a71394af0e700ec224673ca11f0e2477b0919f670585dbf7a10ea2c712b9bd62\",\"44900\":\"e58b1d67f7ad558645d419decc5677fe6a17ff91cde4b662b7ebce29e554dbb7\"},\"txid\":\"bae6ef60cab6b6bb9185a49cc5218f15\",\"type\":\"merkle_root\",\"version\":1},\"ctime\":1483924339,\"tag\":\"signature\"}"
]
last_root = """{"body":{"kbfs":{"private":{"root":null,"version":null},"public":{"root":null,"version":null}},"key":{"fingerprint":"a05161510ee696601ba0ec7b3fd53b4871528cef","key_id":"3FD53B4871528CEF"},"legacy_uid_root":"75ac465f4cef9a32e593692c4c2db371401ed2cd7781b74a8210b49da116c514","prev":"bf9dbaf6edadb64aef7d8bcad8f296ff7b5e9e183465de67888e256f09e29cb7526273732be031d9e0aa8940613a94aba9e9a5db5abfa9bce0a2917c1f645fe4","proof_of_existence":"1d7238a3ed24001abb6b7f14d7969d028f04f203c5a5cc8d802b99587405d759270638977a17444928a4e3ff477be2da0ac7dee5bfbd48a7b67045354c503e4e","root":"19eaf95cd46da0387dfa25a2d5e705b20121616869d66b90d13fff62c74f9af5cf41aec58ee10918466a5d216d8e9830aea232e063ee84274fd149f54f0f20b9","seqno":44900,"skips":{"12132":"ed854276ded7789851ec940196390e755bcf998015101f7dcca45e5d8982da15","28516":"d7dd45b04a211bc4cc932ce9410b52f6f805d53cffa74e5f1c22a86ca88a085b","36708":"1cc9f994bfb5035c2c039f0f0337440e1384b07fa28bbba825589dadfe6a4b11","40804":"392a7f26ba87d236ac337e397b6e73598c03c5f1a77786297ca4d719acecb50a","42852":"c2cc1e726d38c3c00e7879a279c5646b6d738e21efb9c37292b3ef5986ce5c1d","43876":"d3ab90a6bec4cc416fc0bf0982685d246ac3ab7d17f501a644c54b2338ff350f","44388":"0e40761cf6aa4e431772a3f1d7a176554ce25e9e449b2a3dc8229581eda4b43c","44644":"99ebbe4e7fda50fc574cfec0d00defa096bf5617b5a393ceb9671cc660a1f7c8","44772":"142c81c01fdd0f00b84a3655dbab7ce409383c5908050499efb041cbe173380a","44836":"a5d1e761a833d0f1a66bd8ab532cc38b54c127e0fc912a4fe6b0f8386a89c4a5","44868":"7f55664e01e306a137f0bc92047a44827a08893d2791c1bc1b1bcf0952af2e14","44884":"a711322666035129de40ab34ac0bec09720dba17f335f5e6e5a2a3d152d88521","44892":"a0d37e5b83a7eb9ebdd21a421005173a5430fc65379c292334e8302648ba7261","44896":"5fc651033759a5f27de5f9d9aa67b00bc1a3fc96b59f206fe91918b4d325cf47","44898":"9540343b0b29c8e488551bdd625db1ba7e0596ce3d1d94ffaf153e414bef66d3","44899":"a71394af0e700ec224673ca11f0e2477b0919f670585dbf7a10ea2c712b9bd62"},"txid":"77c23799aa4c1f42274ffe675a19b715","type":"merkle_root","version":1},"ctime":1483924338,"tag":"signature"}"""
raw = [ this_root ].concat(skips).concat([ last_root ])

console.log """
//
// DO NOT EDIT -- This file is autogenerated -- DO NOT EDIT
//
//   To regenerate, run:
//
//      iced3 merkle_client_data_test_gen.iced > merkle_client_data_test.go && go fmt .
//
// DO NOT EDIT --- DO NOT EDIT
//

"""
console.log "package libkb"
console.log ""
console.log 'import "github.com/keybase/client/go/protocol/keybase1"'
console.log ""
console.log "var merkleSkipTestVectors = []struct{"
console.log "\tname string"
console.log "\te merkleClientErrorType"
console.log "\tdata []string"
console.log "}{"

output = (name, e, data) ->
  console.log "\t{ #{JSON.stringify name}, merkleError#{e}, []string{"
  for row in data
    console.log "\t\t", JSON.stringify(row), ","
  console.log "\t\t},"
  console.log "\t},"

swap = (v, i, j) ->
  tmp = v[i]
  v[i] = v[j]
  v[j] = tmp

make_copy = () -> [].concat raw

sha256 = (x) -> createHash('sha256').update(x).digest('hex')

recompute_skips = (json) ->
  tab = {}
  for j in json by -1
    for seqno,hash of j.body.skips when (x = tab[seqno])?
      j.body.skips[seqno] = x
    tab[j.body.seqno] = sha256 JSON.stringify j
  json

clock_drift_one = (roots) ->
  json = (JSON.parse r for r in roots)
  json[2].ctime = json[3].ctime - 310
  json = recompute_skips json
  (JSON.stringify(j) for j in json)

clock_drift_all = (roots) ->
  json = (JSON.parse r for r in roots)
  time = 1483924339
  for j in json[0...-1]
    j.ctime = time
    time += 100
  json = recompute_skips json
  (JSON.stringify(j) for j in json)

output "correct", "None", raw

drift1 = clock_drift_one make_copy()
output "outOfOrderCtime", "OutOfOrderCtime", drift1

drift_all = clock_drift_all make_copy()
output "tooMuchClockDrift", "TooMuchClockDrift", drift_all

output "truncatedThisRoot", "WrongSkipSequence", raw[1...]

output "truncatedLastRoot", "WrongSkipSequence", raw[0...(raw.length - 1)]

swap raw, 2, 3

output "swapped2and3", "WrongSkipSequence", raw

swap raw, 2, 3

swap raw, 7,8
output "swapped7and8", "WrongSkipSequence", raw
swap raw, 7,8

copy = make_copy()
raw = raw[0...4].concat raw[5...]
output "dropped4", "WrongSkipSequence", raw
raw = copy

r4 = JSON.parse raw[4]
r5 = JSON.parse raw[5]

copy = make_copy()
h = r4.body.skips[r5.body.seqno]
b = new Buffer h, 'hex'
b[4] ^= 1
r4.body.skips[r5.body.seqno] = b.toString 'hex'
raw[4] = JSON.stringify r4
output "corruptedHash", "SkipHashMismatch", raw
raw = copy

copy = make_copy()
json = (JSON.parse r for r in copy)
json[1].body.seqno--
json = recompute_skips json
badLogSeq = (JSON.stringify(j) for j in json)
output "notLogPattern", "WrongSkipSequence", badLogSeq

console.log "}"
console.log "const skipTestVectorsThisRoot keybase1.Seqno = 45155"
console.log "const skipTestVectorsLastRoot keybase1.Seqno = 44900"


