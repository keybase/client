//
//  KBProofView.h
//  Keybase
//
//  Created by Gabriel on 6/24/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import <Tikppa/Tikppa.h>
#import "KBProofResult.h"
#import "KBDefines.h"

typedef void (^KBProofViewCompletion)(id sender, KBProofAction action);

@interface KBProofView : YOView

@property KBRPClient *client;
@property (nonatomic) KBProofResult *proofResult;
@property (copy) KBProofViewCompletion completion;

@end