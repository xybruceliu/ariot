// @input SceneObject tracking
// @input Component.ScriptComponent depthEffectControl {"label": "Occlusion Control"}
// @input Component.TouchComponent touchComponent

// @input Component.ScriptComponent[] effectControllers

// @input bool makeCopies = false

// @input float copyDistance = 25 {"showIf": "makeCopies", "label":"Copy Spacing"}

// @input bool lookTowardsMovement = false

script.target = script.getSceneObject();
var targetTransform = script.getTransform();

var trackedTransform = script.tracking.getTransform();

var depthEffectControl = script.depthEffectControl && script.depthEffectControl.api;

var effectControllers = script.effectControllers.map(function(sc) {
    return sc.api; 
});

var currentManager = null;

var lastPlacedPosition = null;
var lastLookDirection = null;

var isDragging = false;
var lastTouchPos = new vec2(0.5, 0.5);

function resetState() {
    script.transitioningToFollow = true;
    script.startedTransition = false;
    script.following = false;
    script.worldPositions = [];
    
    if (script.api.isCopy) {
        setDepthEffectEnabled(true);
    } else {
        setDepthEffectEnabled(false);
    }
}

function setDepthEffectEnabled(enabled) {
    if (depthEffectControl) {
        depthEffectControl.allowOcclusion = enabled;
    }
}

function moveFromCameraToWorld(worldPosition, worldRotation) {
    targetTransform.setWorldPosition(worldPosition);
    targetTransform.setWorldRotation(worldRotation);
}

function validQuat(q) {
    return !(isNaN(q.x) || isNaN(q.y) || isNaN(q.z) | isNaN(q.w));
}

function saveTrackingSample() {
    var transform = script.tracking.getTransform();
    var worldPosition = transform.getWorldPosition();
    var worldRotation = transform.getWorldRotation();

    if (!validQuat(worldRotation)) {
        print("Warning: Invalid rotation");
        return;
    }

    if (script.worldPositions.length > 0) {
        var lerpFactor = .5;
        var prevSample = script.worldPositions[script.worldPositions.length - 1];
        worldPosition = vec3.lerp(prevSample.position, worldPosition, lerpFactor);
        worldRotation = quat.slerp(prevSample.rotation, worldRotation, lerpFactor);
    }

    script.worldPositions.push({
        position: worldPosition,
        rotation: worldRotation
    });

    if (script.worldPositions.length > 64) {
        script.worldPositions.splice(0, 1);
    }
}

function onUpdate() {
    if (!currentManager) {
        if (isDragging) {
            updatePosition(lastTouchPos);
        }
    }
}

function updateTrackedPosition(screenPos) {
    var positionAndNormal = global.depthUtil.getPositionAndNormal(screenPos);
    if (positionAndNormal == null) {
        return;
    }

    var position = positionAndNormal.position;
    trackedTransform.setLocalPosition(position);
    var normal = positionAndNormal.normal;

    // Position and orient the object relative to the camera (assuming that the target is a child of the camera)
    var up = vec3.up();

    if (script.lookTowardsMovement && script.worldPositions.length > 0) {
        var worldPosition = script.tracking.getTransform().getWorldPosition();
        var prevSample = script.worldPositions[script.worldPositions.length - 1];
        var movementVec = prevSample.position.sub(worldPosition);
        if (movementVec.length > 1.5) {
            var worldMovementDir = movementVec.normalize();
            var parentTran = script.tracking.getParent().getTransform();
            var parentMat = parentTran.getInvertedWorldTransform();
            var localMovementDir = parentMat.multiplyDirection(worldMovementDir);
            up = localMovementDir;
        } else {
            up = lastLookDirection;
        }
    }

    lastLookDirection = up;

    var forwardDir = up.projectOnPlane(normal);
    var rot = quat.lookAt(forwardDir, normal);

    script.tracking.getTransform().setLocalRotation(rot);
}

function clampScreenPos(pos) {
    pos.x = Math.max(0, Math.min(pos.x, .9999));
    pos.y = Math.max(0, Math.min(pos.y, .9999));
}

function spawnCopyAtWorldPos(worldPos, worldRot, parent) {
    var copiedObj = script.getSceneObject().copyWholeHierarchy(script.target);
    copiedObj.enabled = true;
    copiedObj.setParent(parent || null);
    copiedObj.getTransform().setWorldPosition(worldPos);
    copiedObj.getTransform().setWorldRotation(worldRot);
    
    var scripts = copiedObj.getComponents("Component.ScriptComponent");
    for (var j=0; j<scripts.length; j++) {
        scripts[j].api.isCopy = true;
        scripts[j].api.assignedManager = currentManager;
        scripts[j].api.initialScale = copiedObj.getTransform().getLocalScale();
    }
    copiedObj.getTransform().setLocalScale(vec3.zero());
    return copiedObj;
}

function spawnCopyAtScreenPos(screenPos, parent) {
    updateTrackedPosition(screenPos);
    return spawnCopyAtWorldPos(trackedTransform.getWorldPosition(), trackedTransform.getWorldRotation(), parent);
}

