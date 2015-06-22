//
//  KBPGPSigner.h
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
#import "KBRunOver.h"

@interface KBPGPSigner : NSObject

- (void)signWithOptions:(KBRPGPSignOptions *)options streams:(NSArray *)streams client:(KBRPClient *)client sender:(id)sender completion:(void (^)(NSArray *works))completion;

- (void)signWithOptions:(KBRPGPSignOptions *)options stream:(KBStream *)stream client:(KBRPClient *)client sender:(id)sender completion:(KBRunCompletion)completion;

@end
