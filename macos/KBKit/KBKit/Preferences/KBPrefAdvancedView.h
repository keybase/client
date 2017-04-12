//
//  KBPrefAdvancedView.h
//  Keybase
//
//  Created by Gabriel on 4/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBPreferences.h"
#import <YOLayout/YOBox.h>

@interface KBPrefAdvancedView : YOVBox

- (instancetype)initWithPreferences:(KBPreferences *)preferences;

@end
