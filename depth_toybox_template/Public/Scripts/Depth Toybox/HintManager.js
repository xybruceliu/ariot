// @input Component.ScriptComponent lookAroundHintController

var hasUsedDepth = false;
var timeSinceDepth = 0;

var lookAroundHintController = (script.lookAroundHintController ? script.lookAroundHintController.api : null);

function setLookAroundHintAlpha(alpha) {
    if (lookAroundHintController) {
        lookAroundHintController.target = alpha;
    }
}

function updateLookAroundHint() {
    var visible = false;
    if (hasUsedDepth) {
        visible = timeSinceDepth > 0.1;
    } else {
        visible = timeSinceDepth < 4;
    }
    setLookAroundHintAlpha(visible ? 1.0 : 0.0);
}

function onUpdate() {
    if (global.depthUtil.depthTextureAvailable()) {
        hasUsedDepth = true;
        timeSinceDepth = 0;
    } else {
        timeSinceDepth += getDeltaTime();
    }
    updateLookAroundHint();
}

script.createEvent("UpdateEvent").bind(onUpdate);