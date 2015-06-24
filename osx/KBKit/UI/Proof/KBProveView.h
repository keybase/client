//
//  KBProveView.h
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBRPC.h"
#import "KBProveInputView.h"
#import "KBProveInstructionsView.h"
#import <KBAppKit/KBAppKit.h>
#import "KBRPC.h"
#import "KBProofResult.h"

typedef void (^KBProveCompletion)(BOOL success);

@interface KBProveView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

+ (void)connectWithServiceName:(NSString *)serviceName proofResult:(KBProofResult *)proofResult client:(KBRPClient *)client window:(KBWindow *)window completion:(KBProveCompletion)completion;

@end
