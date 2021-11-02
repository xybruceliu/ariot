// This script will swap out depth input to a placeholder texture when the device doesn't provide depth data.

//@input Asset.Material[] materials
//@input Asset.Texture depthTexture
//@input Asset.Texture placeholderTexture

var depthTextureActive = script.depthTexture.getWidth() > 1;
for (var i = 0; i < script.materials.length; i++) {
    var mainPass = script.materials[i].mainPass;
    if (depthTextureActive) {
        mainPass.depthEffectEnabled = true;
        mainPass.depthImage = script.depthTexture;
    } else {
        mainPass.depthEffectEnabled = false;
        mainPass.depthImage = script.placeholderTexture;
    }
}


