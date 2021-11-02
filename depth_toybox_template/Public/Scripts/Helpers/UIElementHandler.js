// @input Component.ScreenTransform uiElement
// @input Component.Image mainImage


// @ui {"widget":"group_start", "label":"Enable/Disable Animations"}

// @input SceneObject introTween
// @input SceneObject outroTween

// @ui {"widget":"group_end"}

// @ui {"widget":"group_start", "label":"Visibility Animations"}

// @input SceneObject visibleTween {"showIf":"useVisAlphaHandler", "showIfValue":false}
// @input SceneObject hideTween {"showIf":"useVisAlphaHandler", "showIfValue":false}

// @input Component.ScriptComponent visAlphaHandler {"label":"Vis. Alpha Handler", "showIf":"useVisAlphaHandler", "showIfValue":true}

// @input bool useVisAlphaHandler = false {"label":"Use Alpha Handler"}

// @ui {"widget":"group_end"}

// @input bool allowDisable = true
// @input bool allowHide = true;
// @input bool cloneMaterial

var introTween = script.introTween;
var outroTween = script.outroTween;
var currentState = true;
var currentTweenObj = null;

var visibleTween = script.visibleTween;
var hideTween = script.hideTween;
var currentVisibility = true;
var currentVisibilityTweenObj = null;

var useVisAlphaHandler = !!script.useVisAlphaHandler;
var visAlphaHandler = (useVisAlphaHandler && script.visAlphaHandler) ? script.visAlphaHandler.api : null;

function setObjectEnabled(enabled) {
    if (script.allowDisable) {
        script.uiElement.getSceneObject().enabled = enabled;
    }
}

function enableElement() {
    if (currentState == false) {
        currentState = true;
        setObjectEnabled(true);
        cancelCurrentTween();
        playTween(introTween);
    }
}

function disableElement() {
    if (currentState == true) {
        currentState = false;
        cancelCurrentTween();
        playTween(outroTween, function() {
            setObjectEnabled(false);
        });
    }
}

function setEnabled(enable) {
    if (enable) {
        enableElement();
    } else {
        disableElement();
    }
}

function showElement() {
    if (currentVisibility == false) {
        currentVisibility = true;
        if (useVisAlphaHandler) {
            setVisAlphaHandlerTarget(1.0);
        } else {
            cancelCurrentVisibilityTween();
            playVisibilityTween(visibleTween);
        }
    }
}

function hideElement() {
    if (currentVisibility == true) {
        currentVisibility = false;
        if (useVisAlphaHandler) {
            setVisAlphaHandlerTarget(0.0);
        } else {
            cancelCurrentVisibilityTween();
            playVisibilityTween(hideTween);
        }
    }
}

function setVisible(visible) {
    if (visible) {
        showElement();
    } else {
        hideElement();
    }
}

function isAnimating() {
    return !!currentTweenObj;
}

function isEnabled() {
    return !!currentState;
}

function isVisible() {
    return !!currentVisibility;
}

function cancelCurrentTween() {
    if (currentTweenObj) {
        stopTween(currentTweenObj);
        currentTweenObj = null;
    }
}

function cancelCurrentVisibilityTween() {
    if (currentVisibilityTweenObj) {
        stopTween(currentVisibilityTweenObj);
        currentVisibilityTweenObj = null;
    }
}

function playTween(obj, callback) {
    currentTweenObj = obj;
    if (!obj) {
        safeCall(callback);
        return;
    }
    global.tweenManager.startTween(obj, "play", function() {
        currentTweenObj = null;
        safeCall(callback);
    });
}

function playVisibilityTween(obj, callback) {
    currentVisibilityTweenObj = obj;
    if (!obj) {
        safeCall(callback);
        return;
    }

    global.tweenManager.startTween(obj, "play", function() {
        currentVisibilityTweenObj = null;
        safeCall(callback);
    });
}


function stopTween(obj) {
    global.tweenManager.stopTween(obj, "play");
}

function setVisAlphaHandlerTarget(value) {
    if (visAlphaHandler) {
        visAlphaHandler.target = value;
    }
}

function isTouchInBounds(screenPos) {
    return script.uiElement.containsScreenPoint(screenPos);
}

function setMainTexture(texture) {
    if (script.mainImage) {
        script.mainImage.mainPass.baseTex = texture;
    }
}

function safeCall(func) {
    if (func) {
        func();
    }
}

function initialize() {
    if (script.api.startDisabled) {
        var evt = script.createEvent("LateUpdateEvent");
        evt.bind(function() {
            script.removeEvent(evt);
            setEnabled(false);
        });
    }
    if (script.cloneMaterial && script.mainImage && script.mainImage.mainMaterial) {
        script.mainImage.mainMaterial = script.mainImage.mainMaterial.clone();
    }
    if (script.api.startingTexture) {
        setMainTexture(script.api.startingTexture);
    }
}

script.api.setEnabled = setEnabled;
script.api.setVisible = setVisible;
script.api.isAnimating = isAnimating;
script.api.isEnabled = isEnabled;
script.api.isVisible = isVisible;
script.api.isTouchInBounds = isTouchInBounds;
script.api.setMainTexture = setMainTexture;

initialize();