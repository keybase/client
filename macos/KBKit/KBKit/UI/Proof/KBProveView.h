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
#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBProofResult.h"

typedef void (^KBProveCompletion)(id sender, BOOL success);

@interface KBProveView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

+ (void)createProofWithServiceName:(NSString *)serviceName client:(KBRPClient *)client sender:(id)sender completion:(KBProveCompletion)completion;

+ (void)replaceProof:(KBProofResult *)proofResult client:(KBRPClient *)client sender:(id)sender completion:(KBProveCompletion)completion ;

@end
