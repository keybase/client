//
//  KBPrefTextField.h
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBPreferences.h"

@interface KBPrefTextField : YOView

@property CGFloat inset;
@property CGFloat fieldWidth;

- (void)setLabelText:(NSString *)labelText infoText:(NSString *)infoText identifier:(NSString *)identifier preferences:(id<KBPreferences>)preferences;

@end
