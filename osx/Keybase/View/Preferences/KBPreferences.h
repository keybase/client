//
//  KBPreferences.h
//  Keybase
//
//  Created by Gabriel on 2/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBPreferences : NSObject

- (void)open:(NSString *)configPath sender:(id)sender;

- (void)close;

- (id)valueForIdentifier:(NSString *)identifier;

- (void)setValue:(id)value forIdentifier:(NSString *)identifier synchronize:(BOOL)synchronize;

@end
