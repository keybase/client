//
//  KBPrefCheckbox.h
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBPreferences.h"
#import <YOLayout/YOLayout.h>

@interface KBPrefCheckbox : YOView

@property CGFloat inset;

- (void)setCategory:(NSString *)category;

- (void)setLabelText:(NSString *)labelText identifier:(NSString *)identifier preferences:(id<KBPreferences>)preferences;

@end
