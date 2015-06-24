//
//  KBPGPVerifyView.h
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>
#import "KBRPC.h"
#import "KBPGPDecrypted.h"

@class KBPGPVerifyView;

typedef void (^KBPGPOnVerify)(KBPGPVerifyView *view, KBPGPDecrypted *decrypted);

@interface KBPGPVerifyView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (copy) KBPGPOnVerify onVerify;

@end
