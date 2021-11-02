// @input SceneObject placementParentObject
// @input SceneObject spawnedObjectHolder
// @input SceneObject uiParent

// @input Component.ScriptComponent buttonLayoutController

// @input SceneObject buttonObject
// @input SceneObject deleteButton
// @input Component.Image deleteButtonAnimation
// @input Component.ScriptComponent deleteButtonFadeController

// @input Asset.Texture[] defaultButtonTextures

var layoutSceneObj = script.buttonLayoutController.getSceneObject();
var layoutController = script.buttonLayoutController.api;

//var placementObjects = [];
var placementObjectControllers = [];

var buttonControllers = [];
var deleteButtonController = null;
var deleteButtonFadeController = (script.deleteButtonFadeController ? script.deleteButtonFadeController.api : null);

// State
var isActive = true;

var selectedIndex = -1;
var isTouchDown = false;
var dragging = false;
var draggedObject = null;
var isButtonDragging = false;
var waitingForSpawnPos = null;

// Touch Management
var pendingGlobalTouchStarts = [];
var pendingObjectTouchStarts = [];

var activeOnlyEvents = [];

function isDestroyMode() {
    return selectedIndex == placementObjectControllers.length;
}

function getChildObjects(parent, onlyEnabled) {
    var objs = [];
    var count = script.placementParentObject.getChildrenCount();
    for (var i=0; i<count; i++) {
        var child= parent.getChild(i);
        if (!onlyEnabled || child.enabled) {
            objs.push(child);
        }
    }
    return objs;
}

function createButton() {
    var newButton = layoutSceneObj.copyWholeHierarchy(script.buttonObject);
    newButton.layer = script.buttonObject.layer;
    return newButton;
}

function getTextureForButton(ind) {
    if (ind < placementObjectControllers.length) {
        ind = ind % script.defaultButtonTextures.length;
        return script.defaultButtonTextures[ind];
    }
    return null;
}

function registerButton(buttonObj, ind) {
    var buttonController = buttonObj.getComponent("Component.ScriptComponent").api;
    var texture = getTextureForButton(ind);
    if (buttonController.setEnabled) {
        buttonController.setEnabled(false);
        if (texture) {
            buttonController.setMainTexture(texture);
        }
    } else {
        buttonController.startDisabled = true;
        if (texture) {
            buttonController.startingTexture = texture;
        }
    }

    if (ind == placementObjectControllers.length) {
        deleteButtonController = buttonController;
    } else {
        buttonControllers.push(buttonController);
    }
    
}

function setDeleteButtonInnerAlpha(alpha) {
    if (deleteButtonFadeController) {
        deleteButtonFadeController.target = alpha;
    }
}

function updateButtonStates() {
    for (var i=0; i<buttonControllers.length; i++) {
        buttonControllers[i].setEnabled(i == selectedIndex);
        buttonControllers[i].setVisible(!dragging);
    }

    if (deleteButtonController) {
        deleteButtonController.setEnabled(true);
        deleteButtonController.setVisible(dragging);
        if (!dragging) {
            setDeleteButtonInnerAlpha(0);
        }
    }
}

function updateDeleteButtonAlphaFromTouchPosition(touchPosition) {
    var visible = dragging &&
        deleteButtonController &&
        deleteButtonController.isTouchInBounds(touchPosition);

    setDeleteButtonInnerAlpha(visible ? 1 : 0);
}

function findButtonIndexAtTouch(pos) {
    for (var i=0; i<buttonControllers.length; i++) {
        if (buttonControllers[i].isTouchInBounds(pos)) {
            return i;
        }
    }
    return -1;
}

function finalSpawnObjectAtScreenPos(pos, index) {
    return placementObjectControllers[index].spawnCopyAtScreenPos(pos, script.spawnedObjectHolder);
}

function spawnObjectAtScreenPos(pos, index) {
    finalSpawnObjectAtScreenPos(pos, index);
}

function checkGlobalTouchStartOnButtons(pos) {
    if (!dragging) {
        var touchedButtonInd = findButtonIndexAtTouch(pos);
        if (touchedButtonInd >= 0) {
            selectedIndex = touchedButtonInd;
            isButtonDragging = true;
            waitingForSpawnPos = pos;
            updateButtonStates();
            return true;
        }
    }
    return false;
}

function handleGlobalEmptyTouch(pos) {
    if (selectedIndex < 0 || isDestroyMode()) {
        return;
    }
    
    waitingForSpawnPos = pos;
    spawnObjectAtScreenPos(pos, selectedIndex);
    updateButtonStates();
}

function requestObjectDragStart(object, position) {
    if (dragging) {
        return false;
    }
    if (object.acceptDragStart(position)) {
        dragging = true;
        draggedObject = object;
        waitingForSpawnPos = null;
        updateButtonStates();
        updateDeleteButtonAlphaFromTouchPosition(position);
        return true;
    }
    return false;
}

function handlePendingTouchStartEvents() {
    if (dragging) {
        return;
    }

    for (var i=0; i<pendingGlobalTouchStarts.length; i++) {
        var touchPos = pendingGlobalTouchStarts[i];
        if (checkGlobalTouchStartOnButtons(touchPos)) {
            return;
        }
    }

    for (var j=0; j<pendingObjectTouchStarts.length; j++) {
        var touch = pendingObjectTouchStarts[j];
        if (isDestroyMode()) {
            // Destroy object
            if (!touch.object.acceptDestruction(touch.position)) {
                print("Warning: Object not accepting destruction!");
            }
        } else if (requestObjectDragStart(touch.object, touch.position)) {
            return;
        }
    }

    if (!isDestroyMode()) {
        for (var k=0; k<pendingGlobalTouchStarts.length; k++) {
            var tPos = pendingGlobalTouchStarts[k];
            handleGlobalEmptyTouch(tPos);
        }
    }
}

