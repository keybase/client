#import "DropViewView.h"
#import "DropView.h"
#import <react/renderer/components/RNDropViewViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNDropViewViewSpec/EventEmitters.h>
#import <react/renderer/components/RNDropViewViewSpec/Props.h>
#import <react/renderer/components/RNDropViewViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface DropViewView () <RCTDropViewViewViewProtocol>
@end

@implementation DropViewView {
  UIView *_view;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<DropViewViewComponentDescriptor>();
}

- (instancetype)init
{
  if (self = [super init]) {
    static const auto defaultProps = std::make_shared<const DropViewViewProps>();
    _props = defaultProps;
  }
  return self;
}

Class<RCTComponentViewProtocol> DropViewViewCls(void)
{
    return DropViewView.class;
}

@end
