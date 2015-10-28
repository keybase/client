//
//  KBAppProgressView.h
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBAppProgressView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;
@property (nonatomic, getter=isAnimating) BOOL animating;

- (void)setProgressTitle:(NSString *)progressTitle;

@end
