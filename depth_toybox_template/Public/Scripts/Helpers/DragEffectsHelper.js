// -----JS CODE-----
// @input SceneObject[] tweenObjects
// @input SceneObject rotateAnchor

// @input SceneObject[] dropObjects
// @input SceneObject[] pickupObjects

var pickedUp = false;

function enableObjects(objects, enabled) {
    for (var i=0; i<objects.length; i++) {
        objects[i].enabled = enabled;
    }
}

function updatePickupState() {
    if (pickedUp) {
        enableObjects(script.dropObjects, false);
        enableObjects(script.pickupObjects, true);
    } else {
        enableObjects(script.pickupObjects, false);
        enableObjects(script.dropObjects, true);
    }
}

function startStop(object, name) {
    if (object) {
        global.tweenManager.startTween(object, name);
        global.tweenManager.stopTween(object, name);
        global.tweenManager.resetObject(object, name);
    }
}

function reset() {
    script.tweenObjects.map(function(obj) {
        startStop(obj, "forward");
    });
    if (script.rotateAnchor) {
        global.tweenManager.stopTween(script.rotateAnchor, "forward");
        script.rotateAnchor.getTransform().setLocalRotation(quat.quatIdentity());
    }

    if (script.api.pendingCalls) {
        for (var i=0; i<script.api.pendingCalls.length; i++) {
            script.api[script.api.pendingCalls[i]]();
        }
        script.api.pendingCalls = [];
    }
}

function onPickup() {
    script.api.pendingCalls = [];
    pickedUp = true;
    updatePickupState();

    script.tweenObjects.map(function(obj) {
        global.tweenManager.startTween(obj, "forward");
    });
    if (script.rotateAnchor) {
        global.tweenManager.startTween(script.rotateAnchor, "forward");
    }
}

function onDrop() {
    script.api.pendingCalls = [];
    pickedUp = false;
    updatePickupState();

    script.tweenObjects.map(function(obj) {
        global.tweenManager.startTween(obj, "reverse");
    });
    
    if (script.rotateAnchor) {
        global.tweenManager.stopTween(script.rotateAnchor, "forward");
        script.rotateAnchor.getTransform().setLocalRotation(quat.quatIdentity());
    }
}

script.api.onPickup = onPickup;
script.api.onDrop = onDrop;

var resetter = script.createEvent("LateUpdateEvent");
resetter.bind(function() {
    reset();
    script.removeEvent(resetter);
});

updatePickupState();