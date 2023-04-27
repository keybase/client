// This guard prevent this file to be compiled in the old architecture.
#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTViewComponentView.h>
#import <UIKit/UIKit.h>

#ifndef DropViewViewNativeComponent_h
#define DropViewViewNativeComponent_h

NS_ASSUME_NONNULL_BEGIN

@interface DropViewView : RCTViewComponentView
@end

NS_ASSUME_NONNULL_END

#endif /* DropViewViewNativeComponent_h */
#endif /* RCT_NEW_ARCH_ENABLED */
