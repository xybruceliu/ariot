// @input Component.MaterialMeshVisual visual
// @input float speed = 2.0

// @input bool remapValue = false
// @input float low = 0 {"showIf":"remapValue"}
// @input float high = 1 {"showIf":"remapValue"}

// @input bool forceStartValue = false
// @input float startValue = 0 {"showIf":"forceStartValue"}

var remap = script.remapValue;
var remapLow = script.low;
var remapHigh = script.high;

function getMappedTarget() {
    var target = script.api.target;
    return (remap)
        ? remapLow + (remapHigh - remapLow) * target
        : target;
}

function getCurrentColor() {
    return script.visual.mainPass.baseColor;
}

function setColor(color) {
    script.visual.mainPass.baseColor = color;
    script.visual.enabled = (color.a > 0);
}

function onUpdate() {
    var currentColor = getCurrentColor();
    
    var current = currentColor.a;
    var target = getMappedTarget();
    var diff = target - current;

    if (Math.abs(diff) > .00001) {
        var movement = getDeltaTime() * script.speed;
        if (diff > 0) {
            current = Math.min(current + movement, target);
        } else {
            current = Math.max(current - movement, target);
        }
        currentColor.a = current;
        setColor(currentColor);
    }
}

function initialize() {
    if (script.api.target === undefined) {
        if (script.forceStartValue) {
            script.api.target = script.startValue;
            var col = getCurrentColor();
            col.a = getMappedTarget();
            setColor(col);
        } else {
            script.api.target = getCurrentColor().a;
        }
    }
}

script.createEvent("UpdateEvent").bind(onUpdate);

initialize();