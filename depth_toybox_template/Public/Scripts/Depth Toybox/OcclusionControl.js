//@input Component.MaterialMeshVisual[] meshVisuals
//@input SceneObject trackingObject
//@input Component.Camera worldCamera

// @input Asset.Texture depthTexture
// @input Asset.Texture placeholderTexture

// @input bool cloneMaterials

// @ui {"showIf":"useOcclusionMat", "widget": "separator"}
// @input bool useOcclusionMat {"label":"Use Split Occlusion Materials"}

// @ui {"showIf":"useOcclusionMat", "label":"Warning:"}
// @ui {"showIf":"useOcclusionMat", "label":"Your MeshVisuals must use a material that occludes based"}
// @ui {"showIf":"useOcclusionMat", "label":"on Alpha, such as \"Alpha Occluded PBR\" in the"}
// @ui {"showIf":"useOcclusionMat", "label":"\"Materials/Split Occlusion\" folder."}

// @input Asset.Material occlusionMat {"label":"Occlusion to Alpha Material", "showIf":"useOcclusionMat"}

// @ui {"showIf":"useOcclusionMat", "widget": "separator"}


if (script.api.allowOcclusion === undefined) {
    script.api.allowOcclusion = true;
}

var materialLookup = [];
var materials = [];

function getOrRegisterMaterial(material, allowClone) {
    for (var i=0; i<materialLookup.length; i++) {
        var pair = materialLookup[i];
        if (material.isSame(pair.original)) {
            return pair.final;
        }
    }
    var final = material;
    if (allowClone) {
        final = material.clone();
    }
    final.depthTest = !final.depthTest;
    final.depthTest = !final.depthTest;
    materialLookup.push({
        original: material,
        final: final,
    });
    materials.push(final);
    return final;
}

function getMaterial(meshVisual) {
    var origMat = meshVisual.mainMaterial;
    if (script.useOcclusionMat && meshVisual.getMaterialsCount() > 1) {
        origMat = meshVisual.getMaterial(1);
    }
    meshVisual.clearMaterials();
    if (script.useOcclusionMat) {
        var split = getOrRegisterMaterial(script.occlusionMat, true);
        meshVisual.addMaterial(split);
    } else {
        origMat = getOrRegisterMaterial(origMat, script.cloneMaterials);
    }
    meshVisual.addMaterial(origMat);
    return meshVisual.mainMaterial;
}

function computeLerpfactor() {
    // Parameters are interpolated from min to max values non-linearly based on this function.
    var maximumDistance = 4.5;
    var distanceToCamera = getDistanceToCamera() / 100;
    var lerpFactor = Math.min(1.0, Math.exp(2.0 * distanceToCamera) / Math.exp(2.0 * maximumDistance));
    return lerpFactor;
}

function lerp(a, b, t) {
    return a * (1.0 - t) + b * t;
}

function getDistanceToCamera() {
    var cameraPosition = script.worldCamera.getTransform().getWorldPosition();
    var objectPosition = script.trackingObject.getTransform().getWorldPosition();
    return cameraPosition.distance(objectPosition);
}

function onUpdate() {
    var allowOcclusion = script.api.allowOcclusion && script.depthTexture.getWidth() > 1;
    var texToUse = allowOcclusion ? script.depthTexture : script.placeholderTexture;

    var lerpFactor = computeLerpfactor();
    var depthTolerancePerMm = lerp(0.15, 1.0, lerpFactor);
    var occlusionAlpha = lerp(0.0, 1.0, lerpFactor);
    var occlusionEdgeBlur = lerp(0.005, 0.5, lerpFactor);

    for (var i = 0; i < materials.length; i++) {
        var pass = materials[i].mainPass;
        pass.depthTolerancePerMm = depthTolerancePerMm;
        pass.occlusionAlpha = occlusionAlpha;
        pass.occlusionEdgeBlurAmount = occlusionEdgeBlur;
        pass.depthImage = texToUse;
        pass.depthEffectEnabled = allowOcclusion;
    }
}

function initialize() {
    for (var i = 0; i < script.meshVisuals.length; i++) {
        var viz = script.meshVisuals[i];
        getMaterial(viz);
    }

    for (var j=0; j<materials.length; j++) {
        var mat = materials[j];
        mat.mainPass.occlusionAlpha = 0.0;
        mat.mainPass.depthTolerancePerMm = 0.02;
        mat.mainPass.occlusionEdgeBlurAmount = 0.01;
    }
}

script.createEvent("UpdateEvent").bind(onUpdate);

initialize();