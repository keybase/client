//
//  KBPGPDecrypted.h
//  Keybase
//
//  Created by Gabriel on 4/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import "KBStream.h"

@interface KBPGPDecrypted : NSObject

@property (readonly) KBStream *stream;
@property (readonly) KBRPgpSigVerification *pgpSigVerification;

+ (instancetype)decryptedWithStream:(KBStream *)stream pgpSigVerification:(KBRPgpSigVerification *)pgpSigVerification;

@end
