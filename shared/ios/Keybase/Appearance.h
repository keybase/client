// A placeholder implementation for RN's https://github.com/facebook/react-native/commit/63fa3f21c5ab308def450bffb22054241a8842ef
//  Appearance.h
//  Keybase
//
//  Created by Chris Nojima on 9/9/19.
//  Copyright © 2019 Keybase. All rights reserved.
//

#ifndef Appearance_h
#define Appearance_h

#import <UIKit/UIKit.h>

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

NSString *const RCTUserInterfaceStyleDidChangeNotification = @"RCTUserInterfaceStyleDidChangeNotification";

@interface Appearance : RCTEventEmitter <RCTBridgeModule>
@end

#endif /* Appearance_h */
