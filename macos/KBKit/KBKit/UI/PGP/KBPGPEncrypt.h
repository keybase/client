//
//  KBPGPEncrypt.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import "KBStream.h"
#import "KBRunOver.h"

@interface KBPGPEncrypt : NSObject

- (void)encryptWithOptions:(KBRPGPEncryptOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works))completion;

- (void)encryptWithOptions:(KBRPGPEncryptOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBRunCompletion)completion;


- (void)encryptText:(NSString *)text usernames:(NSArray *)usernames client:(KBRPClient *)client sender:(id)sender completion:(KBRunCompletion)completion;

@end
