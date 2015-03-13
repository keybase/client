//
//  KBContentView.h
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"

@interface KBContentView : KBView

@property KBNavigationView *navigation;
@property KBRPClient * client;

// Optional content view created on access
@property (nonatomic, readonly) KBView *contentView;

@end
