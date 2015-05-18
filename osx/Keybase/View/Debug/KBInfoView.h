//
//  KBInfoView.h
//  Keybase
//
//  Created by Gabriel on 5/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBAppDefines.h"

@interface KBInfoView : YOView

- (void)setProperties:(GHODictionary *)properties;

+ (NSView *)viewForProperties:(GHODictionary *)properties;

@end
