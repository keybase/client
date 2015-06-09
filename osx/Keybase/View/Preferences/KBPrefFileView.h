//
//  KBPrefFileView.h
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBPreferences.h"
#import <YOLayout/YOLayout.h>

@interface KBPrefFileView : YOView

- (void)setLabelText:(NSString *)labelText identifier:(NSString *)identifier preferences:(id<KBPreferences>)preferences;

@end
