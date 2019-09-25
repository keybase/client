#ifdef __OBJC__
#import <UIKit/UIKit.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif

#import "RNSScreen.h"
#import "RNSScreenContainer.h"

FOUNDATION_EXPORT double RNScreensVersionNumber;
FOUNDATION_EXPORT const unsigned char RNScreensVersionString[];

