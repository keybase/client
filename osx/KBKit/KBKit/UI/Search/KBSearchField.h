//
//  KBSearchField.h
//  Keybase
//
//  Created by Gabriel on 3/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBSearchControl.h"

@interface KBSearchField : KBSearchControl <NSTextFieldDelegate>

@property (readonly) NSSearchField *searchField;

@end
