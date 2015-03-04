//
//  KBContentView.h
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBNavigationView.h"
#import "KBRPC.h"

@interface KBContentView : YONSView

@property KBNavigationView *navigation;
@property id<KBRPClient> client;

// Optional content view created on access
@property (nonatomic, readonly) YONSView *contentView;

@end
