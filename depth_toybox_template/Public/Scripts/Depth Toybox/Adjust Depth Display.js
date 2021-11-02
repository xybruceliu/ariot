//@input Asset.Material visMaterial
//@input Asset.Texture depthTexture

var centerDepth = script.depthTexture.control.getDepth(new vec2(0.5, 0.5));

var visDepthRange = 100.0;
var minVisDepth = centerDepth - 0.5 * visDepthRange;
script.visMaterial.mainPass.minDepth = minVisDepth;
script.visMaterial.mainPass.depthRange = visDepthRange;
