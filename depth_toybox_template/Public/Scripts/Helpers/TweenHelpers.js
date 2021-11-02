
function isTweenScript(scriptComponent) {
    var api = scriptComponent.api;
    return !!(api.tweenObject && api.tweenType);
}

function findAllTweensOnObject(object, results) {
    results = (results === undefined) ? [] : results;
    var scriptComponents = object.getComponents("Component.ScriptComponent");
    for (var j=0; j<scriptComponents.length; j++) {
        if (isTweenScript(scriptComponents[j])) {
            results.push(scriptComponents[j]);
        }
    }
    return results;
}

function findAllTweensRecursive(object, results) {
    results = (results === undefined) ? [] : results;
    findAllTweensOnObject(object, results);
    
    var count = object.getChildrenCount();
    for (var i = 0; i<count; i++) {
        findAllTweensRecursive(object.getChild(i), results);
    }
    return results;
}

function stopTweenScript(tweenScript) {
    // HACK to fix TweenManager requiring tweens to be named
    var initName = tweenScript.api.tweenName;
    if (initName == "") {
        tweenScript.api.tweenName = "_tempName_" + Math.random() + "_";
    }
    
    global.tweenManager.stopTween(tweenScript.api.tweenObject, tweenScript.api.tweenName);
    
    // HACK restore tween name to original
    tweenScript.api.tweenName = initName;
}

function stopAllTweensOnObject(object, recursive) {
    var tweens = recursive ? findAllTweensRecursive(object) : findAllTweensOnObject(object);
    tweens.forEach(stopTweenScript);
}

global.tweenHelpers = {
    stopAllTweensOnObject: stopAllTweensOnObject,
};