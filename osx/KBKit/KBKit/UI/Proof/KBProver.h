//
//  KBProver.h
//  Keybase
//
//  Created by Gabriel on 6/25/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"
#import "KBRPC.h"
#import "KBProofResult.h"

@interface KBProver : NSObject

- (void)createProofWithServiceName:(NSString *)serviceName client:(KBRPClient *)client sender:(id)sender completion:(KBCompletion)completion;

- (void)handleProofAction:(KBProofAction)proofAction proofResult:(KBProofResult *)proofResult client:(KBRPClient *)client sender:(id)sender completion:(KBCompletion)completion;

@end