function updatePosition(screenPos) {
    updateTrackedPosition(screenPos);
    saveTrackingSample();

    var delaySamples = 2;
    if (script.worldPositions.length > delaySamples) {
        if (script.transitioningToFollow) {
            if (!script.startedTransition) {
                setDepthEffectEnabled(true);
                script.following = false;
                var placementAnim = script.createEvent("SceneEvent.UpdateEvent");
                var animFrames = 3;
                var initPos = targetTransform.getWorldPosition();
                var initRot = targetTransform.getWorldRotation();
                var i = 1;
                placementAnim.bind(function() {
                    if (i <= animFrames) {
                        var t = i / animFrames;
                        var s = script.worldPositions[script.worldPositions.length - delaySamples];
                        moveFromCameraToWorld(vec3.lerp(initPos, s.position, t), quat.slerp(initRot, s.rotation, t));
                        i++;
                    } else {
                        script.following = true;
                        script.transitioningToFollow = false;
                        script.removeEvent(placementAnim);
                    }
                });
                script.startedTransition = true;
            }
        } else if (script.following) {
            var s = script.worldPositions[script.worldPositions.length - delaySamples];
            moveFromCameraToWorld(s.position, s.rotation);
            
            // Copying
            if (script.makeCopies) {
                if (lastPlacedPosition === null) {
                    lastPlacedPosition = s.position;
                }
                if (lastPlacedPosition.distance(s.position) >= script.copyDistance) {
                    lastPlacedPosition = s.position;
                    spawnCopyAtWorldPos(targetTransform.getWorldPosition(), targetTransform.getWorldRotation());
                }
            }
        }
        script.worldPositions.shift();
    }
}

function callEffectControllers(methodName, args) {
    for (var i=0; i<effectControllers.length; i++) {
        var controller = effectControllers[i];
        var method = controller[methodName];
        if (method) {
            method.call(args);
        } else {
            controller.pendingCalls = controller.pendingCalls || [];
            controller.pendingCalls.push(methodName);
        }
    }
}

function handleGlobalTouchMove(data) {
    if (!currentManager) {
        if (isDragging) {
            var pos = data.getTouchPosition();
            clampScreenPos(pos);
            lastTouchPos = pos;
            updatePosition(pos);
        }
    }
}

function acceptDragStart(screenPos) {
    if (!isDragging) {
        isDragging = true;
        clampScreenPos(screenPos);
        lastTouchPos = screenPos;
        updatePosition(screenPos);
        callEffectControllers("onPickup");
        return true;
    }
    return false;
}

function acceptDragMove(screenPos) {
    if (isDragging) {
        clampScreenPos(screenPos);
        updatePosition(screenPos);
        return true;
    }
    return false;
}

function acceptDragEnd(screenPos) {
    if (isDragging) {
        isDragging = false;
        callEffectControllers("onDrop");
        return true;
    }
    return false;
}

function cleanUpTweens() {
    if (global.tweenHelpers) {
        global.tweenHelpers.stopAllTweensOnObject(script.target, true);
    }
}

function acceptDestruction(screenPos) {
    cleanUpTweens();
    script.target.destroy();
    return true;
}

function handleLocalTouchStart(data) {
    if (currentManager) {
        currentManager.handleObjectTouchStart(data, script.api);
    } else {
        var screenPos = data.getTouchPosition();
        acceptDragStart(screenPos);
    }
    
}

function handleGlobalTouchEnd(data) {
    if (!currentManager) {
        if (isDragging) {
            var screenPos = data.getTouchPosition();
            acceptDragEnd(screenPos);
        }
    }
}

function handleFrontCamera() {
    if (!currentManager) {
        setEnabled(false);
    }
}

function handleBackCamera() {
    if (!currentManager) {
        setEnabled(true);
    }
}

function setEnabled(enabled) {
    script.getSceneObject().enabled = enabled;
}

function initializeFromManager(manager) {
    currentManager = manager;
    currentManager.handleObjectSpawn(script.api);
}

function getIsDragging() {
    return isDragging;
}

script.createEvent("CameraFrontEvent").bind(handleFrontCamera);
script.createEvent("CameraBackEvent").bind(handleBackCamera);

var touchScript = script.touchComponent.getSceneObject().createComponent("Component.ScriptComponent");
touchScript.createEvent("TouchStartEvent").bind(handleLocalTouchStart);

script.createEvent("TouchMoveEvent").bind(handleGlobalTouchMove);
script.createEvent("TouchEndEvent").bind(handleGlobalTouchEnd);

script.createEvent("UpdateEvent").bind(onUpdate);

script.api.initializeFromManager = initializeFromManager;
script.api.setEnabled = setEnabled;
script.api.spawnCopyAtScreenPos = spawnCopyAtScreenPos;
script.api.getIsDragging = getIsDragging;

script.api.acceptDragStart = acceptDragStart;
script.api.acceptDragMove = acceptDragMove;
script.api.acceptDragEnd = acceptDragEnd;

script.api.acceptDestruction = acceptDestruction;

function initialize() {    
    resetState();
    script.initialized = true;
    
    if (script.api.initialScale) {
        targetTransform.setLocalScale(script.api.initialScale);
    }
    if (script.api.assignedManager) {
        initializeFromManager(script.api.assignedManager);
    }
    
}
initialize();