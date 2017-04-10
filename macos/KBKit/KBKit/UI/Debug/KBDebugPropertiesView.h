//
//  KBDebugPropertiesView.h
//  Keybase
//
//  Created by Gabriel on 5/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import <GHODictionary/GHODictionary.h>

@interface KBDebugPropertiesView : YOView

- (void)setProperties:(GHODictionary *)properties;

+ (NSView *)viewForProperties:(GHODictionary *)properties;

@end
