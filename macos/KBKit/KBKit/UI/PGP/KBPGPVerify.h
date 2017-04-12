//
//  KBPGPVerify.h
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBReader.h"
#import "KBWriter.h"
#import "KBRPC.h"
#import "KBStream.h"

@interface KBPGPVerify : NSObject

- (void)verifyWithOptions:(KBRPGPVerifyOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error, KBStream *stream, KBRPGPSigVerification *pgpSigVerification))completion;

@end
