//@input Asset.Texture depthTexture
//@input Component.Camera camera
//@input Component.DeviceTracking deviceTracking
//@input float objectWidthWorld

var provider = script.depthTexture.control;

var defaultPlanePosWorldTracking = new vec3(0, -150, 0);
var defaultPlanePosSurfaceTracking = new vec3(0, 0, 0);
var defaultPlaneNormal = vec3.up();


function intersectPlane(planePos, planeNormal, rayPos, rayDir) { 
    var denom = -planeNormal.dot(rayDir);
    if (denom > 1e-6) {
        var offset = planePos.sub(rayPos);
        var dist = -offset.dot(planeNormal) / denom;
        if (dist >= 0) {
            return rayPos.add(rayDir.uniformScale(dist));
        }
    } 
    return null;
}

function raycastToGroundPlane(screenPos) {
    var worldPos1 = script.camera.screenSpaceToWorldSpace(screenPos, 0.0);
    var worldPos2 = script.camera.screenSpaceToWorldSpace(screenPos, 1.0);
    var rayDir = worldPos2.sub(worldPos1).normalize();
    var planePos = (script.deviceTracking.getActualDeviceTrackingMode() == DeviceTrackingMode.Surface)
        ? defaultPlanePosSurfaceTracking
        : defaultPlanePosWorldTracking;
    
    var far = script.camera.far - 10;

    var normal = defaultPlaneNormal;
    var worldPos = intersectPlane(planePos, normal, worldPos1, rayDir);

    if (!worldPos || worldPos.distance(worldPos1) > far) {
        worldPos = script.camera.screenSpaceToWorldSpace(screenPos, far);
    }

    // Convert world to camera local space
    var matrix = script.camera.getTransform().getInvertedWorldTransform();
    var camLocalPos = matrix.multiplyPoint(worldPos);
    var camLocalNorm = matrix.multiplyDirection(normal);

    return {
        position: camLocalPos,
        normal: camLocalNorm
    };
}

function posToIdeal(pos) {
    return new vec2((pos.x - 0.5) / script.fx, (1-pos.y - 0.5) / script.fy);
}

function depthToPos(coord, depth) {
    var ideal = posToIdeal(coord);
    var ray = new vec3(ideal.x, ideal.y, -1.0);
    return ray.uniformScale(depth);
}

function sampleDepth(coord) {
    return provider.getDepth(coord);
}

function det2x2(m00, m01, m10, m11) {
    return m00 * m11 - m01 * m10;
}

function normalForPoints(positions) {
    var n = positions.length;
    var cx = 0;
    var cy = 0;
    var cz = 0;
    for (var i = 0; i < n; i++) {
        var pos = positions[i];
        cx += pos.x;
        cy += pos.y;
        cz += pos.z;
    }
    cx /= n;
    cy /= n;
    cz /= n;
    var cov00 = 0;
    var cov01 = 0;
    var cov02 = 0;
    var cov10 = 0;
    var cov11 = 0;
    var cov12 = 0;
    var cov20 = 0;
    var cov21 = 0;
    var cov22 = 0;
    for (var j = 0; j < n; j++) {
        var p = positions[j];
        var px = p.x - cx;
        var py = p.y - cy;
        var pz = p.z - cz;
        cov00 += px * px;
        cov01 += px * py;
        cov02 += px * pz;
        cov10 += py * px;
        cov11 += py * py;
        cov12 += py * pz;
        cov20 += pz * px;
        cov21 += pz * py;
        cov22 += pz * pz;
    }
    var dx = det2x2(cov11, cov12, cov21, cov22);
    var dy = det2x2(cov00, cov02, cov20, cov22);
    var dz = det2x2(cov00, cov01, cov10, cov11);
    var d = [
        [dx, [
            1,
            det2x2(-cov01, cov12, -cov02, cov22)  / dx, 
            det2x2(cov11, -cov01, cov21, -cov02) / dx
        ]],
        [dy, [
            det2x2(-cov01, cov20, -cov12, cov22) / dy, 
            1,
            det2x2(cov00, -cov01, cov20, -cov12) / dy
        ]],
        [dz, [
            det2x2(-cov02, cov01, -cov12, cov11) / dz,
            det2x2(cov00, -cov02, cov10, -cov12) / dz,
            1
        ]],
    ];
    d.sort(function(d1, d2) { 
        return d2[0] - d1[0];
    });
    var normal = d[0][1];
    return new vec3(normal[0], normal[1], normal[2]).normalize();
}

function depthTextureAvailable() {
    return (scene.getCameraType() == "back" && script.depthTexture.getWidth() > 1);
}

function calculatePositionAndNormalFromDepthTex(screenCoord) {
    var width = provider.getWidth();
    var height = provider.getHeight();

    var fov = script.camera.fov;
    var aspect = script.camera.aspect;
    script.fy = 0.5 / Math.tan(0.5 * fov);
    script.fx = (1.0 / aspect) * script.fy;
    
    var center = screenCoord;
    var centerDepth = sampleDepth(center);

    // Width of screen at depth in world units
    var leftWorld = script.camera.screenSpaceToWorldSpace(new vec2(0, 0.5), centerDepth);
    var rightWorld = script.camera.screenSpaceToWorldSpace(new vec2(1, 0.5), centerDepth);
    var screenWidthWorld = leftWorld.distance(rightWorld);
    
    // Normalized width of object relative to screen
    var objectWidthScreen = script.objectWidthWorld / screenWidthWorld;
    
    // Sample 5 x 5 neighborhood around center
    var normalRadius = 2;

    var xStride = objectWidthScreen / (normalRadius * 2);
    var xStridePixel = 1 / width;
    xStride = Math.max(xStridePixel, xStride);
    var yStride = xStride * (width / height);

    var positions = [];
    for (var i = -normalRadius; i <= normalRadius; i++) {
        for (var j = -normalRadius; j <= normalRadius; j++) {
            var coord = center.add(new vec2(i * xStride, j * yStride));
            if (coord.x < 0 || coord.x > 1 || coord.y < 0 || coord.y > 1) {
                continue;
            }
            var depth = i == 0 && j == 0 ? centerDepth : sampleDepth(coord);
            positions.push(depthToPos(coord, depth));
        }
    }

    var normal = normalForPoints(positions);
    
    var viewDir = depthToPos(center, centerDepth)
        .uniformScale(-1)
        .normalize();
    if (viewDir.dot(normal) <= 0.0) {
        normal = normal.uniformScale(-1.0);
    }

    return {
        position: depthToPos(center, centerDepth),
        normal: normal
    };
}

function getPositionAndNormal(screenPos) {
    if (depthTextureAvailable()) {
        return calculatePositionAndNormalFromDepthTex(screenPos);
    } else {
        return raycastToGroundPlane(screenPos);
    }
}

global.depthUtil = {};
global.depthUtil.depthTextureAvailable = depthTextureAvailable;
global.depthUtil.getPositionAndNormal = getPositionAndNormal;