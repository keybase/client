//
//  KBPrefView.h
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBPreferences.h"

@interface KBPrefView : YOView

- (instancetype)initWithPreferences:(KBPreferences *)preferences;

@property KBPreferences *preferences;

@end
