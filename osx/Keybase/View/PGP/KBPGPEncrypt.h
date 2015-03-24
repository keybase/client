//
//  KBPGPEncrypt.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBReader.h"
#import "KBWriter.h"
#import "KBRPC.h"

@interface KBPGPEncrypt : NSObject

@property (readonly) id<KBReader> reader;
@property (readonly) id<KBWriter> writer;

- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options reader:(id<KBReader>)reader writer:(id<KBWriter>)writer client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSError *error))completion;

@end
