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
#import "KBStream.h"
#import "KBWork.h"

@interface KBPGPEncrypt : NSObject

- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works))completion;

- (void)encryptWithOptions:(KBRPgpEncryptOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBWorkCompletion)completion;

@end