function handleGlobalTouchStart(eventData) {
    isTouchDown = true;
    pendingGlobalTouchStarts.push(eventData.getTouchPosition());
}

function handleGlobalTouchMove(eventData) {
    isTouchDown = true;
    if (dragging) {
        var pos = eventData.getTouchPosition();
        draggedObject.acceptDragMove(pos);
        updateButtonStates();
        updateDeleteButtonAlphaFromTouchPosition(pos);
    } else if (isButtonDragging) {
        if (isDestroyMode()) {
            isButtonDragging = false;
        } else {
            var touchPos = eventData.getTouchPosition();
            var pressedButton = findButtonIndexAtTouch(touchPos);
            if (pressedButton == -1) {
                spawnObjectAtScreenPos(touchPos, selectedIndex);
                isButtonDragging = false;
            }
        }
    }
}

function handleGlobalTouchEnd(eventData) {
    isTouchDown = false;
    if (dragging) {
        if (!draggedObject.acceptDragEnd(eventData.getTouchPosition())) {
            print("Warning: Dragged object not accepting drag end!");
        }

        // Check if dragged onto the destroy button
        var pos = eventData.getTouchPosition();
        if (deleteButtonController && deleteButtonController.isTouchInBounds(pos)) {
            if (!draggedObject.acceptDestruction(pos)) {
                print("Warning: Dragged object not accepting destruction!");
            } else {
                if (script.deleteButtonAnimation) {
                    script.deleteButtonAnimation.mainPass.baseTex.control.play(1, 0);
                }
            }
        }
        dragging = false;
        draggedObject = null;
    }
    isButtonDragging = false;
    waitingForSpawnPos = null;
    updateButtonStates();
}

function handleObjectTouchStart(eventData, object) {
    isTouchDown = true;
    if (dragging || !isActive) {
        return;
    }
    pendingObjectTouchStarts.push({
        position: eventData.getTouchPosition(),
        object: object
    });
}

function handleObjectSpawn(objectController) {
    if (!dragging && isTouchDown && waitingForSpawnPos != null) {
        var pos = waitingForSpawnPos;
        waitingForSpawnPos = null;
        requestObjectDragStart(objectController, pos);
    }
    waitingForSpawnPos = null;
}

function onLateUpdate(eventData) {
    if (pendingGlobalTouchStarts.length > 0 || pendingObjectTouchStarts.length > 0) {
        handlePendingTouchStartEvents();
        pendingGlobalTouchStarts = [];
        pendingObjectTouchStarts = [];
    }
}

function setActive(active) {
    isActive = active;

    if (script.uiParent) {
        script.uiParent.enabled = active;
    }
    if (script.spawnedObjectHolder) {
        script.spawnedObjectHolder.enabled = active;
    }

    for (var i=0; i<activeOnlyEvents.length; i++) {
        activeOnlyEvents[i].enabled = active;
    }
}

function handleFrontCamera() {
    setActive(false);
}

function handleBackCamera() {
    setActive(true);
}

function addActiveEvent(eventType, callback) {
    var evt = script.createEvent(eventType);
    evt.bind(callback);
    activeOnlyEvents.push(evt);
    return evt;
}

function refreshLayout() {
    layoutController.initialize();
    layoutController.updateLayout();
}

function initializePlacementObjects() {
    var placementObjects = getChildObjects(script.placementParentObject, true);
    for (var i=0; i<placementObjects.length; i++) {
        var scripts = placementObjects[i].getComponents("Component.ScriptComponent");
        for (var j=0; j<scripts.length; j++) {
            var placementScript = scripts[j].api;
            if (placementScript.initializeFromManager) {
                placementObjectControllers.push(placementScript);
                placementScript.initializeFromManager(script.api);
                placementScript.setEnabled(false);
            }
        }
    }
}


function initialize() {
    initializePlacementObjects();
    
    var buttons = [script.buttonObject];
    
    for (var i=1; i<placementObjectControllers.length; i++) {
        buttons.push(createButton());
    }

    if (script.deleteButton) {
        buttons.push(script.deleteButton);
    }
    
    for (var j=0; j<buttons.length; j++) {
        registerButton(buttons[j], j);
    }
    
    refreshLayout();
}

script.createEvent("CameraFrontEvent").bind(handleFrontCamera);
script.createEvent("CameraBackEvent").bind(handleBackCamera);

addActiveEvent("TouchStartEvent", handleGlobalTouchStart);
addActiveEvent("TouchEndEvent", handleGlobalTouchEnd);
addActiveEvent("TouchMoveEvent", handleGlobalTouchMove);
addActiveEvent("LateUpdateEvent", onLateUpdate);

script.api.handleObjectTouchStart = handleObjectTouchStart;
script.api.handleObjectSpawn = handleObjectSpawn;

initialize();

script.createEvent("TurnOnEvent").bind(function() {
    selectedIndex = 0;
    updateButtonStates();
});
