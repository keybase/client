//
//  KBPrefGeneralView.h
//  Keybase
//
//  Created by Gabriel on 4/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBPreferences.h"

@interface KBPrefGeneralView : YOVBox <KBPreferences>

- (instancetype)initWithPreferences:(KBPreferences *)preferences;

@end
