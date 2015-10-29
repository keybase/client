//
//  KBPGPDecrypt.h
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import "KBRunOver.h"
#import "KBStream.h"

@interface KBPGPDecrypt : NSObject

- (void)decryptWithOptions:(KBRPGPDecryptOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works))completion;

- (void)decryptWithOptions:(KBRPGPDecryptOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBRunCompletion)completion;

@end
