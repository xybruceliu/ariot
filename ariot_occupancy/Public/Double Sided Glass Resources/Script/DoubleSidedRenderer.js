// -----JS CODE-----
// @input Asset.Material glassMaterial {"label":"Material"}
// @input Component.RenderMeshVisual glassMesh {"label":"Mesh"}

var isInit = false;

function onStart() {
    isInit = validateInputs();
    if (isInit) {
        setMaterial();
    }
}

function onUpdate() {
    if (global.deviceInfoSystem.isEditor() && isInit) {
        setMaterial();
    }
}

function validateInputs() {
    if (!script.glassMesh) {
        print("ERROR: Please set the a mesh to the script.");
        return false;
    }
    if (!script.glassMaterial) {
        print("ERROR: Please set the a material that you want to render on both side to the script.");
        return false;
    }

    return true;
}

function setMaterial() {
    var mesh = script.glassMesh;
    var mat = script.glassMaterial;
    var matbackCulling = mat.clone();
    matbackCulling.mainPass.cullMode = CullMode.Front;
    mesh.clearMaterials();
    mesh.addMaterial(matbackCulling);
    mesh.addMaterial(mat);
}

var startEvent = script.createEvent("OnStartEvent");
startEvent.bind(onStart);

var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(onUpdate);