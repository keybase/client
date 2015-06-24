//
//  KBAppProgressView.h
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>
#import "KBRPC.h"

@interface KBAppProgressView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

- (void)enableProgressWithTitle:(NSString *)title;
- (void)disableProgress;

@end
