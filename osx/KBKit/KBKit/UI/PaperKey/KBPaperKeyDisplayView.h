//
//  KBPaperKeyDisplayView.h
//  Keybase
//
//  Created by Gabriel on 8/19/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBPaperKeyDisplayView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property KBButton *button;

- (void)setPhrase:(NSString *)phrase;

+ (void)registerDisplay:(KBRPClient *)client sessionId:(NSNumber *)sessionId navigation:(KBNavigationView *)navigation;

@end
