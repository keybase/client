//
//  KBProofView.h
//  Keybase
//
//  Created by Gabriel on 6/24/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import <KBAppKit/KBAppKit.h>
#import "KBRPC.h"
#import "KBProofResult.h"
#import <KBAppKit/KBAppKit.h>

typedef NS_ENUM (NSInteger, KBProofViewAction) {
  KBProofViewActionClose,
  KBProofViewActionRevoked = 1,
  KBProofViewActionWantsReplace,
  KBProofViewActionOpen
};

typedef void (^KBProofViewCompletion)(id sender, KBProofViewAction action);

@interface KBProofView : YOVBox

@property KBRPClient *client;
@property (nonatomic) KBProofResult *proofResult;
@property (copy) KBProofViewCompletion completion;

@end